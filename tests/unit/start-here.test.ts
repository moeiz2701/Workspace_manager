import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseImportFile } from '@/lib/import/parse';
import {
  byPhase,
  currentPhase,
  myQueue,
  rankTasks,
  startOrder,
  type RankedTask,
} from '@/lib/start-here';
import type { TaskCard } from '@/types/app';

/**
 * The ranking is only worth anything if it is right about the plan it was built
 * for, so the substantive cases run against the real 347-task file rather than
 * a toy fixture. Same skip rule as plan-file.test.ts: the file lives in the
 * parent repo, so a standalone clone skips instead of failing.
 */
const FILE = path.resolve(import.meta.dirname, '../../../docs/implementation_plan.import.json');

/** Build TaskCards the way v_tasks would, so the test exercises real shapes. */
function loadPlan() {
  const parsed = parseImportFile(fs.readFileSync(FILE, 'utf8'));
  if (!parsed.ok) throw new Error('plan file does not parse');

  const tasks = parsed.payload.tasks;
  const done = new Set(
    tasks.filter((t) => t.status === 'done' || t.status === 'cancelled').map((t) => t.key),
  );

  const cards = tasks.map((t): TaskCard => {
    const unmet = t.depends_on.filter((d) => !done.has(d));
    return {
      id: t.key,
      key: t.key,
      category_id: t.category,
      parent_task_id: t.parent ?? null,
      title: t.title,
      description: t.description ?? null,
      note: t.note ?? null,
      status: t.status,
      priority: t.priority,
      position: t.position ?? 1000,
      phase: /^P(\d+)-/.exec(t.key) ? Number(/^P(\d+)-/.exec(t.key)![1]) : null,
      start_date: null,
      due_date: null,
      estimate_hours: null,
      actual_hours: null,
      started_at: null,
      completed_at: null,
      created_by: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      category_key: t.category,
      category_name: t.category,
      category_color: 'slate',
      dep_count: t.depends_on.length,
      unmet_count: unmet.length,
      blocked_by_keys: unmet,
      is_blocked: unmet.length > 0,
      child_count: 0,
      child_done_count: 0,
      blocks_count: 0,
      parent_key: t.parent ?? null,
      assignees: [],
    };
  });

  // v_tasks emits child_count; the ranking reads parent_key, so fill both.
  const childCount = new Map<string, number>();
  for (const c of cards) {
    if (c.parent_key) childCount.set(c.parent_key, (childCount.get(c.parent_key) ?? 0) + 1);
  }
  for (const c of cards) c.child_count = childCount.get(c.key) ?? 0;

  const edges = tasks.flatMap((t) => t.depends_on.map((d) => ({ from: t.key, to: d })));
  return { cards, edges };
}

describe.skipIf(!fs.existsSync(FILE))('startOrder on the real implementation plan', () => {
  const { cards, edges } = loadPlan();
  const ranked = rankTasks(cards, edges);
  const order = startOrder(ranked);
  const find = (key: string) => ranked.find((r) => r.task.key === key)!;

  it('counts transitive unlocks, not just direct dependents', () => {
    // The number the board cannot show: blocks_count is direct-only. Counted in
    // leaves, so it reads as "pieces of work released", not "rows in a table".
    // Cross-checked against an independent fixpoint over the same plan file.
    const sec = find('P1-SEC-01');
    expect(sec.unlocks).toBeGreaterThan(sec.task.blocks_count);
    expect(sec.unlocks).toBe(88);
    expect(find('P1-PLT-01').unlocks).toBe(75);
    expect(find('P1-CDH-05').unlocks).toBe(59);
  });

  it('pushes a container’s leverage down onto its children', () => {
    // P1-SEC-01 is a heading with three children and the most downstream work
    // in the plan. Its children must inherit that, or the highest-leverage item
    // in the plan never surfaces at all.
    expect(find('P1-SEC-01').isLeaf).toBe(false);
    // The child carries its parent's 88 plus two dependents of its own.
    expect(find('P1-SEC-01-A').unlocks).toBe(90);
    expect(find('P1-SEC-01-A').unlocks).toBeGreaterThanOrEqual(find('P1-SEC-01').unlocks);
  });

  it('puts an actionable leaf first, not a heading', () => {
    expect(order[0]!.task.key).toBe('P1-SEC-01-A');
    expect(order[0]!.isLeaf).toBe(true);
    expect(order[0]!.task.title).toMatch(/identity model/i);
  });

  it('does not offer a leaf whose parent is still waiting', () => {
    // 87 leaves in this plan declare no dependencies while their parent does.
    const falseInvitations = ranked.filter(
      (r) => r.isLeaf && !r.task.is_blocked && r.blockedByParent.length > 0,
    );
    expect(falseInvitations).toHaveLength(87);

    // Not one of them reaches the queue.
    const offered = new Set(order.map((r) => r.task.key));
    expect(falseInvitations.some((r) => offered.has(r.task.key))).toBe(false);

    // And the reason is retrievable, so the UI can explain the absence.
    expect(find('P1-PLT-02-A').blockedByParent).toEqual(['P1-PLT-01']);
  });

  it('leads with phase 1 and never interleaves a later phase', () => {
    const phases = order.map((r) => r.task.phase ?? Infinity);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    expect(order[0]!.task.phase).toBe(1);
  });

  it('never offers a blocked task', () => {
    expect(order.every((r) => r.ready)).toBe(true);
    expect(order.some((r) => r.task.is_blocked)).toBe(false);
  });

  it('never offers a container — a heading is not a piece of work', () => {
    expect(order.every((r) => r.isLeaf)).toBe(true);
    expect(order.some((r) => r.task.child_count > 0)).toBe(false);
  });

  it('measures the chain a task gates, not only how many it releases', () => {
    const deepest = Math.max(...ranked.map((r) => r.gatesChain));
    expect(deepest).toBeGreaterThan(1);
    expect(find('P1-SEC-01').gatesChain).toBeGreaterThan(1);
  });

  it('offers only phase 1 while phase 1 is untouched', () => {
    // Not a quirk: every later-phase leaf waits, directly or through its parent,
    // on phase-1 work. The queue saying "phase 1 only" is the correct answer to
    // "what can be started today", and it is what makes the screen worth having.
    const groups = byPhase(order);
    expect(groups.map((g) => g.phase)).toEqual([1]);
  });

  it('is a strict ordering — ranking is stable and total', () => {
    const twice = startOrder(rankTasks(cards, edges)).map((r) => r.task.key);
    expect(order.map((r) => r.task.key)).toEqual(twice);
  });

  it('groups in phase order without dropping anything', () => {
    const groups = byPhase(ranked);
    expect(groups.map((g) => g.phase)).toEqual([1, 2, 3, 4]);
    expect(groups.reduce((n, g) => n + g.tasks.length, 0)).toBe(ranked.length);
  });

  it('reports phase 1 as current while P1 work is open', () => {
    expect(currentPhase(cards)).toBe(1);
  });

  it('narrows a 347-task plan to a queue a person can read', () => {
    // The whole point of the screen. The board calls 148 tasks startable;
    // 44 of them are actually actionable work once containers are excluded and
    // the parents' prerequisites are honoured.
    const unblockedOnBoard = cards.filter((t) => !t.is_blocked && t.status === 'todo').length;
    expect(unblockedOnBoard).toBe(148);
    expect(order).toHaveLength(44);
  });
});

describe('startOrder rules', () => {
  const base = {
    description: null,
    note: null,
    position: 1000,
    start_date: null,
    due_date: null,
    estimate_hours: null,
    actual_hours: null,
    started_at: null,
    completed_at: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    category_key: 'c',
    category_name: 'C',
    category_color: 'slate' as const,
    category_id: 'c',
    dep_count: 0,
    unmet_count: 0,
    blocked_by_keys: [] as string[],
    is_blocked: false,
    child_count: 0,
    child_done_count: 0,
    blocks_count: 0,
    parent_task_id: null,
    parent_key: null,
    assignees: [] as TaskCard['assignees'],
  };

  const task = (over: Partial<TaskCard> & { key: string }): TaskCard => ({
    ...base,
    id: over.key,
    title: over.key,
    status: 'todo',
    priority: 'medium',
    phase: null,
    ...over,
  });

  it('sorts unphased work after every phase', () => {
    const tasks = [task({ key: 'NOPHASE' }), task({ key: 'P2-A', phase: 2 })];
    const order = startOrder(rankTasks(tasks, []));
    expect(order.map((r) => r.task.key)).toEqual(['P2-A', 'NOPHASE']);
  });

  it('prefers phase over leverage — a P1 task outranks a bigger P2 one', () => {
    const tasks = [
      task({ key: 'P1-A', phase: 1 }),
      task({ key: 'P2-BIG', phase: 2 }),
      task({ key: 'P2-X', phase: 2, is_blocked: true, unmet_count: 1 }),
      task({ key: 'P2-Y', phase: 2, is_blocked: true, unmet_count: 1 }),
    ];
    const edges = [
      { from: 'P2-X', to: 'P2-BIG' },
      { from: 'P2-Y', to: 'P2-BIG' },
    ];
    const ranked = rankTasks(tasks, edges);
    expect(ranked.find((r) => r.task.key === 'P2-BIG')!.unlocks).toBe(2);
    expect(startOrder(ranked)[0]!.task.key).toBe('P1-A');
  });

  it('does not count finished work as unlocked', () => {
    const tasks = [
      task({ key: 'ROOT' }),
      task({ key: 'DONE', status: 'done' }),
      task({ key: 'OPEN', is_blocked: true, unmet_count: 1 }),
    ];
    const edges = [
      { from: 'DONE', to: 'ROOT' },
      { from: 'OPEN', to: 'ROOT' },
    ];
    expect(rankTasks(tasks, edges).find((r) => r.task.key === 'ROOT')!.unlocks).toBe(1);
  });

  it('counts a diamond once rather than per path', () => {
    const tasks = [
      task({ key: 'ROOT' }),
      task({ key: 'L', is_blocked: true, unmet_count: 1 }),
      task({ key: 'R', is_blocked: true, unmet_count: 1 }),
      task({ key: 'JOIN', is_blocked: true, unmet_count: 2 }),
    ];
    const edges = [
      { from: 'L', to: 'ROOT' },
      { from: 'R', to: 'ROOT' },
      { from: 'JOIN', to: 'L' },
      { from: 'JOIN', to: 'R' },
    ];
    expect(rankTasks(tasks, edges).find((r) => r.task.key === 'ROOT')!.unlocks).toBe(3);
  });

  it('terminates on a dependency cycle instead of hanging', () => {
    const tasks = [task({ key: 'A' }), task({ key: 'B' })];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ];
    const ranked = rankTasks(tasks, edges);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((r) => Number.isFinite(r.gatesChain))).toBe(true);
  });

  it('ignores edges pointing outside the loaded task set', () => {
    const tasks = [task({ key: 'A' })];
    const ranked = rankTasks(tasks, [{ from: 'GHOST', to: 'A' }]);
    expect(ranked[0]!.unlocks).toBe(0);
  });

  it('filters a personal queue without changing the order', () => {
    const me = {
      id: 'me',
      full_name: 'Me',
      email: 'me@x.com',
      avatar_url: null,
      color: 'blue' as const,
    };
    const tasks = [
      task({ key: 'P1-A', phase: 1, assignees: [me] }),
      task({ key: 'P1-B', phase: 1 }),
      task({ key: 'P2-C', phase: 2, assignees: [me] }),
    ] as TaskCard[];
    const queue = myQueue(rankTasks(tasks, []), 'me');
    expect(queue.map((r) => r.task.key)).toEqual(['P1-A', 'P2-C']);
  });

  it('excludes a parent even when it is unblocked', () => {
    const tasks = [
      task({ key: 'PARENT' }),
      task({ key: 'CHILD', parent_key: 'PARENT', parent_task_id: 'PARENT' }),
    ];
    const order: RankedTask[] = startOrder(rankTasks(tasks, []));
    expect(order.map((r) => r.task.key)).toEqual(['CHILD']);
  });

  it('blocks a child on its parent’s unmet prerequisites', () => {
    const tasks = [
      task({ key: 'GATE' }),
      task({ key: 'PARENT', is_blocked: true, unmet_count: 1, blocked_by_keys: ['GATE'] }),
      task({ key: 'CHILD', parent_key: 'PARENT', parent_task_id: 'PARENT' }),
    ];
    const ranked = rankTasks(tasks, [{ from: 'PARENT', to: 'GATE' }]);
    const child = ranked.find((r) => r.task.key === 'CHILD')!;

    // The board would call this child free: it declares no dependencies.
    expect(child.task.is_blocked).toBe(false);
    expect(child.ready).toBe(false);
    expect(child.blockedByParent).toEqual(['GATE']);
    expect(startOrder(ranked).map((r) => r.task.key)).toEqual(['GATE']);
  });

  it('gives a child its parent’s downstream leverage', () => {
    const tasks = [
      task({ key: 'PARENT' }),
      task({ key: 'CHILD', parent_key: 'PARENT', parent_task_id: 'PARENT' }),
      task({ key: 'AFTER', is_blocked: true, unmet_count: 1, blocked_by_keys: ['PARENT'] }),
    ];
    const ranked = rankTasks(tasks, [{ from: 'AFTER', to: 'PARENT' }]);
    // CHILD declares nothing, but finishing it is what lets AFTER start.
    expect(ranked.find((r) => r.task.key === 'CHILD')!.unlocks).toBe(1);
  });

  it('counts unlocks in units of work, ignoring containers', () => {
    const tasks = [
      task({ key: 'ROOT' }),
      task({ key: 'BOX', is_blocked: true, unmet_count: 1, blocked_by_keys: ['ROOT'] }),
      task({ key: 'BOX-A', parent_key: 'BOX', parent_task_id: 'BOX' }),
      task({ key: 'BOX-B', parent_key: 'BOX', parent_task_id: 'BOX' }),
    ];
    // BOX is a heading over two leaves: two pieces of work, not three rows.
    expect(
      rankTasks(tasks, [{ from: 'BOX', to: 'ROOT' }]).find((r) => r.task.key === 'ROOT')!.unlocks,
    ).toBe(2);
  });
});
