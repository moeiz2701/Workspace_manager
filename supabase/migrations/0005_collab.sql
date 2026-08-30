-- 0005_collab.sql — comments, mentions, audit trail, notifications, imports
-- Spec: IMPLEMENTATION.md §3.5

create table if not exists task_comments (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references tasks(id) on delete cascade,
  parent_comment_id uuid references task_comments(id) on delete cascade,  -- THREADED
  author_id         uuid not null references profiles(id) on delete cascade,
  body              text not null,
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  deleted_at        timestamptz
);
create index if not exists task_comments_task_idx on task_comments(task_id, created_at);

create table if not exists comment_mentions (
  comment_id           uuid not null references task_comments(id) on delete cascade,
  mentioned_profile_id uuid not null references profiles(id) on delete cascade,
  primary key (comment_id, mentioned_profile_id)
);

-- Immutable audit trail. Insert-only; no update/delete policy exists.
create table if not exists task_activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  actor_id   uuid references profiles(id),
  type       activity_type not null,
  from_value text,
  to_value   text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists task_activity_task_idx on task_activity(task_id, created_at desc);

create table if not exists notifications (
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
create index if not exists notifications_recipient_idx
  on notifications(recipient_id, read_at, created_at desc);

-- Every JSON upload is recorded so an import can be understood after the fact.
create table if not exists imports (
  id          uuid primary key default gen_random_uuid(),
  uploaded_by uuid references profiles(id),
  filename    text,
  payload     jsonb not null,
  summary     jsonb not null default '{}'::jsonb,
  dry_run     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists imports_created_idx on imports(created_at desc);
