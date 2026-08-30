# Entropable Implementation Workspace — Implementation Document

**Version:** 1.0
**Date:** 2026-08-28
**Owner:** Abdul Moiz (admin)
**Purpose:** An internal task-management workspace used to drive the Entropable crypto trading platform build to launch. Admin defines categories and tasks (in bulk via JSON), assigns people, and tracks completion. Members log in, get approved, and work their assigned tasks.

---

## 0. Locked decisions

| Decision       | Choice                                                                                                                                                                                                                            | Rationale                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Auth           | Supabase Auth, **Google OAuth only**                                                                                                                                                                                              | No password handling, no email deliverability setup.                           |
| Access control | **Admin approval queue.** New sign-in creates a `pending` profile with zero data access. Admin gets an in-app notification, approves, user gets full app.                                                                         | Matches requirement; RLS-enforced, not UI-enforced.                            |
| Tenancy        | **Single workspace, single project.** No org/project tables.                                                                                                                                                                      | Simplest schema and RLS. Multi-project is an additive migration later (§12).   |
| Task model     | **Tree** (`parent_task_id`) **+ DAG** (`task_dependencies`, many-to-many, cross-category allowed).                                                                                                                                | Requirement: subtasks _and_ arbitrary "depends on" links.                      |
| Status gating  | A task cannot leave `todo` until **every** dependency is `done`. Enforced by a **database trigger**, mirrored in the UI.                                                                                                          | UI-only gating is trivially bypassed via the API.                              |
| Bulk load      | **JSON upload** with dry-run preview, two-pass transactional import. Carries categories, task tree, assignees, multiple dependencies, priority, and time fields.                                                                  | Requirement.                                                                   |
| Time features  | Time columns exist in the schema from day one (`start_date`, `due_date`, `estimate_hours`, `actual_hours`, `started_at`, `completed_at`). **No time-based feature is built in v1** — no reminders, no overdue logic, no burndown. | Requirement: schema-ready, feature-deferred. Avoids a painful migration later. |
| Deployment     | Vercel (app) + Supabase Cloud (DB/Auth/Realtime).                                                                                                                                                                                 | Zero-ops for a small internal tool.                                            |

### v1 scope (build these)

1. Google sign-in + pending-approval gate + admin approval queue with in-app notifications.
2. Categories (admin CRUD, colored).
3. Tasks: tree, multi-assignee, admin note to assignees, dependencies (multi, cross-category).
4. **Drag-to-change-status Kanban board.**
5. **Filterable task list** (category, assignee, status, priority, blocked, search, my-tasks).
6. **Threaded comments per task** with **@mentions** → notification.
7. **Audit log** of every status change with actor + timestamp.
8. **Dependency graph** view (visual, blocked/unblocked coloring).
9. **JSON bulk import** with dry-run.
10. **Tracker page**: per-category completion + whole-project completion.
11. Per-person **color badge** shown on every task.

### Explicitly deferred (schema is ready, do not build in v1) — see §12

Calendar view · time tracking (est. vs actual) · burndown & velocity analytics · deadline reminders & overdue flags · file attachments · saved views · recurring tasks · Slack/email notifications · multi-project & multi-tenant · public read-only status page · task templates · workload balancing.

---

## 1. Stack

| Layer                | Choice                                                                                                   | Notes                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Framework            | **Next.js 15**, App Router, React 19, TypeScript strict                                                  | Server Components for reads, Server Actions for writes.                                            |
| Styling              | **Tailwind CSS v4** + **shadcn/ui** (Radix)                                                              | Fast, accessible, themeable. Dark mode via `next-themes`.                                          |
| DB / Auth / Realtime | **Supabase** (Postgres 15, Auth, Realtime, Storage)                                                      | Storage only used later for attachments.                                                           |
| Supabase client      | `@supabase/supabase-js` + **`@supabase/ssr`**                                                            | Cookie-based sessions; middleware refreshes tokens.                                                |
| Server state         | **TanStack Query v5**                                                                                    | Client caches for board/list; Realtime events invalidate queries.                                  |
| Drag & drop          | **`@dnd-kit/core`** + `@dnd-kit/sortable`                                                                | Board columns + within-column ordering. Not `react-beautiful-dnd` (unmaintained, React 19 issues). |
| Graph                | **React Flow (`@xyflow/react`)** + **`dagre`** for auto-layout                                           | Dependency graph. Same lib family as the main Entropable app.                                      |
| Validation           | **Zod**                                                                                                  | One schema shared by JSON import, Server Actions, and forms.                                       |
| Forms                | `react-hook-form` + `@hookform/resolvers`                                                                |                                                                                                    |
| Tables               | `@tanstack/react-table`                                                                                  | Filterable list view.                                                                              |
| Editor               | `@tiptap/react` (minimal: bold/italic/link/code/mention)                                                 | Comments with @mention. Plain textarea is an acceptable v1 fallback if time-boxed.                 |
| Dates                | `date-fns`                                                                                               |                                                                                                    |
| Icons                | `lucide-react`                                                                                           |                                                                                                    |
| Charts               | `recharts`                                                                                               | Tracker page progress only.                                                                        |
| Migrations           | **Supabase CLI** (`supabase/migrations/*.sql`)                                                           | Versioned SQL in the repo. Never click-edit schema in the dashboard.                               |
| Types                | `supabase gen types typescript` → `src/types/database.ts`                                                | Regenerate after every migration.                                                                  |
| Testing              | Vitest (unit: import parser, dependency resolver) + Playwright (e2e: approval flow, drag-to-done gating) |                                                                                                    |
| Lint/format          | ESLint + Prettier + `eslint-plugin-tailwindcss`                                                          |                                                                                                    |
| Package manager      | pnpm                                                                                                     |                                                                                                    |

**Deliberately not used:** Prisma/Drizzle (RLS is the authorization layer; a second ORM-side model invites drift), NextAuth (Supabase Auth owns sessions), Redis (unnecessary at this scale).

---

## 2. Architecture

```
Browser
  ├─ RSC page load ──────► Next.js server (Vercel) ──► Supabase Postgres (RLS as user)
  ├─ Mutations ──────────► Server Actions ──────────► Supabase (RLS as user) / RPC (SECURITY DEFINER)
  └─ Realtime WS ────────────────────────────────────► Supabase Realtime (postgres_changes)
```

**Rules of the road**

1. **RLS is the only authorization layer.** Every policy assumes a hostile client. The UI hides what a user cannot do; the database _enforces_ it.
2. **Reads** happen in Server Components using the request-scoped Supabase client (user's JWT). Interactive views (board, list) hydrate a TanStack Query cache from the server-rendered payload.
3. **Writes** go through Server Actions. Actions that involve business rules (status change, import, approval) call a Postgres **RPC function** so the rule lives next to the data and cannot be skipped.
4. **`SUPABASE_SERVICE_ROLE_KEY` is used in exactly one place** — nowhere. All privileged logic is a `SECURITY DEFINER` RPC with an explicit internal permission check. This keeps the service key out of the app entirely. (If a future cron/webhook needs it, it lives in a route handler, never imported by a component.)
5. **Realtime is a cache-invalidation signal, not a data source.** On a `postgres_changes` event, invalidate the relevant query key and refetch through RLS. Never trust payload contents for authorization.
6. **Derived state is computed in the database** (`is_blocked`, progress counts) and exposed via views, so the board, list, and graph can never disagree.

### Folder structure

```
src/
  app/
    (auth)/login/page.tsx
    (auth)/auth/callback/route.ts
    (gate)/pending/page.tsx
    (app)/layout.tsx                # shell: sidebar, notification bell, presence of approved user
    (app)/board/page.tsx
    (app)/tasks/page.tsx
    (app)/tasks/[key]/page.tsx
    (app)/graph/page.tsx
    (app)/tracker/page.tsx
    (app)/notifications/page.tsx
    (app)/admin/people/page.tsx
    (app)/admin/categories/page.tsx
    (app)/admin/import/page.tsx
    api/                            # only if a webhook is ever needed
  components/
    board/            list/          task/           graph/
    comments/         notifications/ admin/          ui/        # shadcn
  lib/
    supabase/{server.ts,client.ts,middleware.ts}
    actions/{tasks.ts,comments.ts,people.ts,categories.ts,import.ts}
    schemas/{import.ts,task.ts,comment.ts}
    import/{parse.ts,resolve.ts,plan.ts}
    colors.ts        queries.ts     realtime.ts
  types/database.ts
supabase/
  migrations/*.sql
  seed/entropable.seed.json
middleware.ts
```

---

## 3. Database schema

All SQL below belongs in `supabase/migrations/`, split as indicated. Apply with `supabase db push`.

### 3.1 Enums and extensions — `0001_init.sql`

```sql
create extension if not exists "pgcrypto";

create type user_role      as enum ('admin', 'member');
create type profile_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type task_status    as enum ('todo', 'in_progress', 'in_review', 'done', 'cancelled');
create type task_priority  as enum ('low', 'medium', 'high', 'critical');

create type activity_type as enum (
  'created', 'status_changed', 'assignee_added', 'assignee_removed',
  'dependency_added', 'dependency_removed', 'note_updated',
  'category_changed', 'priority_changed', 'parent_changed', 'imported'
);

create type notification_type as enum (
  'access_request', 'access_approved', 'access_rejected',
  'task_assigned', 'task_unassigned', 'mention', 'comment',
  'status_changed', 'task_unblocked'
);
```

> **Note on `blocked`.** `blocked` is _not_ a status. It is derived from unmet dependencies (§3.6) so it can never drift out of sync with reality. The board renders blocked `todo` tasks with a lock chip and refuses the drag.

### 3.2 People — `0002_profiles.sql`

```sql
-- Emails allowed to become admin automatically on first sign-in.
-- Seed this table manually before the first login. It is the only bootstrap path.
create table bootstrap_admins (
  email text primary key
);

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text,
  avatar_url   text,
  role         user_role      not null default 'member',
  status       profile_status not null default 'pending',
  color        text           not null,          -- palette token, see §6.1
  title        text,                             -- e.g. "Backend", "ML"
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  approved_by  uuid references profiles(id),
  constraint profiles_color_valid check (color in (
    'violet','blue','cyan','teal','emerald','lime',
    'amber','orange','rose','pink','fuchsia','slate'
  ))
);

create index profiles_status_idx on profiles(status);
```

**Approval-gated helper functions.** `security definer` so they bypass RLS and cannot recurse into the policies that call them.

```sql
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
```

**Auto-provision on first Google sign-in.** Creates a `pending` profile, assigns the least-used palette colour, and notifies every admin.

```sql
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
  );

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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
```

**Approval RPC** (admin-only, audited):

```sql
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

  insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
  values (p_profile_id, 'access_approved',
          'Access approved', 'You now have access to the workspace.', 'profile', p_profile_id);
end;
$$;
```

`reject_member(p_profile_id)` and `set_member_role(p_profile_id, p_role)` follow the same shape.

### 3.3 Categories — `0003_categories.sql`

```sql
create table categories (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,     -- stable slug used by JSON import, e.g. 'ml-pipeline'
  name        text not null,
  description text,
  color       text not null default 'slate',
  icon        text,                     -- lucide icon name
  position    numeric not null default 1000,
  created_at  timestamptz not null default now(),
  constraint categories_key_format check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
```

### 3.4 Tasks — `0004_tasks.sql`

```sql
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,         -- human ref, e.g. 'ML-04'. Import-stable.
  category_id    uuid not null references categories(id) on delete restrict,
  parent_task_id uuid references tasks(id) on delete cascade,   -- TREE
  title          text not null,
  description    text,
  note           text,                          -- admin's message to the assignees
  status         task_status   not null default 'todo',
  priority       task_priority not null default 'medium',
  position       numeric not null default 1000, -- fractional ordering within a board column

  -- Time columns: populated by import, displayed nowhere in v1. Reserved for §12.
  start_date     date,
  due_date       date,
  estimate_hours numeric(6,2),
  actual_hours   numeric(6,2),
  started_at     timestamptz,   -- set by trigger on first move out of 'todo'
  completed_at   timestamptz,   -- set by trigger on move to 'done'

  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tasks_key_format check (key ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  constraint tasks_no_self_parent check (parent_task_id is null or parent_task_id <> id)
);

create index tasks_category_idx on tasks(category_id);
create index tasks_parent_idx   on tasks(parent_task_id);
create index tasks_status_idx   on tasks(status);

create table task_assignees (
  task_id     uuid not null references tasks(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references profiles(id),
  primary key (task_id, profile_id)
);
create index task_assignees_profile_idx on task_assignees(profile_id);

-- DAG. Cross-category edges are explicitly allowed.
create table task_dependencies (
  task_id            uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  created_at         timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  constraint dep_not_self check (task_id <> depends_on_task_id)
);
create index task_dependencies_reverse_idx on task_dependencies(depends_on_task_id);
```

### 3.5 Comments, activity, notifications, imports — `0005_collab.sql`

```sql
create table task_comments (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references tasks(id) on delete cascade,
  parent_comment_id uuid references task_comments(id) on delete cascade,  -- THREADED
  author_id         uuid not null references profiles(id) on delete cascade,
  body              text not null,
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  deleted_at        timestamptz
);
create index task_comments_task_idx on task_comments(task_id, created_at);

create table comment_mentions (
  comment_id          uuid not null references task_comments(id) on delete cascade,
  mentioned_profile_id uuid not null references profiles(id) on delete cascade,
  primary key (comment_id, mentioned_profile_id)
);

-- Immutable audit trail. Insert-only; no update/delete policy exists.
create table task_activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  actor_id   uuid references profiles(id),
  type       activity_type not null,
  from_value text,
  to_value   text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index task_activity_task_idx on task_activity(task_id, created_at desc);

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type         notification_type not null,
  title        text not null,
  body         text,
  entity_type  text,      -- 'task' | 'profile' | 'comment'
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_recipient_idx on notifications(recipient_id, read_at, created_at desc);

-- Every JSON upload is recorded so an import can be understood after the fact.
create table imports (
  id          uuid primary key default gen_random_uuid(),
  uploaded_by uuid references profiles(id),
  filename    text,
  payload     jsonb not null,
  summary     jsonb not null default '{}'::jsonb,
  dry_run     boolean not null default false,
  created_at  timestamptz not null default now()
);
```

### 3.6 Derived state — `0006_views.sql`

Single source of truth for "is this blocked" and for all progress numbers.

```sql
-- A dependency is satisfied when the upstream task is done or cancelled.
create or replace view task_dependency_state with (security_invoker = on) as
select
  t.id as task_id,
  count(d.depends_on_task_id)                                        as dep_count,
  count(*) filter (where u.status not in ('done','cancelled'))       as unmet_count,
  coalesce(
    array_agg(u.key order by u.key) filter (where u.status not in ('done','cancelled')),
    '{}'
  )                                                                  as blocked_by_keys
from tasks t
left join task_dependencies d on d.task_id = t.id
left join tasks u            on u.id = d.depends_on_task_id
group by t.id;

create or replace view v_tasks with (security_invoker = on) as
select
  t.*,
  c.key   as category_key,
  c.name  as category_name,
  c.color as category_color,
  s.dep_count,
  s.unmet_count,
  s.blocked_by_keys,
  (s.unmet_count > 0)                                      as is_blocked,
  (select count(*) from tasks ch where ch.parent_task_id = t.id)                              as child_count,
  (select count(*) from tasks ch where ch.parent_task_id = t.id and ch.status = 'done')        as child_done_count,
  (select count(*) from task_dependencies d2 where d2.depends_on_task_id = t.id)               as blocks_count
from tasks t
join categories c            on c.id = t.category_id
join task_dependency_state s on s.task_id = t.id;

-- Progress ignores cancelled tasks entirely.
create or replace view category_progress with (security_invoker = on) as
select
  c.id as category_id, c.key, c.name, c.color, c.position,
  count(t.id) filter (where t.status <> 'cancelled')                        as total,
  count(t.id) filter (where t.status = 'done')                              as done,
  count(t.id) filter (where t.status in ('in_progress','in_review'))        as in_flight,
  count(t.id) filter (where t.status = 'todo')                              as todo,
  round(
    100.0 * count(t.id) filter (where t.status = 'done')
    / nullif(count(t.id) filter (where t.status <> 'cancelled'), 0)
  , 1)                                                                       as pct
from categories c
left join tasks t on t.category_id = c.id
group by c.id, c.key, c.name, c.color, c.position;

create or replace view project_progress with (security_invoker = on) as
select
  count(*) filter (where status <> 'cancelled')                 as total,
  count(*) filter (where status = 'done')                       as done,
  count(*) filter (where status in ('in_progress','in_review')) as in_flight,
  count(*) filter (where status = 'todo')                       as todo,
  round(100.0 * count(*) filter (where status = 'done')
        / nullif(count(*) filter (where status <> 'cancelled'), 0), 1) as pct
from tasks;
```

> Every view above is created `with (security_invoker = on)`. Without it a view runs with its **owner's** permissions and silently bypasses RLS on the underlying tables — a `pending` user would be able to read the whole task list through `v_tasks`. This is the single easiest way to leak this database; do not omit it.

---

## 4. Business rules enforced in the database

### 4.1 Dependency gate — the core rule — `0007_rules.sql`

> **A task may not leave `todo` until every task it depends on is `done` (or `cancelled`). A parent task may not become `done` until all of its children are `done` (or `cancelled`).**

```sql
create or replace function enforce_task_transition()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_unmet int;
  v_open_children int;
  v_blockers text;
begin
  if new.status is distinct from old.status then

    -- forward moves require all dependencies satisfied
    if new.status in ('in_progress','in_review','done') then
      select count(*), string_agg(u.key, ', ' order by u.key)
        into v_unmet, v_blockers
      from task_dependencies d
      join tasks u on u.id = d.depends_on_task_id
      where d.task_id = new.id
        and u.status not in ('done','cancelled');

      if v_unmet > 0 then
        raise exception 'Task % is blocked by: %', new.key, v_blockers
          using errcode = 'P0001', hint = 'Complete the upstream tasks first.';
      end if;
    end if;

    -- a parent cannot be completed while children are open
    if new.status = 'done' then
      select count(*) into v_open_children
      from tasks ch
      where ch.parent_task_id = new.id and ch.status not in ('done','cancelled');

      if v_open_children > 0 then
        raise exception 'Task % has % unfinished subtask(s)', new.key, v_open_children
          using errcode = 'P0001';
      end if;
    end if;

    -- timestamps
    if old.status = 'todo' and new.status <> 'todo' and new.started_at is null then
      new.started_at := now();
    end if;
    new.completed_at := case when new.status = 'done' then now() else null end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_enforce_transition
before update on tasks
for each row execute function enforce_task_transition();
```

### 4.2 Cycle prevention

```sql
-- Adding "A depends on B" is illegal if B already reaches A through depends_on edges.
create or replace function prevent_dependency_cycle()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if exists (
    with recursive reach as (
      select new.depends_on_task_id as node
      union
      select d.depends_on_task_id
      from task_dependencies d
      join reach r on d.task_id = r.node
    )
    select 1 from reach where node = new.task_id
  ) then
    raise exception 'Circular dependency detected' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_no_cycle
before insert on task_dependencies
for each row execute function prevent_dependency_cycle();

-- Same idea for the parent tree.
create or replace function prevent_task_tree_cycle()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.parent_task_id is null then return new; end if;
  if exists (
    with recursive up as (
      select new.parent_task_id as node
      union
      select t.parent_task_id from tasks t join up u on t.id = u.node where t.parent_task_id is not null
    )
    select 1 from up where node = new.id
  ) then
    raise exception 'Circular task hierarchy detected' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger tasks_no_tree_cycle
before insert or update of parent_task_id on tasks
for each row execute function prevent_task_tree_cycle();
```

### 4.3 Audit log + notifications

```sql
create or replace function log_task_changes()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if new.status is distinct from old.status then
    insert into task_activity (task_id, actor_id, type, from_value, to_value)
    values (new.id, auth.uid(), 'status_changed', old.status::text, new.status::text);

    -- notify everyone assigned, except the actor
    insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
    select a.profile_id, 'status_changed',
           new.key || ' → ' || new.status::text, new.title, 'task', new.id
    from task_assignees a
    where a.task_id = new.id and a.profile_id <> auth.uid();
  end if;

  if new.note is distinct from old.note then
    insert into task_activity (task_id, actor_id, type, to_value)
    values (new.id, auth.uid(), 'note_updated', new.note);
  end if;

  if new.priority is distinct from old.priority then
    insert into task_activity (task_id, actor_id, type, from_value, to_value)
    values (new.id, auth.uid(), 'priority_changed', old.priority::text, new.priority::text);
  end if;

  -- anything this task was blocking that is now fully unblocked
  if new.status = 'done' and old.status <> 'done' then
    for r in
      select t.id, t.key, t.title
      from task_dependencies d
      join tasks t on t.id = d.task_id
      join task_dependency_state s on s.task_id = t.id
      where d.depends_on_task_id = new.id and s.unmet_count = 0 and t.status = 'todo'
    loop
      insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
      select a.profile_id, 'task_unblocked', r.key || ' is unblocked', r.title, 'task', r.id
      from task_assignees a where a.task_id = r.id;
    end loop;
  end if;

  return new;
end;
$$;

create trigger tasks_log_changes
after update on tasks
for each row execute function log_task_changes();
```

```sql
create or replace function notify_on_assignment()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_task record;
begin
  select key, title into v_task from tasks where id = new.task_id;
  insert into task_activity (task_id, actor_id, type, to_value)
  values (new.task_id, auth.uid(), 'assignee_added', new.profile_id::text);

  if new.profile_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
    values (new.profile_id, 'task_assigned',
            'Assigned: ' || v_task.key, v_task.title, 'task', new.task_id);
  end if;
  return new;
end;
$$;

create trigger task_assignees_notify
after insert on task_assignees
for each row execute function notify_on_assignment();
```

```sql
-- Comment notifications: @mentions first, then other participants (deduped).
create or replace function notify_on_comment()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_task record;
begin
  select key, title into v_task from tasks where id = new.task_id;

  insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
  select distinct p.profile_id, 'comment',
         'New comment on ' || v_task.key, left(new.body, 140), 'task', new.task_id
  from (
    select profile_id from task_assignees where task_id = new.task_id
    union
    select author_id   from task_comments where task_id = new.task_id
  ) p
  where p.profile_id <> new.author_id;

  return new;
end;
$$;

create trigger task_comments_notify
after insert on task_comments
for each row execute function notify_on_comment();

create or replace function notify_on_mention()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_c record;
begin
  select c.body, c.author_id, c.task_id, t.key
    into v_c
  from task_comments c join tasks t on t.id = c.task_id
  where c.id = new.comment_id;

  if new.mentioned_profile_id <> v_c.author_id then
    insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
    values (new.mentioned_profile_id, 'mention',
            'Mentioned on ' || v_c.key, left(v_c.body, 140), 'task', v_c.task_id);
  end if;
  return new;
end;
$$;

create trigger comment_mentions_notify
after insert on comment_mentions
for each row execute function notify_on_mention();
```

### 4.4 The one write path for members — `set_task_status`

Members have **no** `UPDATE` privilege on `tasks`. Status changes go through this RPC, which checks assignment and then lets the trigger enforce the dependency gate.

```sql
create or replace function set_task_status(p_task_id uuid, p_status task_status)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_approved() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not is_admin() and not exists (
    select 1 from task_assignees
    where task_id = p_task_id and profile_id = auth.uid()
  ) then
    raise exception 'You are not assigned to this task' using errcode = '42501';
  end if;

  update tasks set status = p_status where id = p_task_id;
end;
$$;

-- Board reordering within a column (fractional position, no cascade of writes).
create or replace function set_task_position(p_task_id uuid, p_position numeric)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_approved() then raise exception 'Not authorized' using errcode = '42501'; end if;
  update tasks set position = p_position where id = p_task_id;
end;
$$;
```

---

## 5. Row Level Security

`0008_rls.sql`. Enable on every table; **no table is left open**.

```sql
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
```

```sql
-- PROFILES ------------------------------------------------------------------
create policy "own profile always readable"
  on profiles for select using (id = auth.uid());

create policy "approved users see the team"
  on profiles for select using (is_approved());

create policy "admins see everyone (incl. pending)"
  on profiles for select using (is_admin());

create policy "users edit their own display fields"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- role/status/color are protected by a trigger, see note below.

create policy "admins manage profiles"
  on profiles for update using (is_admin());

-- CATEGORIES ----------------------------------------------------------------
create policy "approved read categories" on categories for select using (is_approved());
create policy "admins write categories"  on categories for all    using (is_admin()) with check (is_admin());

-- TASKS ---------------------------------------------------------------------
create policy "approved read tasks" on tasks for select using (is_approved());
create policy "admins write tasks"  on tasks for all    using (is_admin()) with check (is_admin());
-- members never UPDATE tasks directly; they call set_task_status().

-- ASSIGNEES / DEPENDENCIES ---------------------------------------------------
create policy "approved read assignees" on task_assignees for select using (is_approved());
create policy "admins write assignees"  on task_assignees for all    using (is_admin()) with check (is_admin());

create policy "approved read deps" on task_dependencies for select using (is_approved());
create policy "admins write deps"  on task_dependencies for all    using (is_admin()) with check (is_admin());

-- COMMENTS ------------------------------------------------------------------
create policy "approved read comments" on task_comments for select using (is_approved());

create policy "approved write own comments"
  on task_comments for insert with check (is_approved() and author_id = auth.uid());

create policy "edit own comments"
  on task_comments for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "admins moderate comments"
  on task_comments for update using (is_admin());
-- deletion is soft (set deleted_at); no DELETE policy exists.

create policy "approved read mentions"  on comment_mentions for select using (is_approved());
create policy "author writes mentions"
  on comment_mentions for insert with check (
    is_approved() and exists (
      select 1 from task_comments c where c.id = comment_id and c.author_id = auth.uid()
    )
  );

-- ACTIVITY (append-only, written by triggers only) ----------------------------
create policy "approved read activity" on task_activity for select using (is_approved());
-- no insert/update/delete policies: only SECURITY DEFINER triggers write here.

-- NOTIFICATIONS --------------------------------------------------------------
create policy "read own notifications"   on notifications for select using (recipient_id = auth.uid());
create policy "update own notifications" on notifications for update using (recipient_id = auth.uid());

-- IMPORTS --------------------------------------------------------------------
create policy "admins read imports" on imports for select using (is_admin());
```

**Protecting privileged profile columns.** The "users edit their own display fields" policy would otherwise let a member self-promote to admin. Add:

```sql
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

create trigger profiles_guard before update on profiles
for each row execute function guard_profile_columns();
```

### 5.1 Realtime

```sql
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_comments;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table task_assignees;
alter publication supabase_realtime add table profiles;
```

Client subscriptions (`lib/realtime.ts`):

| Channel         | Filter                       | Effect                                                                                     |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `notifications` | `recipient_id=eq.<me>`       | Bump the bell, toast, invalidate `['notifications']`.                                      |
| `tasks`         | none                         | Invalidate `['tasks']`, `['progress']`, `['graph']`. Blocked-state recomputes server-side. |
| `task_comments` | `task_id=eq.<open task>`     | Live thread on the open task only.                                                         |
| `profiles`      | `status=eq.pending` (admins) | Live approval queue.                                                                       |

Realtime respects RLS, so a `pending` user's socket receives nothing.

---

## 6. JSON bulk import

The single most important admin feature: one file defines the whole implementation plan — categories, the task tree, who is assigned, and what depends on what.

### 6.1 File format (`version: 1`)

```json
{
  "version": 1,
  "mode": "upsert",
  "members": [
    { "email": "abdulmoizzzzzz10@gmail.com", "title": "Lead", "color": "violet", "role": "admin" },
    { "email": "dev2@example.com", "title": "ML", "color": "emerald" }
  ],
  "categories": [
    {
      "key": "ml-pipeline",
      "name": "ML Signal Pipeline",
      "color": "violet",
      "icon": "brain",
      "position": 1
    },
    {
      "key": "strategy-builder",
      "name": "Strategy Builder",
      "color": "blue",
      "icon": "workflow",
      "position": 2
    },
    {
      "key": "backtesting",
      "name": "Backtesting Engine",
      "color": "cyan",
      "icon": "activity",
      "position": 3
    },
    {
      "key": "platform",
      "name": "Platform & Infra",
      "color": "slate",
      "icon": "server",
      "position": 4
    }
  ],
  "tasks": [
    {
      "key": "PLT-01",
      "category": "platform",
      "title": "Provision Postgres + Redis and wire migrations",
      "description": "Managed Postgres, Upstash Redis, migration runner in CI.",
      "note": "Use the shared staging credentials in 1Password, do not create new ones.",
      "status": "todo",
      "priority": "critical",
      "assignees": ["abdulmoizzzzzz10@gmail.com"],
      "depends_on": [],
      "position": 1,
      "start_date": "2026-09-01",
      "due_date": "2026-09-05",
      "estimate_hours": 8
    },
    {
      "key": "ML-01",
      "category": "ml-pipeline",
      "title": "Feature store: 4-stage pipeline scaffold",
      "assignees": ["dev2@example.com"],
      "depends_on": ["PLT-01"],
      "priority": "high",
      "position": 1
    },
    {
      "key": "ML-01-A",
      "category": "ml-pipeline",
      "parent": "ML-01",
      "title": "Stage 1 — raw OHLCV ingestion",
      "assignees": ["dev2@example.com"],
      "depends_on": [],
      "position": 1
    },
    {
      "key": "BT-01",
      "category": "backtesting",
      "title": "Walk-forward runner",
      "assignees": ["dev2@example.com", "abdulmoizzzzzz10@gmail.com"],
      "depends_on": ["ML-01", "PLT-01"],
      "priority": "high",
      "position": 1
    }
  ]
}
```

**Field reference**

| Field                                              | Required              | Notes                                                                                                                                                     |
| -------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`                                          | ✅                    | Must be `1`. Rejected otherwise.                                                                                                                          |
| `mode`                                             | —                     | `"upsert"` (default). `"sync"` additionally cancels tasks in the touched categories that are absent from the file — never deletes, only sets `cancelled`. |
| `members[].email`                                  | ✅ (if block present) | Must match an **existing** profile. Import cannot create auth users — people must sign in with Google first. Unknown emails become warnings, not errors.  |
| `members[].color`                                  | —                     | Palette token (§7.1). Overrides the auto-assigned colour.                                                                                                 |
| `categories[].key`                                 | ✅                    | Lowercase slug. Stable identity across re-imports.                                                                                                        |
| `tasks[].key`                                      | ✅                    | Uppercase ref, e.g. `ML-01`. **The stable identity** — re-importing the same key updates rather than duplicates.                                          |
| `tasks[].category`                                 | ✅                    | Must match a `categories[].key` (in this file or already in the DB).                                                                                      |
| `tasks[].parent`                                   | —                     | A task `key`. Builds the tree. Forward references allowed (resolved in pass C).                                                                           |
| `tasks[].assignees`                                | —                     | Array of emails. **Multiple assignees per task supported.** Replaces the current set.                                                                     |
| `tasks[].depends_on`                               | —                     | Array of task keys. **Multiple, cross-category allowed.** Replaces the current set. Cycles are rejected.                                                  |
| `tasks[].status`                                   | —                     | Default `todo`. A status that violates the dependency gate is rejected by the trigger.                                                                    |
| `tasks[].priority`                                 | —                     | `low`\|`medium`\|`high`\|`critical`. Default `medium`.                                                                                                    |
| `tasks[].position`                                 | —                     | Ordering within a board column. Default `1000`.                                                                                                           |
| `tasks[].start_date`, `due_date`, `estimate_hours` | —                     | **Stored, not displayed in v1.** Reserved for §12.                                                                                                        |

### 6.2 Import pipeline

```
upload .json
  → Zod parse            (lib/schemas/import.ts)      — shape, enums, key formats
  → static plan          (lib/import/plan.ts)         — duplicate keys, unknown category/parent/dep refs,
                                                        dependency cycles (Kahn's algorithm), tree cycles
  → preview_import RPC   (read-only)                  — new vs updated counts, unknown emails,
                                                        tasks whose declared status breaks the gate
  → admin reviews the diff and confirms
  → import_workspace RPC (single transaction)         — all-or-nothing
```

Cycle detection runs client-side **before** hitting the DB so the admin sees the offending chain (`ML-01 → BT-01 → ML-01`) rather than a bare Postgres error.

### 6.3 `import_workspace` — `0009_import.sql`

```sql
create or replace function import_workspace(p_payload jsonb, p_filename text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item jsonb; v_email text; v_dep text;
  v_cat_id uuid; v_task_id uuid; v_pid uuid; v_ins boolean;
  v_cats_new int := 0; v_cats_upd int := 0;
  v_tasks_new int := 0; v_tasks_upd int := 0;
  v_warnings jsonb := '[]'::jsonb;
  v_summary jsonb;
begin
  if not is_admin() then
    raise exception 'Only admins can import' using errcode = '42501';
  end if;
  if coalesce((p_payload->>'version')::int, 0) <> 1 then
    raise exception 'Unsupported payload version' using errcode = 'P0001';
  end if;

  ---------------------------------------------------------------- members
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'members','[]'::jsonb)) loop
    update profiles
       set title = coalesce(v_item->>'title', title),
           color = coalesce(v_item->>'color', color)
     where lower(email) = lower(v_item->>'email')
     returning id into v_pid;
    if v_pid is null then
      v_warnings := v_warnings || jsonb_build_object(
        'level','warning','message','No profile for ' || (v_item->>'email') || ' — they must sign in first');
    end if;
    v_pid := null;
  end loop;

  ------------------------------------------------------------- categories
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'categories','[]'::jsonb)) loop
    insert into categories (key, name, description, color, icon, position)
    values (v_item->>'key', v_item->>'name', v_item->>'description',
            coalesce(v_item->>'color','slate'), v_item->>'icon',
            coalesce((v_item->>'position')::numeric, 1000))
    on conflict (key) do update
       set name        = excluded.name,
           description = coalesce(excluded.description, categories.description),
           color       = excluded.color,
           icon        = coalesce(excluded.icon, categories.icon),
           position    = excluded.position
    returning (xmax = 0) into v_ins;
    if v_ins then v_cats_new := v_cats_new + 1; else v_cats_upd := v_cats_upd + 1; end if;
  end loop;

  --------------------------------------------------- pass A: tasks (flat)
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) loop
    select id into v_cat_id from categories where key = v_item->>'category';
    if v_cat_id is null then
      raise exception 'Unknown category "%" referenced by task %',
        v_item->>'category', v_item->>'key' using errcode = 'P0001';
    end if;

    insert into tasks (key, category_id, title, description, note, status, priority, position,
                       start_date, due_date, estimate_hours, created_by)
    values (
      v_item->>'key', v_cat_id, v_item->>'title', v_item->>'description', v_item->>'note',
      coalesce((v_item->>'status')::task_status, 'todo'),
      coalesce((v_item->>'priority')::task_priority, 'medium'),
      coalesce((v_item->>'position')::numeric, 1000),
      nullif(v_item->>'start_date','')::date,
      nullif(v_item->>'due_date','')::date,
      nullif(v_item->>'estimate_hours','')::numeric,
      auth.uid()
    )
    on conflict (key) do update
       set category_id    = excluded.category_id,
           title          = excluded.title,
           description    = coalesce(excluded.description, tasks.description),
           note           = coalesce(excluded.note, tasks.note),
           priority       = excluded.priority,
           position       = excluded.position,
           start_date     = coalesce(excluded.start_date, tasks.start_date),
           due_date       = coalesce(excluded.due_date, tasks.due_date),
           estimate_hours = coalesce(excluded.estimate_hours, tasks.estimate_hours)
           -- status is deliberately NOT overwritten on update: work in flight wins over the file
    returning id, (xmax = 0) into v_task_id, v_ins;
    if v_ins then v_tasks_new := v_tasks_new + 1; else v_tasks_upd := v_tasks_upd + 1; end if;
  end loop;

  ------------------------------------------------ pass B: parent tree links
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) loop
    if v_item ? 'parent' and v_item->>'parent' is not null then
      update tasks child
         set parent_task_id = parent.id
        from tasks parent
       where child.key = v_item->>'key' and parent.key = v_item->>'parent';
    end if;
  end loop;

  ---------------------------------------------------- pass C: assignees (delta)
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) loop
    if v_item ? 'assignees' then
      select id into v_task_id from tasks where key = v_item->>'key';

      delete from task_assignees ta
       where ta.task_id = v_task_id
         and ta.profile_id not in (
           select p.id from profiles p
           where lower(p.email) in (
             select lower(x) from jsonb_array_elements_text(v_item->'assignees') as x
           )
         );

      for v_email in select jsonb_array_elements_text(v_item->'assignees') loop
        select id into v_pid from profiles where lower(email) = lower(v_email);
        if v_pid is null then
          v_warnings := v_warnings || jsonb_build_object(
            'level','warning',
            'message', 'Task ' || (v_item->>'key') || ': no profile for ' || v_email || ' — skipped');
        else
          insert into task_assignees (task_id, profile_id, assigned_by)
          values (v_task_id, v_pid, auth.uid())
          on conflict do nothing;
        end if;
      end loop;
    end if;
  end loop;

  -------------------------------------------------- pass D: dependencies (delta)
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) loop
    if v_item ? 'depends_on' then
      select id into v_task_id from tasks where key = v_item->>'key';

      delete from task_dependencies d
       where d.task_id = v_task_id
         and d.depends_on_task_id not in (
           select t.id from tasks t
           where t.key in (select x from jsonb_array_elements_text(v_item->'depends_on') as x)
         );

      for v_dep in select jsonb_array_elements_text(v_item->'depends_on') loop
        select id into v_pid from tasks where key = v_dep;
        if v_pid is null then
          raise exception 'Task % depends on unknown task %', v_item->>'key', v_dep
            using errcode = 'P0001';
        end if;
        insert into task_dependencies (task_id, depends_on_task_id)
        values (v_task_id, v_pid)
        on conflict do nothing;   -- cycle trigger fires here and aborts the whole import
      end loop;
    end if;
  end loop;

  ------------------------------------------------------------------ summary
  v_summary := jsonb_build_object(
    'categories_created', v_cats_new, 'categories_updated', v_cats_upd,
    'tasks_created',      v_tasks_new,'tasks_updated',      v_tasks_upd,
    'warnings',           v_warnings
  );

  insert into imports (uploaded_by, filename, payload, summary)
  values (auth.uid(), p_filename, p_payload, v_summary);

  insert into task_activity (task_id, actor_id, type, metadata)
  select t.id, auth.uid(), 'imported', jsonb_build_object('filename', p_filename)
  from tasks t
  where t.key in (select x->>'key' from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) as x);

  return v_summary;
end;
$$;
```

A companion `preview_import(p_payload jsonb)` runs the same reference checks **read-only** and returns the same summary shape with `would_create` / `would_update` counts. Build it by copying the function and replacing every write with a `select` — or simply call `import_workspace` inside a transaction the Server Action rolls back (Supabase's `pg` pooler does not expose that, so write the read-only twin).

### 6.4 TypeScript schema (`lib/schemas/import.ts`)

```ts
import { z } from 'zod';

export const COLORS = [
  'violet',
  'blue',
  'cyan',
  'teal',
  'emerald',
  'lime',
  'amber',
  'orange',
  'rose',
  'pink',
  'fuchsia',
  'slate',
] as const;

const taskKey = z.string().regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Keys look like ML-01 or ML-01-A');
const catKey = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const importSchema = z
  .object({
    version: z.literal(1),
    mode: z.enum(['upsert', 'sync']).default('upsert'),
    members: z
      .array(
        z.object({
          email: z.string().email(),
          title: z.string().optional(),
          color: z.enum(COLORS).optional(),
          role: z.enum(['admin', 'member']).optional(),
        }),
      )
      .optional(),
    categories: z
      .array(
        z.object({
          key: catKey,
          name: z.string().min(1),
          description: z.string().optional(),
          color: z.enum(COLORS).default('slate'),
          icon: z.string().optional(),
          position: z.number().optional(),
        }),
      )
      .default([]),
    tasks: z
      .array(
        z.object({
          key: taskKey,
          category: catKey,
          parent: taskKey.optional().nullable(),
          title: z.string().min(1),
          description: z.string().optional(),
          note: z.string().optional(),
          status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']).default('todo'),
          priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
          assignees: z.array(z.string().email()).default([]),
          depends_on: z.array(taskKey).default([]),
          position: z.number().optional(),
          start_date: z.string().date().optional(),
          due_date: z.string().date().optional(),
          estimate_hours: z.number().positive().optional(),
        }),
      )
      .default([]),
  })
  .superRefine((v, ctx) => {
    const keys = new Set<string>();
    for (const t of v.tasks) {
      if (keys.has(t.key)) ctx.addIssue({ code: 'custom', message: `Duplicate task key ${t.key}` });
      keys.add(t.key);
    }
    // unknown parent / dependency references, and cycle detection, live in lib/import/plan.ts
  });

export type ImportPayload = z.infer<typeof importSchema>;
```

---

## 7. UI / UX specification

Design goal, stated plainly: **a person should be able to look at any task card for one second and know whose it is, which part of the product it belongs to, and whether they can start it.** Three signals, three separate visual channels — never all encoded in colour.

| Signal              | Channel                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Who**             | Person colour badge — a filled circle with initials, in that person's palette colour. Multiple assignees stack as overlapping avatars (max 3 + "+2").                                                  |
| **Which area**      | Category — a 3px coloured left border on the card plus a small text chip. Colour is category colour.                                                                                                   |
| **Can I start it?** | Shape/iconography, not colour: an open dot = ready, a **lock icon + dashed border** = blocked, a spinner-ish half circle = in progress, a check = done. Blocked cards are also reduced to 70% opacity. |
| **Urgency**         | Priority — a thin coloured bar on the card's left edge only for `high`/`critical`, plus a `!` glyph for critical.                                                                                      |

### 7.1 Colour system (`lib/colors.ts`)

Store the **token**, never a hex value, so light/dark themes and future palette tweaks are one file.

```ts
export const PALETTE = {
  violet: {
    badge: 'bg-violet-500  text-white',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    border: 'border-l-violet-500',
    dot: 'bg-violet-500',
  },
  blue: {/* … */},
  cyan: {},
  teal: {},
  emerald: {},
  lime: {},
  amber: {},
  orange: {},
  rose: {},
  pink: {},
  fuchsia: {},
  slate: {},
} as const;
export type ColorToken = keyof typeof PALETTE;
```

Rules: every badge carries **initials as text**, so colour-blind users and greyscale printouts still work. Contrast ≥ 4.5:1 in both themes. The twelve tokens are chosen to be distinguishable under deuteranopia — that is why there is no red/green pair adjacent in the list.

### 7.2 Pages

**`/login`** — single "Continue with Google" button, product name, one line of context. Nothing else.

**`/pending`** — where an unapproved user lands. Shows their name/avatar, "Your request is with the admin", and a live-updating state (Realtime on their own `profiles` row) so approval flips them into the app without a refresh. Middleware redirects any `pending` user here from every other route.

**`/board`** (default landing page for members)

- Columns: `To Do` · `In Progress` · `In Review` · `Done`. `Cancelled` is hidden behind a toggle.
- **Drag to change status** via `@dnd-kit`. On drop: optimistic move → `set_task_status` RPC → on error, snap back and show the exact blocker message from Postgres ("Blocked by ML-01, PLT-01"). Blocked cards are `draggable: false` with a tooltip listing blockers.
- Swimlane toggle: **flat** or **grouped by category**.
- Top filter bar (shared component with the list): category multi-select, assignee multi-select (avatar chips), priority, "only mine", "hide blocked", text search.
- A subtask card shows a small `⤷ parent-key` breadcrumb; parent cards show `3/5 subtasks`.
- Column headers show live counts.

**`/tasks`** — filterable table (`@tanstack/react-table`)

- Columns: key · title (indented by tree depth, expandable) · category chip · assignees · status · priority · blocked-by · updated.
- Same filter bar as the board, plus sort on any column and URL-persisted filter state (shareable links).
- Row click opens the task detail as a side sheet; deep link `/tasks/[key]` renders it full-page.

**`/tasks/[key]`** — task detail

- Header: key, title, category chip, status control (dropdown; disabled with reason when blocked).
- **Admin note** rendered in a distinct callout box ("Note from admin") at the top — this is the message you write for assignees, so it must be impossible to miss.
- Assignees row of colour badges; admin can add/remove inline.
- **Dependencies panel**: "Blocked by" list (each with a live status pill) and "Blocks" list. Clicking navigates.
- **Subtasks** list with inline status.
- **Comments**: threaded, one level of nesting, newest-last. `@` opens a member picker; on submit the mentions are written to `comment_mentions` in the same Server Action so the notification trigger fires.
- **Activity**: reverse-chronological audit trail — "Ali moved this from To Do → In Progress · 2 Sep, 14:02". This is the status-change-with-dates record.

**`/graph`** — dependency graph

- React Flow, nodes = tasks, edges = `depends_on` (arrow points from prerequisite → dependent). Auto-layout left-to-right with `dagre`.
- Node fill = category colour; node border = status (grey todo, blue in-progress, green done); blocked nodes get a lock icon.
- Filters: by category, "critical path only" (nodes with the longest chain), "show subtasks".
- Clicking a node opens the task sheet. This is also the fastest way to _understand_ a JSON import you just uploaded.

**`/tracker`** — completion tracker

- Big project ring: `done / total` with percentage from `project_progress`.
- Per-category rows from `category_progress`: name, coloured progress bar, `12/20 · 60%`, and a stacked mini-bar of todo/in-flight/done.
- Per-person section: tasks assigned, completed, in flight — each row led by that person's colour badge.
- A "blocked right now" panel listing every blocked task and what is blocking it, sorted by how many tasks each blocker unblocks. **This is the highest-value screen for you as admin** — it tells you exactly which task to push on next.

**`/notifications`** — grouped list (today / earlier), mark-one and mark-all-read, click-through to the entity. A bell in the app shell shows the unread count via Realtime.

**`/admin/people`** — pending requests at the top with Approve / Approve as admin / Reject. Below, the team table: colour badge (editable via a palette popover), name, email, role, title, task counts.

**`/admin/categories`** — CRUD, drag to reorder, colour + icon picker.

**`/admin/import`** — drop a `.json` file → parse errors shown inline with line context → **dry-run diff** (`+ 12 new tasks · ~ 4 updated · 2 warnings`) with an expandable per-task list → Confirm import. Below it, the import history from `imports`, each with its summary.

### 7.3 Shell and interaction details

- Left sidebar: Board · Tasks · Graph · Tracker · (admin) People · Categories · Import. Bell + avatar top-right.
- Keyboard: `/` focus search, `b`/`l`/`g`/`t` jump to views, `j`/`k` move selection, `Esc` close sheet.
- Every mutation is optimistic with a rollback toast carrying the server's real error message.
- Empty states are instructive, not decorative: an empty board links straight to `/admin/import` with a "download example JSON" button.
- Dark mode from day one — the palette is defined in both themes, so this is free.

---

## 8. Deployment

### 8.1 Supabase

1. Create two projects: `entropable-workspace-dev` and `entropable-workspace-prod` (a free-tier dev project keeps preview deployments off production data).
2. **Auth → Providers → Google**: enable, paste the Google OAuth client ID/secret.
   - Google Cloud Console → OAuth consent screen (External, or Internal if you use Workspace) → Credentials → OAuth client (Web).
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Auth → URL Configuration**:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: add `http://localhost:3000/**` and `https://*-<your-vercel-scope>.vercel.app/**` so preview deployments can log in.
4. Seed the bootstrap admin **before** first login:
   ```sql
   insert into bootstrap_admins (email) values ('abdulmoizzzzzz10@gmail.com');
   ```
5. `supabase link --project-ref <ref> && supabase db push`.

### 8.2 Vercel

- Import the repo, framework preset Next.js, Node 20+, build `pnpm build`.
- Environment variables:

| Variable                        | Scope | Notes                                                                       |
| ------------------------------- | ----- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | all   | Per-environment value.                                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all   | Safe to expose — RLS is the guard.                                          |
| `NEXT_PUBLIC_SITE_URL`          | all   | Used to build the OAuth `redirectTo`. On previews set it from `VERCEL_URL`. |

There is intentionally **no** `SUPABASE_SERVICE_ROLE_KEY` in Vercel. If one is ever added, it belongs to a route handler only and must never be imported into a component tree.

- `middleware.ts` refreshes the Supabase session cookie on every request and enforces the gate:
  ```
  no session          → /login
  session + pending   → /pending
  session + approved  → through
  non-admin → /admin/* → /board
  ```
  Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and image extensions.
- Runtime: **Node.js**, not Edge (the Supabase SSR client and cookie handling are simplest there). Dashboard pages are dynamic — set `export const dynamic = 'force-dynamic'` on authenticated routes so nothing is cached across users.
- Vercel Analytics on; Speed Insights optional.

### 8.3 Migrations in CI

GitHub Action on push to `main`: `supabase db push --db-url $SUPABASE_DB_URL` before Vercel's build finishes, then `supabase gen types typescript --linked > src/types/database.ts` in a check job that fails if the committed types are stale.

### 8.4 Local development

```bash
pnpm i
supabase start                 # local Postgres + Auth + Studio
supabase db reset              # applies migrations + seed
pnpm dev
```

Google OAuth does not work against local Supabase without a tunnel; for local work seed a user directly and use `supabase.auth.signInWithPassword` behind a `NEXT_PUBLIC_DEV_LOGIN=true` flag that is never enabled in production.

---

## 9. Build phases

| Phase                 | Deliverable                                                                                                          | Done when                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **0 — Foundation**    | Next.js + Tailwind + shadcn scaffold, Supabase project, migrations `0001`–`0008`, generated types, middleware gate.  | `supabase db push` succeeds and RLS blocks an anonymous `select` on `tasks`.                                                   |
| **1 — Access**        | Google login, `/pending`, admin approval queue, notification bell, Realtime approval flip.                           | A second Google account can sign in, appears in your queue, and gains access on approval without a refresh.                    |
| **2 — Data in**       | Categories admin, JSON import (Zod → plan → preview → `import_workspace`), import history.                           | The example seed file imports cleanly and a cyclic file is rejected with a readable chain.                                     |
| **3 — Work surfaces** | Board with drag-to-status + dependency gate, filterable list, task detail with note/assignees/dependencies/subtasks. | Dragging a blocked task is refused with the blocker names; completing its blocker makes it draggable within one Realtime tick. |
| **4 — Collaboration** | Threaded comments, @mentions, notifications, full activity/audit timeline.                                           | A mention notifies only the mentioned person; every status change is in the timeline with actor + timestamp.                   |
| **5 — Visibility**    | Tracker page (project + category + per-person + blocked panel), dependency graph.                                    | Numbers on the tracker match a manual `count(*)`; the graph renders the seed file's DAG correctly.                             |
| **6 — Hardening**     | Playwright e2e for the four critical paths, empty states, keyboard shortcuts, dark mode polish, error boundaries.    | e2e green in CI.                                                                                                               |

Critical e2e paths: (1) pending user sees nothing, (2) drag blocked task → refused, (3) unblock → drag succeeds → activity logged, (4) member cannot mutate a task they are not assigned to (direct RPC call in the test, not just UI).

---

## 10. Deferred features (schema is ready — do not build in v1)

These are listed so the data model does not have to change when you get to them.

| Feature                                         | What already exists                                            | What is still needed                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Calendar / timeline view**                    | `start_date`, `due_date` on `tasks`                            | A month/Gantt component; no schema change.                                                                   |
| **Time tracking**                               | `estimate_hours`, `actual_hours`, `started_at`, `completed_at` | A `time_entries` table if you want per-session logging; otherwise just UI.                                   |
| **Burndown & velocity**                         | `task_activity` holds every dated status change                | A snapshot view aggregating activity by day; no schema change.                                               |
| **Overdue flags & reminders**                   | `due_date`                                                     | A `pg_cron` job inserting `notifications`; add a `deadline_reminder` enum value.                             |
| **Email / Slack notifications**                 | `notifications` table                                          | A Supabase Edge Function on insert + a `notification_channels` preference table.                             |
| **File attachments**                            | —                                                              | Supabase Storage bucket + `task_attachments` table with RLS mirroring `tasks`.                               |
| **Saved views**                                 | filters already URL-encoded                                    | `saved_views(profile_id, name, query)`.                                                                      |
| **Task templates / recurring tasks**            | `imports.payload` is effectively a template store              | A `templates` table plus a "clone subtree" RPC.                                                              |
| **Workload balancing**                          | `task_assignees` + `estimate_hours`                            | A per-person load view; no schema change.                                                                    |
| **Multi-project**                               | single workspace                                               | `projects` table + `project_id` on `categories`, `tasks`; extend `is_approved()` to `is_member_of(project)`. |
| **Public read-only status page**                | `category_progress`, `project_progress`                        | An anon-readable view exposing only aggregates, plus a policy for the `anon` role.                           |
| **Copy/clone of a category with its task tree** | tree + DAG in place                                            | A recursive `clone_category(key)` RPC.                                                                       |
| **AI progress agent**                           | `tasks.key`, `task_activity`, `task_comments`                  | See §10.1 — the largest deferred item, described separately.                                                 |

### 10.1 AI progress agent (deferred — description only)

**What it is.** An LLM agent wired into the workspace that can answer "where does this task actually stand?" by looking at the code, not by asking the person. It has read access to two bodies of context: the **project foundation documents** (`APPLICATION_OVERVIEW.md`, `SERVICES_STRATEGY.md`, this document, any architecture or spec docs in the repo) and the **GitHub history** (commits, diffs, PRs, branch names, file paths). Given a task, it correlates the two and reports.

**What it produces.**

- **Per-task status report.** For a selected task, the agent pulls the commits plausibly related to it, summarises what changed in plain language ("the walk-forward runner now handles multi-asset splits; the CPCV path is stubbed"), estimates how much of the task's stated scope is actually covered by the code, and flags the gap between the task's declared status and what the commits suggest. This is the point of the feature: a task sitting in `In Progress` for three weeks with two commits reads very differently from one with thirty.
- **Conversational drill-down.** The report is a starting point, not the end. The user can ask follow-ups in a thread on the task — "which files changed?", "did this touch the risk engine?", "is the test coverage real or scaffolding?", "what's left before this can be marked done?" — and the agent answers from the same context.
- **Performance and throughput views.** Aggregated across tasks and people: cycle time from first commit to `done`, how often declared status leads or lags the code, which categories are churning (repeated commits to the same files after a task was closed), and where the work is actually concentrated versus where it was assigned. Framed as _signal for unblocking work_, not as individual surveillance — a metric that gets used to rank people stops being an honest metric very quickly, and the reports should be phrased and permissioned accordingly.
- **Category and project-level rollups.** The same analysis one level up: what a whole category has really delivered, and a narrative summary of project state suitable for pasting into an update.

**How tasks get linked to commits.** Three mechanisms, in order of reliability:

1. **Convention.** Commit messages and branch names carry the task key (`ML-01: add stage-1 ingestion`, `feat/BT-01-walkforward`). Cheap, exact, and the reason `tasks.key` is a short uppercase ref in the v1 schema rather than a UUID — the convention is already possible today, so start using it now even though nothing reads it yet.
2. **Path heuristics.** A `task_code_paths` mapping (task or category → globs) so commits touching `src/ml/**` are candidates for ML tasks even when the message has no key.
3. **Semantic fallback.** Embed task titles/descriptions and commit messages/diff summaries, and match by similarity for anything the first two miss. Every inferred link is shown as _inferred_ with a confidence, never silently asserted.

**Shape of the implementation.**

- `github_installation` / `repositories` tables plus a GitHub App (not a PAT) with read-only `contents` and `metadata` scope. Webhook on `push` and `pull_request` into a Supabase Edge Function.
- `commits` table (sha, message, author, authored_at, files changed, additions/deletions, PR number) and `task_commits` (task_id, sha, link_source `convention|path|semantic`, confidence).
- `documents` table + `pgvector` for the foundation docs, chunked and embedded, so the agent grounds its reading of the code in what the project was supposed to be. This mirrors the RAG setup already in Entropable itself, so the pattern is familiar.
- `agent_reports` (task_id, kind, body, model, input_refs jsonb, created_at) — every report is stored, so reports are diffable over time and the agent's past claims stay auditable. `agent_threads` / `agent_messages` for the drill-down conversation.
- Generation is **on demand and cached**, not on every commit: a "Generate report" button on the task detail, plus an optional weekly rollup. Diff summarisation is the expensive part — summarise each commit once at ingest, then reason over summaries rather than re-reading diffs per question.
- Model routing: a cheap fast model for per-commit summarisation, a stronger one for the correlation and the conversational answers.

**Non-negotiables when it does get built.**

- **Every claim cites its evidence.** A report line links the commits it came from. An agent that says "this looks 80% done" without showing why is worse than no agent, because it will be believed.
- **The agent never changes task status.** It proposes ("this looks complete — mark done?"); a human decides. Auto-advancing status on a commit heuristic corrupts the one record you rely on.
- **Reports are advisory and labelled as such.** They live beside the human activity log, never inside it — `task_activity` stays a record of what people actually did.
- **RLS applies to reports exactly as it does to tasks**, and the repository token is scoped read-only. The agent inherits the caller's visibility; it does not become a way to read things the caller otherwise could not.

---

## 11. Full prompt for Claude Code

Save this document as `IMPLEMENTATION.md` in the repo root, then start Claude Code in that directory and paste the prompt below. It is written to be handed over in one shot; Claude Code should read the document rather than have it re-pasted.

```text
You are building an internal implementation-workspace app from scratch. The complete
specification is in IMPLEMENTATION.md in the repo root. READ IT FULLY BEFORE WRITING
ANY CODE, and treat it as the source of truth. Where the spec is silent, choose the
simplest option consistent with the rest of it and note the choice in DECISIONS.md.

PRODUCT IN ONE PARAGRAPH
A single-workspace task manager for driving the Entropable crypto trading platform
build. One admin defines categories and a tree of tasks (usually via a JSON bulk
upload), assigns one or more people to each task, and attaches a note to each task.
Team members sign in with Google, wait for the admin to approve them, then see the
categories and their assigned tasks and update task status by dragging cards on a
board. Tasks can depend on other tasks (many-to-many, across categories); a task
cannot leave "todo" until every task it depends on is done. Everyone can see a
dependency graph and a tracker page showing per-category and whole-project completion.

STACK (do not substitute)
- Next.js 15 App Router, React 19, TypeScript strict, pnpm
- Tailwind CSS v4 + shadcn/ui + next-themes (dark mode from the start)
- Supabase: Postgres, Auth (Google only), Realtime. Client via @supabase/supabase-js
  and @supabase/ssr. Migrations as SQL files under supabase/migrations/.
- TanStack Query v5, @dnd-kit/core + sortable, @xyflow/react + dagre,
  @tanstack/react-table, zod, react-hook-form, date-fns, lucide-react, recharts
- Vitest for unit tests, Playwright for e2e

NON-NEGOTIABLE ARCHITECTURE RULES
1. Row Level Security is the ONLY authorization layer. Every table has RLS enabled and
   explicit policies. Assume a hostile client calling the REST API directly. UI checks
   are cosmetic.
2. Do NOT use the service role key anywhere in the app. All privileged operations are
   SECURITY DEFINER Postgres functions with an internal permission check.
3. Business rules live in the database as triggers/functions, not only in TypeScript:
   the dependency gate, parent/child completion rule, cycle prevention, the audit log,
   and notification fan-out are all database-enforced.
4. Reads happen in Server Components; writes happen in Server Actions. Actions that
   carry business rules call an RPC.
5. Realtime is used ONLY to invalidate TanStack Query caches. Never authorize or render
   directly from a realtime payload.
6. Views are created with (security_invoker = on).
7. Derived state (is_blocked, progress counts) is computed in SQL views so the board,
   list, graph and tracker can never disagree.

WHAT TO BUILD, IN THIS ORDER (commit at the end of each phase, one phase per commit)

PHASE 0 — Foundation
- Scaffold the Next.js app with the folder structure in IMPLEMENTATION.md §2.
- Write migrations 0001-0008 exactly as specified in §3, §4 and §5: enums, profiles +
  bootstrap_admins + handle_new_user trigger, categories, tasks (tree) + task_assignees
  + task_dependencies, comments/mentions/activity/notifications/imports, the views, the
  transition/cycle/audit triggers, set_task_status and set_task_position RPCs, and all
  RLS policies including the guard_profile_columns trigger.
- Generate src/types/database.ts from the schema.
- Implement lib/supabase/{server,client,middleware}.ts and middleware.ts with the gate:
  no session -> /login; pending -> /pending; non-admin hitting /admin/* -> /board.
- Verify: an anonymous PostgREST select on tasks returns zero rows.

PHASE 1 — Access
- /login with a single "Continue with Google" button and /auth/callback route handler.
- /pending page that subscribes to the signed-in user's own profiles row and redirects
  into the app the moment status flips to approved.
- App shell: sidebar nav, theme toggle, avatar menu, notification bell with unread count
  driven by a Realtime subscription on notifications filtered to recipient_id.
- /admin/people: pending requests with Approve / Approve as admin / Reject (approve_member
  RPC), and the team table with an editable colour badge.

PHASE 2 — Data in
- /admin/categories CRUD with drag-to-reorder and a colour+icon picker.
- lib/schemas/import.ts (the Zod schema in §6.4) and lib/import/plan.ts, which resolves
  references and detects dependency cycles with Kahn's algorithm, reporting the offending
  chain in human-readable form (e.g. "ML-01 -> BT-01 -> ML-01").
- Migration 0009 with import_workspace plus a read-only preview_import twin.
- /admin/import: file drop -> Zod errors inline -> dry-run diff summary -> confirm ->
  import. Show import history from the imports table.
- Write supabase/seed/entropable.seed.json with roughly 6 categories and 30 tasks that
  exercise every feature: subtasks, multi-assignee, cross-category dependencies, all
  priorities, and populated date/estimate fields.
- Unit-test the parser and cycle detector with Vitest.

PHASE 3 — Work surfaces
- /board: dnd-kit columns To Do / In Progress / In Review / Done. Dropping calls
  set_task_status optimistically; on a Postgres error, revert and surface the exact
  message ("Task BT-01 is blocked by: ML-01, PLT-01") in a toast. Blocked cards are not
  draggable and show a lock chip listing blockers on hover. Swimlane toggle groups by
  category. Column headers show live counts.
- A shared FilterBar component (category, assignee, priority, only-mine, hide-blocked,
  search) whose state lives in the URL.
- /tasks: TanStack Table with tree indentation and expandable parents, sortable columns,
  the same FilterBar, row click opens a task sheet.
- /tasks/[key]: full detail per §7.2 — the admin note in a prominent callout, assignee
  colour badges, "Blocked by" and "Blocks" panels with live status pills, subtask list,
  and admin-only inline editing of every field.
- Card design per §7: category colour as a left border + chip, assignees as stacked
  initial badges in their own colours, blocked state shown by a lock icon and dashed
  border (never by colour alone), priority as an edge bar for high/critical only.

PHASE 4 — Collaboration
- Threaded comments (one nesting level) on the task detail, with an @-mention picker.
  The Server Action inserts the comment and its comment_mentions rows together so the
  notification triggers fire.
- /notifications page grouped by today/earlier with mark-read actions.
- Activity timeline on the task detail rendering task_activity in reverse order, with
  actor colour badge and formatted timestamp.

PHASE 5 — Visibility
- /tracker: overall completion ring from project_progress; per-category rows from
  category_progress with stacked todo/in-flight/done bars; a per-person section; and a
  "Blocked right now" panel listing blocked tasks sorted by how many tasks each blocker
  would unblock.
- /graph: React Flow + dagre left-to-right layout. Node fill = category colour, border =
  status, lock icon when blocked. Edge arrows point prerequisite -> dependent. Filters by
  category and a "critical path" toggle. Node click opens the task sheet.

PHASE 6 — Hardening
- Playwright e2e covering: pending user sees no data; dragging a blocked task is refused;
  completing the blocker makes it draggable and writes an activity row; a member calling
  set_task_status on a task they are not assigned to is rejected by the database.
- Empty states, keyboard shortcuts (/ b l g t j k Esc), error boundaries, loading
  skeletons, dark mode pass.
- README with setup steps and .env.example.

DO NOT BUILD (schema supports them; they are explicitly out of scope for v1)
Calendar/timeline views, time tracking UI, burndown/velocity charts, overdue or deadline
logic of any kind, email or Slack notifications, file attachments, saved views, recurring
tasks, templates, multi-project or multi-tenant support, public status page, and the AI
progress agent described in section 10.1 (no GitHub integration, no LLM calls, no
agent_reports tables in v1).
The date and hour columns exist in the schema and are populated by the JSON import, but
NOTHING in the v1 UI reads them. Do not add a due-date badge, an overdue colour, or a
sort-by-deadline option.

WORKING AGREEMENT
- After each phase: run pnpm build, pnpm lint, and the test suite; fix everything before
  moving on.
- Regenerate src/types/database.ts after every migration and commit it.
- Never edit the schema through the Supabase dashboard — migrations only.
- Keep components under ~200 lines; extract hooks into lib/.
- When you hit an ambiguity that materially changes the data model, stop and ask rather
  than guessing.
- Keep a running DECISIONS.md of choices you made that the spec did not cover.

Start with Phase 0. Show me the migration files before applying them.
```

---

## 12. Open questions for you

None of these block Phase 0 — answer them before Phase 2.

1. **Team size and who is admin.** Is it just you as admin, or should one other person get admin? (Affects nothing structurally — `bootstrap_admins` takes a list.)
2. **Can members create tasks?** The spec above says no: admin creates, members execute. If you want members to be able to file a task in a category (e.g. a bug they found), that is a small RLS addition — say so and it goes into Phase 3.
3. **Should members reassign or add assignees?** Currently admin-only.
4. **Category ownership.** Do you want an optional "category lead" (one person accountable per category)? One nullable column, useful on the tracker.
5. **Cancelled vs deleted.** The design never hard-deletes a task — `cancelled` keeps history and keeps the audit log meaningful. Confirm that is what you want.
6. **`sync` import mode.** Do you want the "cancel tasks missing from the file" mode, or is `upsert`-only safer for how you will actually use it?
7. **Status columns.** Four columns (`To Do / In Progress / In Review / Done`) — is `In Review` useful for a team this size, or should it be three?

---

_End of document._
