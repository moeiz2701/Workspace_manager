-- 0009_import.sql — JSON bulk import
-- Spec: IMPLEMENTATION.md §6.3
--
-- import_workspace() runs as ONE transaction: any raise aborts the whole thing,
-- so a file is never half-applied.
--
-- v1 supports mode "upsert" only. "sync" (cancel tasks absent from the file) is
-- deliberately not implemented — see DECISIONS.md.

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
  v_bad record;
begin
  if not is_admin() then
    raise exception 'Only admins can import' using errcode = '42501';
  end if;
  if coalesce((p_payload->>'version')::int, 0) <> 1 then
    raise exception 'Unsupported payload version' using errcode = 'P0001';
  end if;
  if coalesce(p_payload->>'mode', 'upsert') <> 'upsert' then
    raise exception 'Unsupported import mode "%": v1 supports upsert only', p_payload->>'mode'
      using errcode = 'P0001';
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
        'level','warning',
        'message','No profile for ' || (v_item->>'email') || ' — they must sign in first');
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
           -- status is deliberately NOT overwritten on update:
           -- work in flight wins over the file.
    returning id, (xmax = 0) into v_task_id, v_ins;

    if v_ins then v_tasks_new := v_tasks_new + 1; else v_tasks_upd := v_tasks_upd + 1; end if;
  end loop;

  ------------------------------------------------ pass B: parent tree links
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) loop
    if v_item ? 'parent' and v_item->>'parent' is not null then
      if not exists (select 1 from tasks where key = v_item->>'parent') then
        raise exception 'Task % references unknown parent %', v_item->>'key', v_item->>'parent'
          using errcode = 'P0001';
      end if;

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

  --------------------------------------------- final gate check (see below)
  -- The dependency gate lives in a BEFORE UPDATE trigger, so an INSERT that
  -- declares `done` on a task with unmet dependencies would slip past it, and
  -- dependencies are only wired up in pass D anyway. Re-check the whole graph
  -- here, inside the same transaction, so an import can never leave the
  -- database in a state the board would refuse to produce.
  select t.key,
         (select string_agg(u.key, ', ' order by u.key)
            from task_dependencies d join tasks u on u.id = d.depends_on_task_id
           where d.task_id = t.id and u.status not in ('done','cancelled')) as blockers
    into v_bad
  from tasks t
  where t.status in ('in_progress','in_review','done')
    and exists (
      select 1 from task_dependencies d join tasks u on u.id = d.depends_on_task_id
      where d.task_id = t.id and u.status not in ('done','cancelled')
    )
  limit 1;

  if v_bad.key is not null then
    raise exception 'Task % is declared % but is blocked by: %',
      v_bad.key,
      (select status from tasks where key = v_bad.key),
      v_bad.blockers
      using errcode = 'P0001', hint = 'Fix the status in the file, or complete the upstream tasks.';
  end if;

  select p.key into v_bad
  from tasks p
  where p.status = 'done'
    and exists (
      select 1 from tasks c
      where c.parent_task_id = p.id and c.status not in ('done','cancelled')
    )
  limit 1;

  if v_bad.key is not null then
    raise exception 'Task % is declared done but has unfinished subtask(s)', v_bad.key
      using errcode = 'P0001';
  end if;

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
  where t.key in (
    select x->>'key' from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) as x
  );

  return v_summary;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read-only twin. Runs the same reference checks and returns the same summary
-- shape with would_* counts. Supabase's pooler does not let a Server Action
-- roll back a transaction it did not open, so this is a separate function
-- rather than "call the real one and abort".
-- ---------------------------------------------------------------------------

create or replace function preview_import(p_payload jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_item jsonb; v_email text; v_dep text;
  v_cats_new int := 0; v_cats_upd int := 0;
  v_tasks_new int := 0; v_tasks_upd int := 0;
  v_warnings jsonb := '[]'::jsonb;
  v_errors   jsonb := '[]'::jsonb;
begin
  if not is_admin() then
    raise exception 'Only admins can import' using errcode = '42501';
  end if;
  if coalesce((p_payload->>'version')::int, 0) <> 1 then
    raise exception 'Unsupported payload version' using errcode = 'P0001';
  end if;
  if coalesce(p_payload->>'mode', 'upsert') <> 'upsert' then
    raise exception 'Unsupported import mode "%": v1 supports upsert only', p_payload->>'mode'
      using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'members','[]'::jsonb)) loop
    if not exists (select 1 from profiles where lower(email) = lower(v_item->>'email')) then
      v_warnings := v_warnings || jsonb_build_object(
        'level','warning',
        'message','No profile for ' || (v_item->>'email') || ' — they must sign in first');
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'categories','[]'::jsonb)) loop
    if exists (select 1 from categories where key = v_item->>'key')
      then v_cats_upd := v_cats_upd + 1;
      else v_cats_new := v_cats_new + 1;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) loop
    if exists (select 1 from tasks where key = v_item->>'key')
      then v_tasks_upd := v_tasks_upd + 1;
      else v_tasks_new := v_tasks_new + 1;
    end if;

    -- A category may be defined in this same file, so check both sources.
    if not exists (select 1 from categories where key = v_item->>'category')
       and not exists (
         select 1 from jsonb_array_elements(coalesce(p_payload->'categories','[]'::jsonb)) c
         where c->>'key' = v_item->>'category')
    then
      v_errors := v_errors || jsonb_build_object(
        'level','error',
        'message', 'Task ' || (v_item->>'key') || ' references unknown category "'
                   || (v_item->>'category') || '"');
    end if;

    if v_item ? 'parent' and v_item->>'parent' is not null then
      if not exists (select 1 from tasks where key = v_item->>'parent')
         and not exists (
           select 1 from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) t
           where t->>'key' = v_item->>'parent')
      then
        v_errors := v_errors || jsonb_build_object(
          'level','error',
          'message', 'Task ' || (v_item->>'key') || ' references unknown parent "'
                     || (v_item->>'parent') || '"');
      end if;
    end if;

    for v_dep in select jsonb_array_elements_text(coalesce(v_item->'depends_on','[]'::jsonb)) loop
      if not exists (select 1 from tasks where key = v_dep)
         and not exists (
           select 1 from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) t
           where t->>'key' = v_dep)
      then
        v_errors := v_errors || jsonb_build_object(
          'level','error',
          'message', 'Task ' || (v_item->>'key') || ' depends on unknown task "' || v_dep || '"');
      end if;
    end loop;

    for v_email in select jsonb_array_elements_text(coalesce(v_item->'assignees','[]'::jsonb)) loop
      if not exists (select 1 from profiles where lower(email) = lower(v_email)) then
        v_warnings := v_warnings || jsonb_build_object(
          'level','warning',
          'message', 'Task ' || (v_item->>'key') || ': no profile for ' || v_email || ' — skipped');
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'would_create_categories', v_cats_new, 'would_update_categories', v_cats_upd,
    'would_create_tasks',      v_tasks_new,'would_update_tasks',      v_tasks_upd,
    'warnings',                v_warnings,
    'errors',                  v_errors
  );
end;
$$;
