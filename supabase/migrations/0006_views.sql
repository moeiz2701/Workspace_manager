-- 0006_views.sql — derived state: the single source of truth for "is this blocked"
-- and for every progress number in the app.
-- Spec: IMPLEMENTATION.md §3.6
--
-- Every view here is created `with (security_invoker = on)`. Without it a view
-- runs with its OWNER's permissions and silently bypasses RLS on the underlying
-- tables — a `pending` user would be able to read the whole task list through
-- v_tasks. Do not omit it.

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
  (s.unmet_count > 0)                                                                    as is_blocked,
  (select count(*) from tasks ch where ch.parent_task_id = t.id)                         as child_count,
  (select count(*) from tasks ch where ch.parent_task_id = t.id and ch.status = 'done')   as child_done_count,
  (select count(*) from task_dependencies d2 where d2.depends_on_task_id = t.id)          as blocks_count,
  (select p.key from tasks p where p.id = t.parent_task_id)                               as parent_key
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
  , 1)                                                                      as pct
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

-- Per-person rollup for the tracker. RLS on the underlying tables still applies.
create or replace view person_progress with (security_invoker = on) as
select
  p.id as profile_id, p.full_name, p.email, p.color, p.title,
  count(t.id) filter (where t.status <> 'cancelled')                 as total,
  count(t.id) filter (where t.status = 'done')                       as done,
  count(t.id) filter (where t.status in ('in_progress','in_review')) as in_flight,
  count(t.id) filter (where t.status = 'todo')                       as todo
from profiles p
left join task_assignees a on a.profile_id = p.id
left join tasks t          on t.id = a.task_id
where p.status = 'approved'
group by p.id, p.full_name, p.email, p.color, p.title;

grant select on task_dependency_state, v_tasks, category_progress,
                project_progress, person_progress to authenticated;
