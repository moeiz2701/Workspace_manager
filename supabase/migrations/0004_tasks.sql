-- 0004_tasks.sql — tasks (tree), assignees (many-to-many), dependencies (DAG)
-- Spec: IMPLEMENTATION.md §3.4

create table if not exists tasks (
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

  -- Time columns: populated by import, displayed nowhere in v1. Reserved for §10.
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

create index if not exists tasks_category_idx on tasks(category_id);
create index if not exists tasks_parent_idx   on tasks(parent_task_id);
create index if not exists tasks_status_idx   on tasks(status);

create table if not exists task_assignees (
  task_id     uuid not null references tasks(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references profiles(id),
  primary key (task_id, profile_id)
);
create index if not exists task_assignees_profile_idx on task_assignees(profile_id);

-- DAG. Cross-category edges are explicitly allowed.
create table if not exists task_dependencies (
  task_id            uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  created_at         timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  constraint dep_not_self check (task_id <> depends_on_task_id)
);
create index if not exists task_dependencies_reverse_idx on task_dependencies(depends_on_task_id);
