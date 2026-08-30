'use client';

import { CornerDownRight, GitBranch, MessageSquare } from 'lucide-react';

import { PersonBadgeStack } from '@/components/shell/person-badge';
import {
  BlockedChip,
  CategoryChip,
  PriorityEdge,
  StatusIcon,
} from '@/components/task/task-signals';
import { colorOf } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { TaskCard as TaskCardType } from '@/types/app';

/**
 * One second of looking should answer: whose is it, which part of the product,
 * can it be started (§7). Blocked cards additionally drop to 70% opacity and
 * carry a dashed border — never colour alone.
 */
export function TaskCard({
  task,
  onOpen,
  dragging,
  className,
  showCategory = true,
}: {
  task: TaskCardType;
  onOpen?: () => void;
  dragging?: boolean;
  className?: string;
  showCategory?: boolean;
}) {
  const blocked = task.is_blocked && task.status === 'todo';
  const category = colorOf(task.category_color);

  return (
    <article
      onClick={onOpen}
      className={cn(
        'group bg-card relative w-full rounded-md border border-l-4 p-2.5 text-left shadow-xs transition-shadow',
        category.border,
        onOpen && 'cursor-pointer hover:shadow-md',
        blocked && 'border-dashed opacity-70',
        dragging && 'shadow-lg ring-2 ring-offset-1',
        className,
      )}
    >
      <PriorityEdge priority={task.priority} />

      <div className="flex items-start gap-2">
        <StatusIcon
          status={task.status}
          isBlocked={task.is_blocked}
          className="text-muted-foreground mt-0.5"
        />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <code className="text-muted-foreground text-[10px] font-semibold tracking-wide">
              {task.key}
            </code>
            {task.parent_key ? (
              <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
                <CornerDownRight className="size-2.5" />
                {task.parent_key}
              </span>
            ) : null}
          </div>

          <p className="text-sm leading-snug font-medium">{task.title}</p>

          <div className="flex flex-wrap items-center gap-1.5">
            {showCategory ? (
              <CategoryChip name={task.category_name} color={task.category_color} />
            ) : null}

            {blocked ? <BlockedChip blockers={task.blocked_by_keys} /> : null}

            {task.child_count > 0 ? (
              <span className="text-muted-foreground text-[10px] tabular-nums">
                {task.child_done_count}/{task.child_count} subtasks
              </span>
            ) : null}

            {task.blocks_count > 0 ? (
              <span
                title={`Unblocks ${task.blocks_count} task${task.blocks_count === 1 ? '' : 's'}`}
                className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]"
              >
                <GitBranch className="size-2.5" />
                {task.blocks_count}
              </span>
            ) : null}
          </div>
        </div>

        <PersonBadgeStack people={task.assignees} size="xs" />
      </div>
    </article>
  );
}

/** Placeholder used by the drag overlay so the column keeps its height. */
export function TaskCardSkeleton() {
  return (
    <div className="bg-muted/40 flex h-20 items-center justify-center rounded-md border border-dashed">
      <MessageSquare className="text-muted-foreground/40 size-4" />
    </div>
  );
}
