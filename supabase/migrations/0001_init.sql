-- 0001_init.sql — extensions and enums
-- Spec: IMPLEMENTATION.md §3.1

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type profile_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'in_review', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_type as enum (
    'created', 'status_changed', 'assignee_added', 'assignee_removed',
    'dependency_added', 'dependency_removed', 'note_updated',
    'category_changed', 'priority_changed', 'parent_changed', 'imported'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'access_request', 'access_approved', 'access_rejected',
    'task_assigned', 'task_unassigned', 'mention', 'comment',
    'status_changed', 'task_unblocked'
  );
exception when duplicate_object then null; end $$;

-- Note: `blocked` is deliberately NOT a status. It is derived from unmet
-- dependencies (§3.6) so it can never drift out of sync with reality.
