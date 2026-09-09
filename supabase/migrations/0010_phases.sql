-- 0010_phases.sql — the delivery phase a task belongs to.
--
-- The implementation plan already carries a phase, but it was encoded in the
-- task key ('P1-PLT-01' -> phase 1) where nothing could read it. Every screen
-- therefore treated a 347-task plan as one flat pile, and "what do I start"
-- had no answer beyond "any of the 148 tasks with no dependencies".
--
-- Phase is nullable on purpose: a plan that does not use phases is still valid,
-- and those tasks simply sort last.

alter table tasks add column if not exists phase smallint;

comment on column tasks.phase is
  'Delivery phase, 1-based. Derived from a P<n>- key prefix on import when the '
  'file does not state it explicitly. Null means "not phased".';

-- Backfill from the key prefix. Safe to re-run: only fills nulls, and only for
-- keys that actually carry the prefix.
update tasks
   set phase = (substring(key from '^P([0-9]+)-'))::smallint
 where phase is null
   and key ~ '^P[0-9]+-';

alter table tasks add constraint tasks_phase_positive
  check (phase is null or phase > 0);

create index if not exists tasks_phase_idx on tasks(phase);

-- Derivation lives in a trigger rather than in import_plan(), so every write
-- path gets it — the importer, a manual insert, and a later key rename alike —
-- and the 300-line import function needs no edit. An explicit phase always
-- wins; the trigger only fills a null.
create or replace function set_task_phase_from_key() returns trigger
language plpgsql
as $$
begin
  if new.phase is null and new.key ~ '^P[0-9]+-' then
    new.phase := (substring(new.key from '^P([0-9]+)-'))::smallint;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_phase_from_key on tasks;
create trigger tasks_phase_from_key
  before insert or update of key, phase on tasks
  for each row execute function set_task_phase_from_key();

-- v_tasks is `select t.*`, and a view's column list is fixed at creation time,
-- so it still means the pre-phase column set until it is rebuilt.
--
-- It must be DROPPED, not replaced: `create or replace view` may only append
-- columns at the end, and `phase` lands in the middle of `t.*` — Postgres
-- rejects it with 'cannot change name of view column "category_key" to
-- "phase"'. No cascade, deliberately: nothing in the database depends on
-- v_tasks today (only application code reads it), and if that ever changes this
-- should fail loudly rather than quietly drop the dependants.
drop view if exists v_tasks;

create view v_tasks with (security_invoker = on) as
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

grant select on v_tasks to authenticated;

-- No phase_progress view on purpose. /start already loads every task to rank
-- them, so it rolls the phases up in memory from the same rows -- one source,
-- nothing to disagree, and the screen still renders if this migration has not
-- been applied yet (phase is simply null and the queue is unphased).
