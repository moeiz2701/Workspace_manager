-- 0002_profiles.sql — people, approval gate, auto-provisioning
-- Spec: IMPLEMENTATION.md §3.2

-- Emails allowed to become admin automatically on first sign-in.
-- Seed this table manually before the first login. It is the only bootstrap path.
create table if not exists bootstrap_admins (
  email text primary key
);

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text,
  avatar_url   text,
  role         user_role      not null default 'member',
  status       profile_status not null default 'pending',
  color        text           not null,          -- palette token, see §7.1
  title        text,                             -- e.g. "Backend", "ML"
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  approved_by  uuid references profiles(id),
  constraint profiles_color_valid check (color in (
    'violet','blue','cyan','teal','emerald','lime',
    'amber','orange','rose','pink','fuchsia','slate'
  ))
);

create index if not exists profiles_status_idx on profiles(status);

-- ---------------------------------------------------------------------------
-- Approval-gated helper functions.
-- `security definer` so they bypass RLS and cannot recurse into the policies
-- that call them.
-- ---------------------------------------------------------------------------

create or replace function is_approved()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'approved' and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Auto-provision on first Google sign-in. Creates a `pending` profile, assigns
-- the least-used palette colour, and notifies every admin.
-- (`notifications` is created in 0005; plpgsql resolves it at call time.)
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_color   text;
  v_is_boot boolean;
  v_admin   record;
begin
  select exists (select 1 from bootstrap_admins b where lower(b.email) = lower(new.email))
    into v_is_boot;

  -- least-used colour from the palette, deterministic tiebreak
  select p.token into v_color
  from unnest(array[
    'violet','blue','cyan','teal','emerald','lime',
    'amber','orange','rose','pink','fuchsia','slate'
  ]) with ordinality as p(token, ord)
  left join profiles pr on pr.color = p.token
  group by p.token, p.ord
  order by count(pr.id), p.ord
  limit 1;

  insert into profiles (id, email, full_name, avatar_url, color, role, status, approved_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url',
    v_color,
    case when v_is_boot then 'admin'::user_role else 'member'::user_role end,
    case when v_is_boot then 'approved'::profile_status else 'pending'::profile_status end,
    case when v_is_boot then now() else null end
  )
  on conflict (id) do nothing;

  if not v_is_boot then
    for v_admin in select id from profiles where role = 'admin' and status = 'approved' loop
      insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
      values (v_admin.id, 'access_request',
              'New access request',
              coalesce(new.raw_user_meta_data->>'full_name', new.email) || ' requested access',
              'profile', new.id);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Admin-only membership RPCs. Audited via the notifications they raise.
-- ---------------------------------------------------------------------------

create or replace function approve_member(p_profile_id uuid, p_role user_role default 'member')
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'Only admins can approve members' using errcode = '42501';
  end if;

  update profiles
     set status = 'approved', role = p_role,
         approved_at = now(), approved_by = auth.uid()
   where id = p_profile_id and status <> 'approved';

  if not found then
    return;
  end if;

  insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
  values (p_profile_id, 'access_approved',
          'Access approved', 'You now have access to the workspace.', 'profile', p_profile_id);
end;
$$;

create or replace function reject_member(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'Only admins can reject members' using errcode = '42501';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'You cannot reject yourself' using errcode = 'P0001';
  end if;

  update profiles
     set status = 'rejected', approved_at = null, approved_by = auth.uid()
   where id = p_profile_id;

  insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
  values (p_profile_id, 'access_rejected',
          'Access declined', 'Your access request was declined.', 'profile', p_profile_id);
end;
$$;

create or replace function set_member_role(p_profile_id uuid, p_role user_role)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;

  -- Never allow the last admin to demote themselves out of existence.
  if p_role = 'member' and (
    select count(*) from profiles
    where role = 'admin' and status = 'approved' and id <> p_profile_id
  ) = 0 then
    raise exception 'There must be at least one admin' using errcode = 'P0001';
  end if;

  update profiles set role = p_role where id = p_profile_id;
end;
$$;

create or replace function set_member_color(p_profile_id uuid, p_color text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'Only admins can change colours' using errcode = '42501';
  end if;
  update profiles set color = p_color where id = p_profile_id;
end;
$$;
