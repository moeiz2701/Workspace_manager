import { createClient } from '@/lib/supabase/server';
import type { Category, Profile, TaskCard, TaskView } from '@/types/app';

/**
 * Task reads. `v_tasks` already carries every piece of derived state
 * (`is_blocked`, `blocked_by_keys`, child and blocker counts), so the board,
 * list, graph and tracker cannot disagree about it (§2, rule 6).
 *
 * Assignees are fetched separately and joined in memory rather than embedded:
 * `v_tasks` is a view, and PostgREST has no foreign key to follow from it. The
 * embed below names its foreign key explicitly because `task_assignees` has two
 * of them to `profiles` (`profile_id` and `assigned_by`) — left ambiguous,
 * PostgREST rejects the query and every card renders as unassigned.
 */

type AssigneeRow = {
  task_id: string;
  profiles: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'color'> | null;
};

export async function getTaskCards(): Promise<TaskCard[]> {
  const supabase = await createClient();

  const [{ data: tasks }, { data: assignees }] = await Promise.all([
    supabase.from('v_tasks').select('*').order('position').order('key'),
    supabase
      .from('task_assignees')
      .select(
        'task_id, profiles!task_assignees_profile_id_fkey(id, full_name, email, avatar_url, color)',
      ),
  ]);

  return joinAssignees((tasks ?? []) as unknown as TaskView[], assignees as AssigneeRow[] | null);
}

export async function getTaskCardByKey(key: string): Promise<TaskCard | null> {
  const supabase = await createClient();

  const { data: task } = await supabase.from('v_tasks').select('*').eq('key', key).maybeSingle();
  if (!task) return null;

  const { data: assignees } = await supabase
    .from('task_assignees')
    .select(
      'task_id, profiles!task_assignees_profile_id_fkey(id, full_name, email, avatar_url, color)',
    )
    .eq('task_id', (task as unknown as TaskView).id);

  return joinAssignees([task as unknown as TaskView], assignees as AssigneeRow[] | null)[0] ?? null;
}

function joinAssignees(tasks: TaskView[], rows: AssigneeRow[] | null): TaskCard[] {
  const byTask = new Map<string, TaskCard['assignees']>();

  for (const row of rows ?? []) {
    if (!row.profiles) continue;
    byTask.set(row.task_id, [...(byTask.get(row.task_id) ?? []), row.profiles]);
  }

  for (const list of byTask.values()) {
    list.sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
  }

  return tasks.map((task) => ({
    ...task,
    // The view types every column as nullable; normalise the derived counts.
    dep_count: task.dep_count ?? 0,
    unmet_count: task.unmet_count ?? 0,
    blocked_by_keys: task.blocked_by_keys ?? [],
    is_blocked: task.is_blocked ?? false,
    child_count: task.child_count ?? 0,
    child_done_count: task.child_done_count ?? 0,
    blocks_count: task.blocks_count ?? 0,
    assignees: byTask.get(task.id) ?? [],
  }));
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('*').order('position');
  return (data ?? []) as Category[];
}

export async function getApprovedTeam(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'approved')
    .order('full_name');
  return (data ?? []) as Profile[];
}

/** Dependency edges as task keys, for the graph and the detail panels. */
export async function getDependencyEdges(): Promise<{ from: string; to: string }[]> {
  const supabase = await createClient();

  const [{ data: deps }, { data: tasks }] = await Promise.all([
    supabase.from('task_dependencies').select('task_id, depends_on_task_id'),
    supabase.from('tasks').select('id, key'),
  ]);

  const keyById = new Map((tasks ?? []).map((t) => [t.id, t.key]));

  return (deps ?? []).flatMap((d) => {
    const from = keyById.get(d.task_id);
    const to = keyById.get(d.depends_on_task_id);
    return from && to ? [{ from, to }] : [];
  });
}
