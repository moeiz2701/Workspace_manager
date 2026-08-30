'use server';

import { revalidatePath } from 'next/cache';

import { parseImportFile } from '@/lib/import/parse';
import { emptyPlanContext, planImport, type ImportPlan, type PlanContext } from '@/lib/import/plan';
import { createClient } from '@/lib/supabase/server';
import type { TaskStatus } from '@/types/app';

/**
 * The import pipeline (§6.2):
 *   Zod parse -> static plan -> preview_import RPC -> admin confirms
 *   -> import_workspace RPC (one transaction, all-or-nothing)
 */

export type DryRunResult = {
  ok: boolean;
  /** Parse errors, when the file did not even reach the planner. */
  parseIssues: { path: string; message: string }[];
  plan: ImportPlan | null;
  /** What the database itself says it would do — the read-only twin. */
  server: {
    would_create_categories: number;
    would_update_categories: number;
    would_create_tasks: number;
    would_update_tasks: number;
    warnings: { level: string; message: string }[];
    errors: { level: string; message: string }[];
  } | null;
  serverError: string | null;
};

async function loadPlanContext(): Promise<PlanContext> {
  const supabase = await createClient();
  const context = emptyPlanContext();

  const [{ data: categories }, { data: tasks }, { data: profiles }, { data: deps }] =
    await Promise.all([
      supabase.from('categories').select('key'),
      supabase.from('tasks').select('id, key, status, parent_task_id'),
      supabase.from('profiles').select('email'),
      supabase.from('task_dependencies').select('task_id, depends_on_task_id'),
    ]);

  for (const c of categories ?? []) context.categoryKeys.add(c.key);
  for (const p of profiles ?? []) context.emails.add(p.email.toLowerCase());

  const keyById = new Map<string, string>();
  for (const t of tasks ?? []) {
    keyById.set(t.id, t.key);
    context.taskStatuses.set(t.key, t.status as TaskStatus);
  }
  for (const t of tasks ?? []) {
    context.parents.set(t.key, t.parent_task_id ? (keyById.get(t.parent_task_id) ?? null) : null);
  }
  for (const d of deps ?? []) {
    const from = keyById.get(d.task_id);
    const to = keyById.get(d.depends_on_task_id);
    if (!from || !to) continue;
    context.dependencies.set(from, (context.dependencies.get(from) ?? new Set()).add(to));
  }

  return context;
}

export async function dryRunImport(fileText: string): Promise<DryRunResult> {
  const parsed = parseImportFile(fileText);
  if (!parsed.ok) {
    return { ok: false, parseIssues: parsed.issues, plan: null, server: null, serverError: null };
  }

  const context = await loadPlanContext();
  const plan = planImport(parsed.payload, context);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('preview_import', {
    p_payload: parsed.payload as never,
  });

  return {
    ok: plan.ok && !error,
    parseIssues: [],
    plan,
    server: (data as DryRunResult['server']) ?? null,
    serverError: error?.message ?? null,
  };
}

export async function runImport(
  fileText: string,
  filename: string | null,
): Promise<{ error: string | null; summary: Record<string, unknown> | null }> {
  const parsed = parseImportFile(fileText);
  if (!parsed.ok) {
    return { error: parsed.issues[0]?.message ?? 'Invalid file', summary: null };
  }

  // Re-plan server-side: never trust a client that says the dry run passed.
  const plan = planImport(parsed.payload, await loadPlanContext());
  if (!plan.ok) {
    const first = plan.issues.find((i) => i.level === 'error');
    return { error: first?.message ?? 'Import plan has errors', summary: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_workspace', {
    p_payload: parsed.payload as never,
    p_filename: filename ?? undefined,
  });

  if (error) return { error: error.message, summary: null };

  revalidatePath('/', 'layout');
  return { error: null, summary: (data as Record<string, unknown>) ?? null };
}
