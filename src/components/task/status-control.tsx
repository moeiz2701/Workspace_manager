'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setTaskStatus } from '@/lib/actions/tasks';
import { STATUS_LABELS, type TaskCard, type TaskStatus } from '@/types/app';

const ALL: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];

/**
 * Mirrors the database rule in the UI (§0): a blocked task cannot leave `todo`,
 * so the control is disabled with the blockers named. The RPC enforces it
 * regardless of what this component allows.
 */
export function StatusControl({ task, canEdit }: { task: TaskCard; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const blocked = task.is_blocked;
  const openChildren = task.child_count - task.child_done_count;

  const reasonFor = (status: TaskStatus): string | null => {
    if (blocked && status !== 'todo' && status !== 'cancelled') {
      return `Blocked by ${task.blocked_by_keys.join(', ')}`;
    }
    if (status === 'done' && openChildren > 0) {
      return `${openChildren} unfinished subtask${openChildren === 1 ? '' : 's'}`;
    }
    return null;
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={task.status}
        disabled={!canEdit || pending}
        onValueChange={(value) =>
          startTransition(async () => {
            const res = await setTaskStatus(task.id, value);
            if (res.error) toast.error(res.error, { duration: 6000 });
            else {
              toast.success(`${task.key} → ${STATUS_LABELS[value as TaskStatus]}`);
              router.refresh();
            }
          })
        }
      >
        <SelectTrigger className="h-8 w-40" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL.map((status) => {
            const reason = reasonFor(status);
            return (
              <SelectItem key={status} value={status} disabled={!!reason} title={reason ?? ''}>
                <span className="flex items-center gap-2">
                  {STATUS_LABELS[status]}
                  {reason ? <Lock className="text-muted-foreground size-3" /> : null}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {!canEdit ? (
        <span className="text-muted-foreground text-xs">You are not assigned to this task</span>
      ) : blocked ? (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Lock className="size-3" />
          Blocked by {task.blocked_by_keys.join(', ')}
        </span>
      ) : null}
    </div>
  );
}
