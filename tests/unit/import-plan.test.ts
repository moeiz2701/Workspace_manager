import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseImportFile } from '@/lib/import/parse';
import { emptyPlanContext, findCycles, planImport, type PlanContext } from '@/lib/import/plan';
import { importSchema, type ImportPayload } from '@/lib/schemas/import';
import type { TaskStatus } from '@/types/app';

const seedPath = path.join(process.cwd(), 'supabase/seed/entropable.seed.json');

function payload(input: unknown): ImportPayload {
  return importSchema.parse(input);
}

function errors(plan: ReturnType<typeof planImport>) {
  return plan.issues.filter((i) => i.level === 'error').map((i) => i.message);
}

function warnings(plan: ReturnType<typeof planImport>) {
  return plan.issues.filter((i) => i.level === 'warning').map((i) => i.message);
}

function contextWith(overrides: Partial<PlanContext>): PlanContext {
  return { ...emptyPlanContext(), ...overrides };
}

const edges = (spec: Record<string, string[]>) =>
  new Map(Object.entries(spec).map(([k, v]) => [k, new Set(v)]));

describe('findCycles', () => {
  it('finds nothing in an acyclic graph', () => {
    expect(findCycles(edges({ A: ['B'], B: ['C'], C: [] }))).toEqual([]);
  });

  it('finds a two-node cycle', () => {
    expect(findCycles(edges({ A: ['B'], B: ['A'] }))).toEqual([['A', 'B', 'A']]);
  });

  it('finds a three-node cycle and closes the chain', () => {
    const [chain] = findCycles(
      edges({ 'ML-01': ['BT-01'], 'BT-01': ['SB-01'], 'SB-01': ['ML-01'] }),
    );
    expect(chain![0]).toBe(chain![chain!.length - 1]);
    expect(chain).toHaveLength(4);
  });

  it('finds a self-loop', () => {
    expect(findCycles(edges({ A: ['A'] }))).toEqual([['A', 'A']]);
  });

  it('does not report acyclic nodes that merely lead into a cycle', () => {
    const cycles = findCycles(edges({ X: ['A'], A: ['B'], B: ['A'] }));
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).not.toContain('X');
  });

  it('reports two independent cycles separately', () => {
    expect(findCycles(edges({ A: ['B'], B: ['A'], C: ['D'], D: ['C'] }))).toHaveLength(2);
  });
});

describe('planImport', () => {
  it('plans the shipped seed file against an empty database', () => {
    const parsed = parseImportFile(readFileSync(seedPath, 'utf8'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const plan = planImport(parsed.payload, emptyPlanContext());

    expect(errors(plan)).toEqual([]);
    expect(plan.ok).toBe(true);
    expect(plan.counts.categoriesCreated).toBe(6);
    expect(plan.counts.tasksCreated).toBe(37);
    expect(plan.counts.tasksUpdated).toBe(0);
    // Nobody has signed in yet, so every assignee is an unresolved warning.
    expect(warnings(plan).length).toBeGreaterThan(0);
  });

  it('counts a re-import of the same file as updates, not duplicates', () => {
    const parsed = parseImportFile(readFileSync(seedPath, 'utf8'));
    if (!parsed.ok) throw new Error('seed did not parse');

    const context = contextWith({
      categoryKeys: new Set(parsed.payload.categories.map((c) => c.key)),
      taskStatuses: new Map(parsed.payload.tasks.map((t) => [t.key, t.status as TaskStatus])),
      emails: new Set(['abdulmoizzzzzz10@gmail.com', 'dev2@example.com', 'dev3@example.com']),
    });

    const plan = planImport(parsed.payload, context);

    expect(plan.ok).toBe(true);
    expect(plan.counts.tasksCreated).toBe(0);
    expect(plan.counts.tasksUpdated).toBe(37);
    expect(plan.counts.categoriesUpdated).toBe(6);
    expect(warnings(plan)).toEqual([]);
  });

  it('reports the offending chain for a dependency cycle', () => {
    const plan = planImport(
      payload({
        version: 1,
        categories: [{ key: 'ml-pipeline', name: 'ML' }],
        tasks: [
          { key: 'ML-01', category: 'ml-pipeline', title: 'a', depends_on: ['BT-01'] },
          { key: 'BT-01', category: 'ml-pipeline', title: 'b', depends_on: ['ML-01'] },
        ],
      }),
      emptyPlanContext(),
    );

    expect(plan.ok).toBe(false);
    expect(errors(plan)).toContain('Circular dependency: BT-01 → ML-01 → BT-01');
  });

  it('reports a cycle formed with an edge that is already in the database', () => {
    // DB already has BT-01 -> ML-01; the file adds ML-01 -> BT-01.
    const context = contextWith({
      categoryKeys: new Set(['ml-pipeline']),
      taskStatuses: new Map<string, TaskStatus>([
        ['ML-01', 'todo'],
        ['BT-01', 'todo'],
      ]),
      dependencies: new Map([['BT-01', new Set(['ML-01'])]]),
    });

    const plan = planImport(
      payload({
        version: 1,
        tasks: [{ key: 'ML-01', category: 'ml-pipeline', title: 'a', depends_on: ['BT-01'] }],
      }),
      context,
    );

    expect(plan.ok).toBe(false);
    expect(errors(plan).join(' ')).toMatch(/Circular dependency/);
  });

  it('reports a circular task hierarchy', () => {
    const plan = planImport(
      payload({
        version: 1,
        categories: [{ key: 'ml-pipeline', name: 'ML' }],
        tasks: [
          { key: 'ML-01', category: 'ml-pipeline', title: 'a', parent: 'ML-02' },
          { key: 'ML-02', category: 'ml-pipeline', title: 'b', parent: 'ML-01' },
        ],
      }),
      emptyPlanContext(),
    );

    expect(errors(plan).join(' ')).toMatch(/Circular task hierarchy/);
  });

  it('flags unknown category, parent and dependency references', () => {
    const plan = planImport(
      payload({
        version: 1,
        tasks: [
          {
            key: 'ML-01',
            category: 'nope',
            title: 'a',
            parent: 'MISSING-01',
            depends_on: ['ALSO-MISSING'],
          },
        ],
      }),
      emptyPlanContext(),
    );

    expect(plan.ok).toBe(false);
    expect(errors(plan)).toEqual([
      'ML-01 references unknown category "nope"',
      'ML-01 references unknown parent "MISSING-01"',
      'ML-01 depends on unknown task "ALSO-MISSING"',
    ]);
  });

  it('resolves references that the same file defines later', () => {
    const plan = planImport(
      payload({
        version: 1,
        categories: [{ key: 'ml-pipeline', name: 'ML' }],
        tasks: [
          { key: 'ML-01-A', category: 'ml-pipeline', title: 'child', parent: 'ML-01' },
          { key: 'ML-01', category: 'ml-pipeline', title: 'parent' },
        ],
      }),
      emptyPlanContext(),
    );

    expect(errors(plan)).toEqual([]);
  });

  it('rejects a declared status that breaks the dependency gate', () => {
    const plan = planImport(
      payload({
        version: 1,
        categories: [{ key: 'ml-pipeline', name: 'ML' }],
        tasks: [
          { key: 'ML-01', category: 'ml-pipeline', title: 'upstream' },
          {
            key: 'BT-01',
            category: 'ml-pipeline',
            title: 'downstream',
            status: 'in_progress',
            depends_on: ['ML-01'],
          },
        ],
      }),
      emptyPlanContext(),
    );

    expect(plan.ok).toBe(false);
    expect(errors(plan)).toContain('BT-01 is declared "in_progress" but is blocked by ML-01');
  });

  it('accepts a declared status whose dependencies are done or cancelled', () => {
    const plan = planImport(
      payload({
        version: 1,
        categories: [{ key: 'ml-pipeline', name: 'ML' }],
        tasks: [
          { key: 'ML-01', category: 'ml-pipeline', title: 'upstream', status: 'done' },
          { key: 'ML-02', category: 'ml-pipeline', title: 'dropped', status: 'cancelled' },
          {
            key: 'BT-01',
            category: 'ml-pipeline',
            title: 'downstream',
            status: 'in_progress',
            depends_on: ['ML-01', 'ML-02'],
          },
        ],
      }),
      emptyPlanContext(),
    );

    expect(errors(plan)).toEqual([]);
  });

  it('rejects a parent declared done while a child is open', () => {
    const plan = planImport(
      payload({
        version: 1,
        categories: [{ key: 'ml-pipeline', name: 'ML' }],
        tasks: [
          { key: 'ML-01', category: 'ml-pipeline', title: 'parent', status: 'done' },
          { key: 'ML-01-A', category: 'ml-pipeline', title: 'child', parent: 'ML-01' },
        ],
      }),
      emptyPlanContext(),
    );

    expect(plan.ok).toBe(false);
    expect(errors(plan).join(' ')).toMatch(/ML-01 is declared "done" but has unfinished subtask/);
  });

  it('does not apply the file status to a task that already exists', () => {
    // The file says todo; the DB says in_progress. Work in flight wins, so the
    // gate check must use in_progress — and pass, because ML-01 is done.
    const context = contextWith({
      categoryKeys: new Set(['ml-pipeline']),
      taskStatuses: new Map<string, TaskStatus>([
        ['ML-01', 'done'],
        ['BT-01', 'in_progress'],
      ]),
    });

    const plan = planImport(
      payload({
        version: 1,
        tasks: [
          { key: 'BT-01', category: 'ml-pipeline', title: 'downstream', depends_on: ['ML-01'] },
        ],
      }),
      context,
    );

    expect(errors(plan)).toEqual([]);
    expect(plan.tasks[0]!.status).toBe('in_progress');
    expect(plan.tasks[0]!.action).toBe('update');
  });

  it('warns about assignees and members with no profile, without failing', () => {
    const plan = planImport(
      payload({
        version: 1,
        members: [{ email: 'ghost@example.com' }],
        categories: [{ key: 'ml-pipeline', name: 'ML' }],
        tasks: [
          {
            key: 'ML-01',
            category: 'ml-pipeline',
            title: 'a',
            assignees: ['known@example.com', 'ghost@example.com'],
          },
        ],
      }),
      contextWith({ emails: new Set(['known@example.com']) }),
    );

    expect(plan.ok).toBe(true);
    expect(warnings(plan)).toEqual([
      'No profile for ghost@example.com — they must sign in with Google first',
      'ML-01: no profile for ghost@example.com — assignment skipped',
    ]);
    expect(plan.tasks[0]!.unknownAssignees).toEqual(['ghost@example.com']);
  });

  it('matches assignee emails case-insensitively', () => {
    const plan = planImport(
      payload({
        version: 1,
        categories: [{ key: 'ml-pipeline', name: 'ML' }],
        tasks: [
          { key: 'ML-01', category: 'ml-pipeline', title: 'a', assignees: ['Known@Example.com'] },
        ],
      }),
      contextWith({ emails: new Set(['known@example.com']) }),
    );

    expect(warnings(plan)).toEqual([]);
  });
});
