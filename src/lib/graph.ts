import type { TaskCard } from '@/types/app';

/**
 * The critical path: the longest chain of dependencies in the graph.
 *
 * Every task on it delays everything downstream of it, so it is the chain worth
 * staring at. Computed by longest-path over the DAG (the database refuses
 * cycles, so a topological order always exists).
 */
export function criticalPath(
  tasks: TaskCard[],
  edges: { from: string; to: string }[],
): Set<string> {
  const keys = new Set(tasks.map((t) => t.key));

  // prerequisite -> dependents
  const next = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const key of keys) indegree.set(key, 0);

  for (const edge of edges) {
    if (!keys.has(edge.from) || !keys.has(edge.to)) continue;
    next.set(edge.to, [...(next.get(edge.to) ?? []), edge.from]);
    indegree.set(edge.from, (indegree.get(edge.from) ?? 0) + 1);
  }

  const queue = [...keys].filter((k) => (indegree.get(k) ?? 0) === 0).sort();
  const order: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const dependent of next.get(node) ?? []) {
      const remaining = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) queue.push(dependent);
    }
  }

  // Longest path in topological order, remembering how we got there.
  const length = new Map<string, number>();
  const from = new Map<string, string | null>();
  for (const key of keys) {
    length.set(key, 1);
    from.set(key, null);
  }

  for (const node of order) {
    for (const dependent of next.get(node) ?? []) {
      const candidate = (length.get(node) ?? 1) + 1;
      if (candidate > (length.get(dependent) ?? 1)) {
        length.set(dependent, candidate);
        from.set(dependent, node);
      }
    }
  }

  let end: string | null = null;
  let best = 0;
  for (const [key, value] of length) {
    if (value > best || (value === best && end && key < end)) {
      best = value;
      end = key;
    }
  }

  const path = new Set<string>();
  // A single task with no dependencies is not a "path" worth highlighting.
  if (!end || best < 2) return path;

  let cursor: string | null = end;
  while (cursor) {
    path.add(cursor);
    cursor = from.get(cursor) ?? null;
  }

  return path;
}
