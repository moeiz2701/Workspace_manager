import Link from 'next/link';
import { GitBranch, Layers, Lock } from 'lucide-react';

import { PersonBadgeStack } from '@/components/shell/person-badge';
import { CategoryChip, PriorityMark, StatusIcon } from '@/components/task/task-signals';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { RankedTask } from '@/lib/start-here';

/**
 * One row of the queue. The two numbers on the right are the reason this task
 * sits where it does, and they are the whole point of the screen — a row that
 * cannot say WHY it is ranked is just another list.
 */
export function QueueRow({
  ranked,
  rank,
  emphasis = false,
}: {
  ranked: RankedTask;
  rank?: number;
  emphasis?: boolean;
}) {
  const { task, unlocks, gatesChain } = ranked;

  return (
    <li>
      <Link
        href={`/tasks/${task.key}`}
        className={cn(
          'group flex items-start gap-3 rounded-lg border p-3 transition-all',
          'hover:border-foreground/20 hover:bg-accent/40 hover:shadow-sm',
          'focus-visible:ring-ring/60 outline-none focus-visible:ring-2',
          emphasis ? 'bg-card shadow-xs' : 'bg-card/60',
        )}
      >
        {rank !== undefined ? (
          <span
            className={cn(
              'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums',
              emphasis ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {rank}
          </span>
        ) : (
          <StatusIcon status={task.status} className="text-muted-foreground mt-1" />
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-muted-foreground text-xs font-semibold">{task.key}</code>
            {task.phase !== null ? (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs font-semibold">
                P{task.phase}
              </span>
            ) : null}
            <PriorityMark priority={task.priority} />
          </div>

          <p
            className={cn(
              'leading-snug font-medium text-pretty',
              emphasis ? 'text-base' : 'text-sm',
            )}
          >
            {task.title}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <CategoryChip name={task.category_name} color={task.category_color} />
            <PersonBadgeStack people={task.assignees} size="xs" />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {unlocks > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold tabular-nums">
                  <GitBranch className="size-3.5" />
                  {unlocks}
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                Finishing this eventually releases {unlocks} {unlocks === 1 ? 'task' : 'tasks'}
              </TooltipContent>
            </Tooltip>
          ) : null}

          {gatesChain > 2 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium tabular-nums">
                  <Layers className="size-3.5" />
                  {gatesChain} deep
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                Sits at the head of a {gatesChain}-step chain — everything behind it waits
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

/** A task that looks free on the board but is held by its parent's prerequisites. */
export function BlockedByParentRow({ ranked }: { ranked: RankedTask }) {
  return (
    <li className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
      <Lock className="size-3.5 shrink-0" />
      <code className="text-xs font-semibold">{ranked.task.key}</code>
      <span className="min-w-0 flex-1 truncate">{ranked.task.title}</span>
      <span className="shrink-0 text-xs">
        waits on <code className="font-semibold">{ranked.blockedByParent.join(', ')}</code>
      </span>
    </li>
  );
}
