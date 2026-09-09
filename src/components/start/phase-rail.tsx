import { Check, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TaskCard } from '@/types/app';

export type PhaseSummary = {
  phase: number;
  total: number;
  done: number;
  inFlight: number;
  /** Leaves that could be picked up right now. */
  ready: number;
};

/**
 * The declared timeline, made visible. Rolled up from the same task rows the
 * queue ranks, so the rail and the queue cannot disagree.
 *
 * Only leaves are counted: a plan of 347 rows is 275 pieces of work and 72
 * headings, and counting headings would make every phase look bigger than the
 * work it contains.
 */
export function summarisePhases(tasks: TaskCard[], readyKeys: Set<string>): PhaseSummary[] {
  const parents = new Set(tasks.filter((t) => t.parent_key).map((t) => t.parent_key as string));

  const byPhase = new Map<number, PhaseSummary>();

  for (const task of tasks) {
    if (task.phase === null) continue;
    if (parents.has(task.key)) continue; // heading, not work
    if (task.status === 'cancelled') continue;

    const row =
      byPhase.get(task.phase) ??
      ({ phase: task.phase, total: 0, done: 0, inFlight: 0, ready: 0 } satisfies PhaseSummary);

    row.total += 1;
    if (task.status === 'done') row.done += 1;
    if (task.status === 'in_progress' || task.status === 'in_review') row.inFlight += 1;
    if (readyKeys.has(task.key)) row.ready += 1;

    byPhase.set(task.phase, row);
  }

  return [...byPhase.values()].sort((a, b) => a.phase - b.phase);
}

export function PhaseRail({ phases, current }: { phases: PhaseSummary[]; current: number | null }) {
  if (phases.length === 0) return null;

  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {phases.map((p) => {
        const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
        const complete = p.total > 0 && p.done === p.total;
        const active = p.phase === current;
        // Not started and nothing available: the phase is waiting on earlier work.
        const waiting = !active && !complete && p.ready === 0;

        return (
          <li
            key={p.phase}
            className={cn(
              'bg-card relative overflow-hidden rounded-xl border p-4 transition-colors',
              active && 'border-primary/50 ring-primary/15 ring-2',
              waiting && 'opacity-70',
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
                  complete
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {complete ? <Check className="size-4" /> : p.phase}
              </span>

              <span className="text-sm font-semibold">Phase {p.phase}</span>

              {active ? (
                <span className="bg-primary/10 text-primary ml-auto rounded-md px-1.5 py-0.5 text-xs font-semibold">
                  Current
                </span>
              ) : waiting ? (
                <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-xs font-medium">
                  <Lock className="size-3" />
                  Waiting
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex items-baseline justify-between text-xs tabular-nums">
              <span className="text-muted-foreground">
                {p.done}/{p.total} done
              </span>
              <span className="font-semibold">{pct}%</span>
            </div>

            <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full', complete ? 'bg-emerald-500' : 'bg-primary')}
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="text-muted-foreground mt-2.5 text-xs">
              {p.ready > 0 ? (
                <>
                  <span className="text-foreground font-semibold tabular-nums">{p.ready}</span>{' '}
                  ready to start
                </>
              ) : complete ? (
                'Complete'
              ) : (
                'Nothing startable yet'
              )}
              {p.inFlight > 0 ? ` · ${p.inFlight} in flight` : ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
