-- 0007_rules.sql — business rules enforced in the database
-- Spec: IMPLEMENTATION.md §4
--
-- THE CORE RULE
--   A task may not leave `todo` until every task it depends on is `done` (or
--   `cancelled`). A parent task may not become `done` until all of its children
--   are `done` (or `cancelled`).
-- UI-only gating is trivially bypassed via the REST API, so it lives here.

-- ---------------------------------------------------------------------------
-- 4.1 Dependency gate
-- ---------------------------------------------------------------------------

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

drop trigger if exists tasks_enforce_transition on tasks;
create trigger tasks_enforce_transition
before update on tasks
for each row execute function enforce_task_transition();

-- ---------------------------------------------------------------------------
-- 4.2 Cycle prevention
-- ---------------------------------------------------------------------------

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

drop trigger if exists task_dependencies_no_cycle on task_dependencies;
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

drop trigger if exists tasks_no_tree_cycle on tasks;
create trigger tasks_no_tree_cycle
before insert or update of parent_task_id on tasks
for each row execute function prevent_task_tree_cycle();

-- ---------------------------------------------------------------------------
-- 4.3 Audit log + notification fan-out
-- ---------------------------------------------------------------------------

create or replace function log_task_created()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into task_activity (task_id, actor_id, type, to_value)
  values (new.id, auth.uid(), 'created', new.title);
  return new;
end;
$$;

drop trigger if exists tasks_log_created on tasks;
create trigger tasks_log_created
after insert on tasks
for each row execute function log_task_created();

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
    where a.task_id = new.id
      and a.profile_id is distinct from auth.uid();
  end if;

  if new.note is distinct from old.note then
    insert into task_activity (task_id, actor_id, type, to_value)
    values (new.id, auth.uid(), 'note_updated', new.note);
  end if;

  if new.priority is distinct from old.priority then
    insert into task_activity (task_id, actor_id, type, from_value, to_value)
    values (new.id, auth.uid(), 'priority_changed', old.priority::text, new.priority::text);
  end if;

  if new.category_id is distinct from old.category_id then
    insert into task_activity (task_id, actor_id, type, from_value, to_value)
    values (new.id, auth.uid(), 'category_changed', old.category_id::text, new.category_id::text);
  end if;

  if new.parent_task_id is distinct from old.parent_task_id then
    insert into task_activity (task_id, actor_id, type, from_value, to_value)
    values (new.id, auth.uid(), 'parent_changed', old.parent_task_id::text, new.parent_task_id::text);
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

drop trigger if exists tasks_log_changes on tasks;
create trigger tasks_log_changes
after update on tasks
for each row execute function log_task_changes();

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

drop trigger if exists task_assignees_notify on task_assignees;
create trigger task_assignees_notify
after insert on task_assignees
for each row execute function notify_on_assignment();

create or replace function log_unassignment()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- The parent task may already be gone (cascade delete); skip the audit row then.
  if exists (select 1 from tasks where id = old.task_id) then
    insert into task_activity (task_id, actor_id, type, from_value)
    values (old.task_id, auth.uid(), 'assignee_removed', old.profile_id::text);
  end if;
  return old;
end;
$$;

drop trigger if exists task_assignees_log_removal on task_assignees;
create trigger task_assignees_log_removal
after delete on task_assignees
for each row execute function log_unassignment();

create or replace function log_dependency_added()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_key text;
begin
  select key into v_key from tasks where id = new.depends_on_task_id;
  insert into task_activity (task_id, actor_id, type, to_value)
  values (new.task_id, auth.uid(), 'dependency_added', v_key);
  return new;
end;
$$;

drop trigger if exists task_dependencies_log_added on task_dependencies;
create trigger task_dependencies_log_added
after insert on task_dependencies
for each row execute function log_dependency_added();

-- Comment notifications: participants first, then @mentions (deduped by type).
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

drop trigger if exists task_comments_notify on task_comments;
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

drop trigger if exists comment_mentions_notify on comment_mentions;
create trigger comment_mentions_notify
after insert on comment_mentions
for each row execute function notify_on_mention();

-- ---------------------------------------------------------------------------
-- 4.4 The one write path for members
-- Members have NO update privilege on `tasks`. Status changes go through this
-- RPC, which checks assignment and then lets the trigger enforce the gate.
-- ---------------------------------------------------------------------------

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
