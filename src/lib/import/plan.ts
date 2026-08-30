import type { ImportPayload } from '@/lib/schemas/import';
import type { TaskStatus } from '@/types/app';

/**
 * Step 2 of the import pipeline (§6.2): a static plan computed before the
 * database is touched at all.
 *
 * This is where reference errors and cycles are caught, so the admin sees
 * "ML-01 → BT-01 → ML-01" instead of a bare Postgres error. The database still
 * enforces every one of these rules independently (§2, rule 3) — this pass
 * exists to make the failure legible, not to be the guard.
 */

export type PlanIssue = {
  level: 'error' | 'warning';
  message: string;
  /** Task or category key the issue belongs to, when there is one. */
  ref?: string;
};

/** What the database already contains, so the plan can tell new from updated. */
export type PlanContext = {
  categoryKeys: Set<string>;
  /** taskKey -> current status */
  taskStatuses: Map<string, TaskStatus>;
  /** lowercased emails of existing profiles */
  emails: Set<string>;
  /** taskKey -> keys it currently depends on */
  dependencies: Map<string, Set<string>>;
  /** taskKey -> current parent key */
  parents: Map<string, string | null>;
};

export const emptyPlanContext = (): PlanContext => ({
  categoryKeys: new Set(),
  taskStatuses: new Map(),
  emails: new Set(),
  dependencies: new Map(),
  parents: new Map(),
});

export type ImportPlan = {
  ok: boolean;
  issues: PlanIssue[];
  counts: {
    categoriesCreated: number;
    categoriesUpdated: number;
    tasksCreated: number;
    tasksUpdated: number;
    dependencyEdges: number;
    assigneeLinks: number;
  };
  /** Per-task summary for the expandable dry-run list. */
  tasks: {
    key: string;
    title: string;
    category: string;
    action: 'create' | 'update';
    status: TaskStatus;
    assignees: string[];
    dependsOn: string[];
    parent: string | null;
    unknownAssignees: string[];
  }[];
};

/** A dependency counts as met when the upstream task is done or cancelled. */
const SATISFIED: TaskStatus[] = ['done', 'cancelled'];
/** Statuses a task may only hold once every dependency is satisfied. */
const GATED: TaskStatus[] = ['in_progress', 'in_review', 'done'];

export function planImport(payload: ImportPayload, context: PlanContext): ImportPlan {
  const issues: PlanIssue[] = [];

  const fileTaskKeys = new Set(payload.tasks.map((t) => t.key));
  const knownTaskKeys = new Set([...fileTaskKeys, ...context.taskStatuses.keys()]);
  const knownCategoryKeys = new Set([
    ...payload.categories.map((c) => c.key),
    ...context.categoryKeys,
  ]);

  // ---- members -----------------------------------------------------------
  for (const member of payload.members ?? []) {
    if (!context.emails.has(member.email.toLowerCase())) {
      issues.push({
        level: 'warning',
        ref: member.email,
        message: `No profile for ${member.email} — they must sign in with Google first`,
      });
    }
  }

  // ---- references --------------------------------------------------------
  for (const task of payload.tasks) {
    if (!knownCategoryKeys.has(task.category)) {
      issues.push({
        level: 'error',
        ref: task.key,
        message: `${task.key} references unknown category "${task.category}"`,
      });
    }

    if (task.parent && !knownTaskKeys.has(task.parent)) {
      issues.push({
        level: 'error',
        ref: task.key,
        message: `${task.key} references unknown parent "${task.parent}"`,
      });
    }

    for (const dep of task.depends_on) {
      if (!knownTaskKeys.has(dep)) {
        issues.push({
          level: 'error',
          ref: task.key,
          message: `${task.key} depends on unknown task "${dep}"`,
        });
      }
    }
  }

  // ---- cycles ------------------------------------------------------------
  // The file replaces the dependency set of every task it mentions; tasks it
  // does not mention keep whatever the database already has.
  const depEdges = new Map<string, Set<string>>();
  for (const [key, deps] of context.dependencies) {
    depEdges.set(key, new Set(deps));
  }
  for (const task of payload.tasks) {
    depEdges.set(task.key, new Set(task.depends_on.filter((d) => knownTaskKeys.has(d))));
  }

  for (const chain of findCycles(depEdges)) {
    issues.push({
      level: 'error',
      ref: chain[0],
      message: `Circular dependency: ${chain.join(' → ')}`,
    });
  }

  const parentEdges = new Map<string, Set<string>>();
  for (const [key, parent] of context.parents) {
    if (parent) parentEdges.set(key, new Set([parent]));
  }
  for (const task of payload.tasks) {
    if (task.parent && knownTaskKeys.has(task.parent)) {
      parentEdges.set(task.key, new Set([task.parent]));
    } else if (task.parent === null) {
      parentEdges.delete(task.key);
    }
  }

  for (const chain of findCycles(parentEdges)) {
    issues.push({
      level: 'error',
      ref: chain[0],
      message: `Circular task hierarchy: ${chain.join(' → ')}`,
    });
  }

  // ---- declared status vs the dependency gate ----------------------------
  // On an update the file never overwrites status — work in flight wins — so
  // only newly created tasks can declare a status that breaks the gate.
  const finalStatus = new Map<string, TaskStatus>(context.taskStatuses);
  for (const task of payload.tasks) {
    if (!context.taskStatuses.has(task.key)) finalStatus.set(task.key, task.status);
  }

  for (const task of payload.tasks) {
    const status = finalStatus.get(task.key)!;
    if (!GATED.includes(status)) continue;

    const unmet = [...(depEdges.get(task.key) ?? [])].filter((dep) => {
      const depStatus = finalStatus.get(dep);
      return !depStatus || !SATISFIED.includes(depStatus);
    });

    if (unmet.length > 0) {
      issues.push({
        level: 'error',
        ref: task.key,
        message: `${task.key} is declared "${status}" but is blocked by ${unmet.sort().join(', ')}`,
      });
    }
  }

  // A parent may not be `done` while a child is open.
  const childrenOf = new Map<string, string[]>();
  for (const [child, parents] of parentEdges) {
    for (const parent of parents) {
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), child]);
    }
  }
  for (const task of payload.tasks) {
    if (finalStatus.get(task.key) !== 'done') continue;
    const open = (childrenOf.get(task.key) ?? []).filter((child) => {
      const status = finalStatus.get(child);
      return !status || !SATISFIED.includes(status);
    });
    if (open.length > 0) {
      issues.push({
        level: 'error',
        ref: task.key,
        message: `${task.key} is declared "done" but has unfinished subtask(s): ${open.sort().join(', ')}`,
      });
    }
  }

  // ---- counts and per-task summary --------------------------------------
  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  for (const category of payload.categories) {
    if (context.categoryKeys.has(category.key)) categoriesUpdated += 1;
    else categoriesCreated += 1;
  }

  let tasksCreated = 0;
  let tasksUpdated = 0;
  let dependencyEdges = 0;
  let assigneeLinks = 0;

  const tasks: ImportPlan['tasks'] = payload.tasks.map((task) => {
    const exists = context.taskStatuses.has(task.key);
    if (exists) tasksUpdated += 1;
    else tasksCreated += 1;

    dependencyEdges += task.depends_on.length;
    assigneeLinks += task.assignees.length;

    const unknownAssignees = task.assignees.filter((e) => !context.emails.has(e.toLowerCase()));
    for (const email of unknownAssignees) {
      issues.push({
        level: 'warning',
        ref: task.key,
        message: `${task.key}: no profile for ${email} — assignment skipped`,
      });
    }

    return {
      key: task.key,
      title: task.title,
      category: task.category,
      action: exists ? ('update' as const) : ('create' as const),
      status: exists ? context.taskStatuses.get(task.key)! : task.status,
      assignees: task.assignees,
      dependsOn: task.depends_on,
      parent: task.parent ?? null,
      unknownAssignees,
    };
  });

  return {
    ok: !issues.some((i) => i.level === 'error'),
    issues,
    counts: {
      categoriesCreated,
      categoriesUpdated,
      tasksCreated,
      tasksUpdated,
      dependencyEdges,
      assigneeLinks,
    },
    tasks,
  };
}

/**
 * Kahn's algorithm strips every node that can be topologically ordered; what
 * remains is exactly the nodes that participate in a cycle. A DFS over that
 * residue then extracts a concrete chain to show the admin.
 */
export function findCycles(edges: Map<string, Set<string>>): string[][] {
  const nodes = new Set<string>();
  for (const [from, tos] of edges) {
    nodes.add(from);
    for (const to of tos) nodes.add(to);
  }

  const outDegree = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  for (const node of nodes) {
    outDegree.set(node, 0);
    incoming.set(node, []);
  }
  for (const [from, tos] of edges) {
    outDegree.set(from, (outDegree.get(from) ?? 0) + tos.size);
    for (const to of tos) incoming.set(to, [...(incoming.get(to) ?? []), from]);
  }

  // Peel nodes with no outstanding edges.
  const queue = [...nodes].filter((n) => (outDegree.get(n) ?? 0) === 0);
  const settled = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (settled.has(node)) continue;
    settled.add(node);

    for (const dependent of incoming.get(node) ?? []) {
      const remaining = (outDegree.get(dependent) ?? 0) - 1;
      outDegree.set(dependent, remaining);
      if (remaining === 0) queue.push(dependent);
    }
  }

  // What is left is every node that cannot be ordered: the nodes inside a
  // cycle, plus the nodes that merely lead into one. Only the former are worth
  // reporting, which is what the DFS below picks out.
  const residue = [...nodes].filter((n) => !settled.has(n));
  if (residue.length === 0) return [];

  const inResidue = new Set(residue);
  const cycles: string[][] = [];
  const seen = new Set<string>();

  for (const start of [...residue].sort()) {
    const path: string[] = [];
    const onPath = new Set<string>();
    let found: string[] | null = null;

    const walk = (node: string): boolean => {
      if (onPath.has(node)) {
        found = [...path.slice(path.indexOf(node)), node];
        return true;
      }
      if (!inResidue.has(node)) return false;

      path.push(node);
      onPath.add(node);

      for (const next of [...(edges.get(node) ?? [])].sort()) {
        if (walk(next)) return true;
      }

      path.pop();
      onPath.delete(node);
      return false;
    };

    if (walk(start) && found) {
      const chain = found as string[];
      // Several start nodes reach the same cycle; report each cycle once.
      const signature = [...new Set(chain)].sort().join('|');
      if (seen.has(signature)) continue;
      seen.add(signature);
      cycles.push(chain);
    }
  }

  return cycles;
}
