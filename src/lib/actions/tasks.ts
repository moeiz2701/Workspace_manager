'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

/**
 * Task writes.
 *
 * Status and position go through RPCs (§4.4) because they carry business
 * rules: assignment checks in the function, the dependency gate in the trigger
 * behind it. Everything else is an admin-only direct write guarded by RLS
 * ("admins write tasks"). Members have no UPDATE privilege on `tasks` at all.
 */

type Result = { error: string | null };

const uuid = z.string().uuid();
const statusEnum = z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']);
const priorityEnum = z.enum(['low', 'medium', 'high', 'critical']);

function done(error: { message: string } | null): Result {
  if (error) return { error: cleanPostgresError(error.message) };
  revalidatePath('/', 'layout');
  return { error: null };
}

/**
 * Surface the database's own message — "Task BT-01 is blocked by: ML-01,
 * PLT-01" is exactly what the user needs (§7.3). Strip only the plpgsql noise.
 */
function cleanPostgresError(message: string): string {
  return message
    .replace(/^ERROR:\s*/i, '')
    .split('\nCONTEXT:')[0]!
    .trim();
}

export async function setTaskStatus(taskId: string, status: string): Promise<Result> {
  const parsed = z.object({ taskId: uuid, status: statusEnum }).safeParse({ taskId, status });
  if (!parsed.success) return { error: 'Invalid status' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_task_status', {
    p_task_id: parsed.data.taskId,
    p_status: parsed.data.status,
  });
  return done(error);
}

export async function setTaskPosition(taskId: string, position: number): Promise<Result> {
  const parsed = z
    .object({ taskId: uuid, position: z.number().finite() })
    .safeParse({ taskId, position });
  if (!parsed.success) return { error: 'Invalid position' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_task_position', {
    p_task_id: parsed.data.taskId,
    p_position: parsed.data.position,
  });
  return done(error);
}

/** Drag-and-drop moves a card between columns and to a slot within it. */
export async function moveTask(taskId: string, status: string, position: number): Promise<Result> {
  const statusResult = await setTaskStatus(taskId, status);
  if (statusResult.error) return statusResult;
  return setTaskPosition(taskId, position);
}

const taskFields = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  priority: priorityEnum.optional(),
  category_id: uuid.optional(),
  parent_task_id: uuid.nullable().optional(),
});

export async function updateTask(taskId: string, input: unknown): Promise<Result> {
  if (!uuid.safeParse(taskId).success) return { error: 'Invalid task' };

  const parsed = taskFields.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  if (Object.keys(parsed.data).length === 0) return { error: null };

  const supabase = await createClient();
  const { error } = await supabase.from('tasks').update(parsed.data).eq('id', taskId);
  return done(error);
}

export async function addAssignee(taskId: string, profileId: string): Promise<Result> {
  const parsed = z.object({ taskId: uuid, profileId: uuid }).safeParse({ taskId, profileId });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('task_assignees').insert({
    task_id: parsed.data.taskId,
    profile_id: parsed.data.profileId,
    assigned_by: user?.id ?? null,
  });

  if (error?.code === '23505') return { error: null }; // already assigned
  return done(error);
}

export async function removeAssignee(taskId: string, profileId: string): Promise<Result> {
  const parsed = z.object({ taskId: uuid, profileId: uuid }).safeParse({ taskId, profileId });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('task_assignees')
    .delete()
    .eq('task_id', parsed.data.taskId)
    .eq('profile_id', parsed.data.profileId);
  return done(error);
}

export async function addDependency(taskId: string, dependsOnTaskId: string): Promise<Result> {
  const parsed = z
    .object({ taskId: uuid, dependsOnTaskId: uuid })
    .safeParse({ taskId, dependsOnTaskId });
  if (!parsed.success) return { error: 'Invalid input' };
  if (parsed.data.taskId === parsed.data.dependsOnTaskId) {
    return { error: 'A task cannot depend on itself' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('task_dependencies').insert({
    task_id: parsed.data.taskId,
    depends_on_task_id: parsed.data.dependsOnTaskId,
  });

  if (error?.code === '23505') return { error: null }; // edge already exists
  return done(error); // the cycle trigger's message comes through here
}

export async function removeDependency(taskId: string, dependsOnTaskId: string): Promise<Result> {
  const parsed = z
    .object({ taskId: uuid, dependsOnTaskId: uuid })
    .safeParse({ taskId, dependsOnTaskId });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('task_id', parsed.data.taskId)
    .eq('depends_on_task_id', parsed.data.dependsOnTaskId);
  return done(error);
}
