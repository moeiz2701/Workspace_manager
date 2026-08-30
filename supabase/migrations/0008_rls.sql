-- 0008_rls.sql — Row Level Security. RLS is the ONLY authorization layer.
-- Spec: IMPLEMENTATION.md §5
-- Every policy assumes a hostile client calling PostgREST directly.
-- No table is left open.

alter table profiles          enable row level security;
alter table categories        enable row level security;
alter table tasks             enable row level security;
alter table task_assignees    enable row level security;
alter table task_dependencies enable row level security;
alter table task_comments     enable row level security;
alter table comment_mentions  enable row level security;
alter table task_activity     enable row level security;
alter table notifications     enable row level security;
alter table imports           enable row level security;
alter table bootstrap_admins  enable row level security;   -- no policies at all = nobody reads it

-- PROFILES ------------------------------------------------------------------
drop policy if exists "own profile always readable" on profiles;
create policy "own profile always readable"
  on profiles for select using (id = auth.uid());

drop policy if exists "approved users see the team" on profiles;
create policy "approved users see the team"
  on profiles for select using (is_approved());

drop policy if exists "admins see everyone (incl. pending)" on profiles;
create policy "admins see everyone (incl. pending)"
  on profiles for select using (is_admin());

drop policy if exists "users edit their own display fields" on profiles;
create policy "users edit their own display fields"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- role/status/color/email are protected by guard_profile_columns() below.

drop policy if exists "admins manage profiles" on profiles;
create policy "admins manage profiles"
  on profiles for update using (is_admin()) with check (is_admin());

-- CATEGORIES ----------------------------------------------------------------
drop policy if exists "approved read categories" on categories;
create policy "approved read categories" on categories for select using (is_approved());

drop policy if exists "admins write categories" on categories;
create policy "admins write categories"  on categories for all using (is_admin()) with check (is_admin());

-- TASKS ---------------------------------------------------------------------
drop policy if exists "approved read tasks" on tasks;
create policy "approved read tasks" on tasks for select using (is_approved());

drop policy if exists "admins write tasks" on tasks;
create policy "admins write tasks"  on tasks for all using (is_admin()) with check (is_admin());
-- members never UPDATE tasks directly; they call set_task_status().

-- ASSIGNEES / DEPENDENCIES ---------------------------------------------------
drop policy if exists "approved read assignees" on task_assignees;
create policy "approved read assignees" on task_assignees for select using (is_approved());

drop policy if exists "admins write assignees" on task_assignees;
create policy "admins write assignees"  on task_assignees for all using (is_admin()) with check (is_admin());

drop policy if exists "approved read deps" on task_dependencies;
create policy "approved read deps" on task_dependencies for select using (is_approved());

drop policy if exists "admins write deps" on task_dependencies;
create policy "admins write deps"  on task_dependencies for all using (is_admin()) with check (is_admin());

-- COMMENTS ------------------------------------------------------------------
drop policy if exists "approved read comments" on task_comments;
create policy "approved read comments" on task_comments for select using (is_approved());

drop policy if exists "approved write own comments" on task_comments;
create policy "approved write own comments"
  on task_comments for insert with check (is_approved() and author_id = auth.uid());

drop policy if exists "edit own comments" on task_comments;
create policy "edit own comments"
  on task_comments for update using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "admins moderate comments" on task_comments;
create policy "admins moderate comments"
  on task_comments for update using (is_admin()) with check (is_admin());
-- deletion is soft (set deleted_at); no DELETE policy exists.

drop policy if exists "approved read mentions" on comment_mentions;
create policy "approved read mentions"  on comment_mentions for select using (is_approved());

drop policy if exists "author writes mentions" on comment_mentions;
create policy "author writes mentions"
  on comment_mentions for insert with check (
    is_approved() and exists (
      select 1 from task_comments c where c.id = comment_id and c.author_id = auth.uid()
    )
  );

-- ACTIVITY (append-only, written by SECURITY DEFINER triggers only) -----------
drop policy if exists "approved read activity" on task_activity;
create policy "approved read activity" on task_activity for select using (is_approved());
-- no insert/update/delete policies.

-- NOTIFICATIONS --------------------------------------------------------------
drop policy if exists "read own notifications" on notifications;
create policy "read own notifications"   on notifications for select using (recipient_id = auth.uid());

drop policy if exists "update own notifications" on notifications;
create policy "update own notifications" on notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- IMPORTS --------------------------------------------------------------------
drop policy if exists "admins read imports" on imports;
create policy "admins read imports" on imports for select using (is_admin());

-- ---------------------------------------------------------------------------
-- Protecting privileged profile columns.
-- Without this, "users edit their own display fields" lets a member self-promote.
-- ---------------------------------------------------------------------------

create or replace function guard_profile_columns()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if not is_admin() then
    new.role   := old.role;
    new.status := old.status;
    new.color  := old.color;
    new.email  := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update on profiles
for each row execute function guard_profile_columns();

-- ---------------------------------------------------------------------------
-- 5.1 Realtime. Realtime respects RLS, so a `pending` user's socket receives
-- nothing.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['tasks','task_comments','notifications','task_assignees','profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
