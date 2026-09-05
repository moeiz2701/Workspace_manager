import Link from 'next/link';
import { Lock, Zap } from 'lucide-react';

import { PersonBadgeStack } from '@/components/shell/person-badge';
import { CategoryChip, StatusIcon } from '@/components/task/task-signals';
import type { TaskCard } from '@/types/app';

/**
 * "Blocked right now", sorted by how many tasks each blocker would unblock
 * (§7.2). This is the highest-value screen for the admin: it says which task to
 * push on next, rather than just which tasks are stuck.
 */
export function BlockedPanel({
  tasks,
  edges,
}: {
  tasks: TaskCard[];
  edges: { from: string; to: string }[];
}) {
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const blocked = tasks.filter((t) => t.is_blocked && t.status !== 'cancelled');

  // How many currently blocked tasks each unmet blocker is holding up.
  const holdCount = new Map<string, number>();
  for (const task of blocked) {
    for (const blocker of task.blocked_by_keys) {
      holdCount.set(blocker, (holdCount.get(blocker) ?? 0) + 1);
    }
  }

  const blockers = [...holdCount.entries()]
    .map(([key, count]) => ({ task: byKey.get(key), count }))
    .filter((entry): entry is { task: TaskCard; count: number } => !!entry.task)
    .sort((a, b) => b.count - a.count || a.task.key.localeCompare(b.task.key));

  // Tasks that would unblock the most work, weighted the same way.
  const worstFirst = [...blocked].sort(
    (a, b) =>
      Math.max(...b.blocked_by_keys.map((k) => holdCount.get(k) ?? 0), 0) -
        Math.max(...a.blocked_by_keys.map((k) => holdCount.get(k) ?? 0), 0) ||
      a.key.localeCompare(b.key),
  );

  if (blocked.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-eyebrow">Blocked right now</h2>
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nothing is blocked. Every task with dependencies has them satisfied.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-eyebrow">Blocked right now · {blocked.length}</h2>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ul className="divide-y rounded-lg border">
          {worstFirst.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <StatusIcon status={task.status} isBlocked className="text-muted-foreground" />
              <Link href={`/tasks/${task.key}`} className="min-w-0 flex-1 truncate hover:underline">
                <code className="text-muted-foreground mr-2 text-xs font-semibold">{task.key}</code>
                {task.title}
              </Link>
              <CategoryChip name={task.category_name} color={task.category_color} />
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <Lock className="size-3" />
                {task.blocked_by_keys.join(', ')}
              </span>
              <PersonBadgeStack people={task.assignees} size="xs" />
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold">
            <Zap className="size-3.5" />
            Push on these first
          </h3>
          <ul className="divide-y rounded-lg border">
            {blockers.slice(0, 8).map(({ task, count }) => (
              <li key={task.id} className="flex items-center gap-2 p-2.5 text-sm">
                <StatusIcon
                  status={task.status}
                  isBlocked={task.is_blocked}
                  className="text-muted-foreground"
                />
                <Link
                  href={`/tasks/${task.key}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  <code className="text-muted-foreground mr-1.5 text-xs font-semibold">
                    {task.key}
                  </code>
                  {task.title}
                </Link>
                <span
                  title={`Finishing this unblocks ${count} task${count === 1 ? '' : 's'}`}
                  className="bg-muted shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums"
                >
                  +{count}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            The number is how many blocked tasks each one is holding up. {edges.length} dependency
            edges in total.
          </p>
        </div>
      </div>
    </section>
  );
}
