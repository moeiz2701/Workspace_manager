import { Check, Circle, CircleDot, Eye, Lock, Minus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { colorOf } from '@/lib/colors';
import { STATUS_LABELS, type TaskPriority, type TaskStatus } from '@/types/app';

/**
 * The three signals a card must carry (§7), each in its OWN channel:
 *   who        -> person colour badge (see PersonBadge)
 *   which area -> category colour: left border + chip
 *   can I start it? -> SHAPE, not colour: open dot / lock / half circle / check
 *   urgency    -> priority edge bar, high and critical only
 */

const STATUS_ICONS: Record<TaskStatus, typeof Circle> = {
  todo: Circle,
  in_progress: CircleDot,
  in_review: Eye,
  done: Check,
  cancelled: X,
};

export function StatusIcon({
  status,
  isBlocked,
  className,
}: {
  status: TaskStatus;
  isBlocked?: boolean;
  className?: string;
}) {
  if (isBlocked && status === 'todo') {
    return <Lock className={cn('size-3.5 shrink-0', className)} aria-label="Blocked" />;
  }
  const Icon = STATUS_ICONS[status];
  return <Icon className={cn('size-3.5 shrink-0', className)} aria-label={STATUS_LABELS[status]} />;
}

export function CategoryChip({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
        colorOf(color).chip,
        className,
      )}
    >
      {name}
    </span>
  );
}

/**
 * Priority is shown only when it is actionable: high and critical. A `!` glyph
 * carries `critical` so it is not colour alone.
 */
export function PriorityMark({ priority }: { priority: TaskPriority }) {
  if (priority === 'low') {
    return (
      <span title="Low priority" className="text-muted-foreground inline-flex items-center">
        <Minus className="size-3" />
      </span>
    );
  }
  if (priority === 'medium') return null;

  return (
    <span
      title={priority === 'critical' ? 'Critical' : 'High priority'}
      className={cn(
        'inline-flex items-center rounded px-1 text-[10px] font-bold',
        priority === 'critical'
          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
          : 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
      )}
    >
      {priority === 'critical' ? '!' : '↑'}
      <span className="ml-0.5">{priority === 'critical' ? 'Critical' : 'High'}</span>
    </span>
  );
}

/** The thin left edge bar carrying urgency, drawn over the category border. */
export function PriorityEdge({ priority }: { priority: TaskPriority }) {
  if (priority !== 'high' && priority !== 'critical') return null;
  return (
    <span
      aria-hidden
      className={cn(
        'absolute inset-y-0 left-0 w-[3px]',
        priority === 'critical' ? 'bg-rose-500' : 'bg-orange-500',
      )}
    />
  );
}

export function BlockedChip({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) return null;
  return (
    <span
      title={`Blocked by ${blockers.join(', ')}`}
      className="inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-[10px] font-medium"
    >
      <Lock className="size-3" />
      {blockers.join(', ')}
    </span>
  );
}
