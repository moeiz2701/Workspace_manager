import { format } from 'date-fns';
import { History } from 'lucide-react';

import { PersonBadge } from '@/components/shell/person-badge';
import type { ActivityEntry } from '@/lib/comments';
import { STATUS_LABELS, type TaskStatus } from '@/types/app';

/**
 * The audit trail (§7.2): "Ali moved this from To Do → In Progress · 2 Sep,
 * 14:02". Written only by SECURITY DEFINER triggers — there is no insert policy
 * on `task_activity`, so nothing here can be forged from the client.
 */
export function ActivityTimeline({
  entries,
  names,
}: {
  entries: ActivityEntry[];
  /** id -> display name, for entries whose value is a profile or category id. */
  names: Record<string, string>;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase">
        <History className="size-3.5" />
        Activity
      </h2>

      <ol className="space-y-2.5">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-2.5 text-sm">
            {entry.actor ? (
              <PersonBadge person={entry.actor} size="xs" className="mt-0.5" />
            ) : (
              <span className="bg-muted ring-background mt-0.5 inline-flex size-5 items-center justify-center rounded-full text-[9px] font-semibold ring-2">
                ·
              </span>
            )}

            <p className="min-w-0 flex-1">
              <span className="font-medium">
                {entry.actor?.full_name ?? entry.actor?.email ?? 'The system'}
              </span>{' '}
              <span className="text-muted-foreground">{describe(entry, names)}</span>
              <time className="text-muted-foreground ml-1.5 text-[11px] whitespace-nowrap">
                · {format(new Date(entry.created_at), 'd MMM, HH:mm')}
              </time>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function describe(entry: ActivityEntry, names: Record<string, string>): string {
  const name = (value: string | null) => (value ? (names[value] ?? value) : 'nothing');
  const status = (value: string | null) =>
    value ? (STATUS_LABELS[value as TaskStatus] ?? value) : '—';

  switch (entry.type) {
    case 'created':
      return 'created this task';
    case 'status_changed':
      return `moved this from ${status(entry.from_value)} → ${status(entry.to_value)}`;
    case 'assignee_added':
      return `assigned ${name(entry.to_value)}`;
    case 'assignee_removed':
      return `unassigned ${name(entry.from_value)}`;
    case 'dependency_added':
      return `added a dependency on ${entry.to_value}`;
    case 'dependency_removed':
      return `removed the dependency on ${entry.from_value}`;
    case 'note_updated':
      return 'updated the note to assignees';
    case 'category_changed':
      return `moved this to ${name(entry.to_value)}`;
    case 'priority_changed':
      return `changed priority ${entry.from_value} → ${entry.to_value}`;
    case 'parent_changed':
      return entry.to_value
        ? `made this a subtask of ${name(entry.to_value)}`
        : 'made this a top-level task';
    case 'imported':
      return `imported this from ${String((entry.metadata as { filename?: string }).filename ?? 'a JSON file')}`;
    default:
      return entry.type;
  }
}
