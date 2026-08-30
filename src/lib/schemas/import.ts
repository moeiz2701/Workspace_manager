import { z } from 'zod';

import { COLORS } from '@/lib/colors';

/**
 * The JSON bulk-import format (§6.1, version 1).
 *
 * One file defines the whole implementation plan: categories, the task tree,
 * who is assigned, and what depends on what. This schema checks shape, enums
 * and key formats. Reference resolution and cycle detection live in
 * lib/import/plan.ts, so the admin sees the offending chain rather than a bare
 * Postgres error.
 */

export { COLORS };

const taskKey = z.string().regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Keys look like ML-01 or ML-01-A');

const catKey = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Category keys look like ml-pipeline');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates look like 2026-09-01');

export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export const memberSchema = z.object({
  email: z.string().email(),
  title: z.string().optional(),
  color: z.enum(COLORS).optional(),
  role: z.enum(['admin', 'member']).optional(),
});

export const categorySchema = z.object({
  key: catKey,
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.enum(COLORS).default('slate'),
  icon: z.string().optional(),
  position: z.number().optional(),
});

export const taskSchema = z.object({
  key: taskKey,
  category: catKey,
  parent: taskKey.optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional(),
  note: z.string().optional(),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  assignees: z.array(z.string().email()).default([]),
  depends_on: z.array(taskKey).default([]),
  position: z.number().optional(),
  // Stored, displayed nowhere in v1. Reserved for §10.
  start_date: isoDate.optional(),
  due_date: isoDate.optional(),
  estimate_hours: z.number().positive().optional(),
});

export const importSchema = z
  .object({
    version: z.literal(1),
    // `sync` mode is deliberately not implemented in v1 — imports are
    // upsert-only, so an import can never cancel a task left out of the file.
    mode: z.literal('upsert').default('upsert'),
    members: z.array(memberSchema).optional(),
    categories: z.array(categorySchema).default([]),
    tasks: z.array(taskSchema).default([]),
  })
  .superRefine((v, ctx) => {
    const taskKeys = new Set<string>();
    for (const [i, t] of v.tasks.entries()) {
      if (taskKeys.has(t.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', i, 'key'],
          message: `Duplicate task key ${t.key}`,
        });
      }
      taskKeys.add(t.key);

      if (t.parent === t.key) {
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', i, 'parent'],
          message: `${t.key} cannot be its own parent`,
        });
      }
      if (t.depends_on.includes(t.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', i, 'depends_on'],
          message: `${t.key} cannot depend on itself`,
        });
      }
    }

    const catKeys = new Set<string>();
    for (const [i, c] of v.categories.entries()) {
      if (catKeys.has(c.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['categories', i, 'key'],
          message: `Duplicate category key ${c.key}`,
        });
      }
      catKeys.add(c.key);
    }
    // Unknown parent / dependency references and cycle detection live in
    // lib/import/plan.ts, which can also see what is already in the database.
  });

export type ImportPayload = z.infer<typeof importSchema>;
export type ImportTask = z.infer<typeof taskSchema>;
export type ImportCategory = z.infer<typeof categorySchema>;
export type ImportMember = z.infer<typeof memberSchema>;
