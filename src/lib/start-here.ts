import type { TaskCard } from '@/types/app';

/**
 * "What should I start?" — the ranking behind /start.
 *
 * The board answers "what is not blocked", which on a plan this shape is not an
 * answer: 148 of 347 tasks declare no dependencies, so 43% of the plan is
 * technically startable at any moment. Ranking, not filtering, is what turns
 * that pile into an order.
 *
 * THE PARENT/CHILD RELATIONSHIP IS A DEPENDENCY, and getting that wrong is the
 * whole difficulty. This plan is two levels deep, and dependencies are declared
 * at BOTH levels — 145 edges point at a container, 141 at a leaf. So:
 *
 *   - Leverage lives on containers, work lives on children. 'Unify the two
 *     authentication systems' releases 38 tasks but is a heading; its three
 *     children are the actual work. Ranked naively, the highest-leverage item in
 *     the plan never appears in the queue at all.
 *   - A container is only finished when its children are, so anything waiting on
 *     the container is really waiting on the children. A child therefore
 *     inherits its parent's downstream.
 *   - Symmetrically, a child cannot start before its parent could. 87 leaves in
 *     this plan declare no dependencies while their parent does; offered as-is
 *     they are 87 false invitations to start.
 *
 * Both follow from one edge: child -> parent, "the child is a prerequisite of
 * the parent". Add it to the declared graph and leverage and readiness both come
 * out right.
 *
 * Ranking signals, in priority order:
 *
 *   1. phase      — the declared timeline. Trustworthy here because the plan's
 *                   phases and its dependency graph agree: of 44 edges crossing
 *                   a phase boundary, none points at a later phase.
 *   2. ready      — own prerequisites met AND the parent's met.
 *   3. unlocks    — transitive count of unfinished LEAF work this releases.
 *                   Leaves only, so the number means "pieces of work", not
 *                   "rows in the table". The board cannot show this: its
 *                   `blocks_count` is direct dependents only.
 *   4. gatesChain — longest chain of unfinished work hanging off this task.
 *                   Separates a task holding up a deep spine from one whose
 *                   dependents are a flat fan.
 *
 * Everything is derived from the task list the page already loads, so these
 * numbers cannot drift from the board's.
 */

const OPEN: ReadonlySet<string> = new Set(['todo', 'in_progress', 'in_review']);

export type RankedTask = {
  task: TaskCard;
  /** Unfinished leaf tasks transitively released by finishing this one. */
  unlocks: number;
  /** Longest chain of unfinished work this task gates, including itself. */
  gatesChain: number;
  /** Own prerequisites met and the parent's met. */
  ready: boolean;
  /**
   * Unmet prerequisites inherited from an ancestor, never from the task itself.
   * The board shows a task's own blockers; this is the reason a task that looks
   * free on the board is still not offered here.
   */
  blockedByParent: string[];
  /** No children — a container is a heading, not a piece of work. */
  isLeaf: boolean;
};

const PRIORITY_RANK: Record<TaskCard['priority'], number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/**
 * Rank every task. Callers filter; this function does not, so the counts stay
 * stable no matter which slice is being shown.
 */
export function rankTasks(tasks: TaskCard[], edges: { from: string; to: string }[]): RankedTask[] {
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const isOpen = (key: string) => OPEN.has(byKey.get(key)?.status ?? '');

  const children = new Map<string, string[]>();
  for (const t of tasks) {
    if (!t.parent_key || !byKey.has(t.parent_key)) continue;
    children.set(t.parent_key, [...(children.get(t.parent_key) ?? []), t.key]);
  }
  const isLeaf = (key: string) => !children.has(key);

  // prerequisite -> dependents, declared edges only. Edges with an end outside
  // the loaded set are dropped. The tree is applied separately, below, because
  // it flows in BOTH directions and folding it in here would make a cycle.
  const dependents = new Map<string, string[]>();
  for (const edge of edges) {
    if (!byKey.has(edge.from) || !byKey.has(edge.to)) continue;
    dependents.set(edge.to, [...(dependents.get(edge.to) ?? []), edge.from]);
  }

  const ancestorsOf = (task: TaskCard): TaskCard[] => {
    const chain: TaskCard[] = [];
    const seen = new Set<string>([task.key]);
    let parent = task.parent_key ? byKey.get(task.parent_key) : undefined;
    while (parent && !seen.has(parent.key)) {
      seen.add(parent.key);
      chain.push(parent);
      parent = parent.parent_key ? byKey.get(parent.parent_key) : undefined;
    }
    return chain;
  };

  /** A container plus everything under it — unblocking the heading frees the work. */
  function withDescendants(key: string, into: Set<string>) {
    if (into.has(key)) return;
    into.add(key);
    for (const child of children.get(key) ?? []) withDescendants(child, into);
  }

  /**
   * Everything finishing `key` puts in play: its declared dependents, each
   * expanded into the work underneath it, followed transitively. Never includes
   * `key`'s own subtree — a task's siblings are not its consequence.
   */
  const releaseCache = new Map<string, Set<string>>();
  function releaseSet(key: string): Set<string> {
    const cached = releaseCache.get(key);
    if (cached) return cached;

    const out = new Set<string>();
    releaseCache.set(key, out); // seed before recursing so a cycle terminates

    let frontier = new Set<string>();
    for (const d of dependents.get(key) ?? []) withDescendants(d, frontier);

    while (frontier.size > 0) {
      const next = new Set<string>();
      for (const node of frontier) {
        if (out.has(node)) continue;
        out.add(node);
        for (const d of dependents.get(node) ?? []) withDescendants(d, next);
      }
      frontier = next;
    }

    return out;
  }

  /**
   * Work released by this task, counting its ancestors' consequences too: a
   * child is a prerequisite of its parent, so it is a step toward everything
   * the parent gates. Counted in leaves, so the figure is pieces of work.
   */
  function unlocksOf(task: TaskCard): number {
    const all = new Set<string>(releaseSet(task.key));
    for (const ancestor of ancestorsOf(task)) {
      for (const k of releaseSet(ancestor.key)) all.add(k);
    }

    let count = 0;
    for (const k of all) if (isOpen(k) && isLeaf(k)) count += 1;
    return count;
  }

  /**
   * Longest chain of open work hanging off this task. Stepping to a dependent
   * costs 1; descending into a container's children costs 0, because a heading
   * and its work occupy the same place in the order.
   */
  const chainCache = new Map<string, number>();
  function chainOf(key: string, visiting = new Set<string>()): number {
    const cached = chainCache.get(key);
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return 0;

    visiting.add(key);
    let longest = 0;
    const successors = new Set<string>();
    for (const d of dependents.get(key) ?? []) withDescendants(d, successors);
    for (const next of successors) {
      if (!isOpen(next)) continue;
      longest = Math.max(longest, chainOf(next, visiting));
    }
    visiting.delete(key);

    const total = longest + 1;
    chainCache.set(key, total);
    return total;
  }

  /** Unmet blockers of every ancestor, nearest first. */
  function inheritedBlockers(task: TaskCard): string[] {
    const found: string[] = [];
    for (const ancestor of ancestorsOf(task)) {
      for (const key of ancestor.blocked_by_keys) {
        if (!found.includes(key)) found.push(key);
      }
    }
    return found;
  }

  return tasks.map((task) => {
    const blockedByParent = inheritedBlockers(task);
    return {
      task,
      unlocks: unlocksOf(task),
      gatesChain: chainOf(task.key),
      ready: !task.is_blocked && blockedByParent.length === 0,
      blockedByParent,
      isLeaf: isLeaf(task.key),
    };
  });
}

/**
 * The queue: open, ready, actionable leaves in the order they should be picked
 * up. Containers are excluded — finishing a heading is not a task, and its
 * leverage has already been pushed down onto its children.
 */
export function startOrder(ranked: RankedTask[]): RankedTask[] {
  return ranked.filter((r) => OPEN.has(r.task.status) && r.ready && r.isLeaf).sort(compareForStart);
}

export function compareForStart(a: RankedTask, b: RankedTask): number {
  // Unphased tasks sort after every phase rather than before phase 1.
  const phaseA = a.task.phase ?? Number.MAX_SAFE_INTEGER;
  const phaseB = b.task.phase ?? Number.MAX_SAFE_INTEGER;
  if (phaseA !== phaseB) return phaseA - phaseB;

  if (a.unlocks !== b.unlocks) return b.unlocks - a.unlocks;
  if (a.gatesChain !== b.gatesChain) return b.gatesChain - a.gatesChain;

  const priority = PRIORITY_RANK[b.task.priority] - PRIORITY_RANK[a.task.priority];
  if (priority !== 0) return priority;

  if (a.task.position !== b.task.position) return a.task.position - b.task.position;
  return a.task.key.localeCompare(b.task.key);
}

/** Group a ranked queue by phase, in phase order, unphased last. */
export function byPhase(ranked: RankedTask[]): { phase: number | null; tasks: RankedTask[] }[] {
  const groups = new Map<number | null, RankedTask[]>();
  for (const r of ranked) {
    const key = r.task.phase ?? null;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER))
    .map(([phase, tasks]) => ({ phase, tasks }));
}

/**
 * The phase the team is actually on: the earliest with unfinished work. /start
 * leads with it, so nobody is shown a phase-4 queue while phase 1 is open.
 */
export function currentPhase(tasks: TaskCard[]): number | null {
  const open = tasks
    .filter((t) => OPEN.has(t.status) && t.phase !== null)
    .map((t) => t.phase as number);
  return open.length > 0 ? Math.min(...open) : null;
}

/** A person's own queue, same ordering. */
export function myQueue(ranked: RankedTask[], profileId: string): RankedTask[] {
  return startOrder(ranked).filter((r) => r.task.assignees.some((a) => a.id === profileId));
}

/**
 * Work that is in flight, so /start can say "you already have these open"
 * before it suggests anything new.
 */
export function inFlight(ranked: RankedTask[]): RankedTask[] {
  return ranked
    .filter((r) => r.isLeaf && (r.task.status === 'in_progress' || r.task.status === 'in_review'))
    .sort(compareForStart);
}
