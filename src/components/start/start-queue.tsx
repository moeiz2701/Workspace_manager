'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleDot, Flag, Sparkles } from 'lucide-react';

import { PhaseRail, summarisePhases } from '@/components/start/phase-rail';
import { BlockedByParentRow, QueueRow } from '@/components/start/queue-row';
import { Button } from '@/components/ui/button';
import { useTaskRealtime } from '@/lib/realtime';
import { byPhase, currentPhase, inFlight, myQueue, rankTasks, startOrder } from '@/lib/start-here';
import type { Profile, TaskCard } from '@/types/app';

/** How many of the ranked queue to show before "show the rest". */
const LEAD = 3;
const PAGE = 12;

/**
 * /start — the ranked answer to "what do I pick up now".
 *
 * The board can only say "not blocked", which on this plan is 148 tasks. This
 * screen ranks instead of filtering, and the ordering rules live in
 * lib/start-here.ts where they are unit-tested against the real plan file.
 */
export function StartQueue({
  tasks,
  edges,
  profile,
}: {
  tasks: TaskCard[];
  edges: { from: string; to: string }[];
  profile: Profile;
}) {
  useTaskRealtime();

  const [expanded, setExpanded] = useState(false);

  const model = useMemo(() => {
    const ranked = rankTasks(tasks, edges);
    const queue = startOrder(ranked);
    const readyKeys = new Set(queue.map((r) => r.task.key));

    return {
      ranked,
      queue,
      mine: myQueue(ranked, profile.id),
      open: inFlight(ranked),
      phases: summarisePhases(tasks, readyKeys),
      current: currentPhase(tasks),
      // Work that looks free on the board but is held by an ancestor. Shown so
      // the screen explains an absence rather than silently dropping it.
      heldByParent: ranked
        .filter((r) => r.isLeaf && r.task.status === 'todo')
        .filter((r) => !r.task.is_blocked && r.blockedByParent.length > 0),
    };
  }, [tasks, edges, profile.id]);

  const { queue, mine, open, phases, current, heldByParent } = model;

  if (queue.length === 0 && open.length === 0) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <PhaseRail phases={phases} current={current} />
        <p className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          Nothing is startable. Every remaining task is waiting on something still open — the
          dependency graph will show you where the plan is stuck.
        </p>
      </div>
    );
  }

  const lead = queue.slice(0, LEAD);
  const rest = queue.slice(LEAD);
  const shown = expanded ? rest : rest.slice(0, PAGE);
  const byPhaseRest = byPhase(shown);

  return (
    <div className="space-y-10 p-4 md:p-6">
      <PhaseRail phases={phases} current={current} />

      {mine.length > 0 ? (
        <Section
          icon={<Flag className="size-4" />}
          title="Assigned to you"
          hint={`${mine.length} ready`}
        >
          <ol className="space-y-2">
            {mine.slice(0, 5).map((r) => (
              <QueueRow key={r.task.key} ranked={r} emphasis />
            ))}
          </ol>
        </Section>
      ) : null}

      {open.length > 0 ? (
        <Section
          icon={<CircleDot className="size-4" />}
          title="Already in flight"
          hint={`${open.length} open`}
          description="Finish these before starting anything new."
        >
          <ol className="space-y-2">
            {open.slice(0, 5).map((r) => (
              <QueueRow key={r.task.key} ranked={r} />
            ))}
          </ol>
        </Section>
      ) : null}

      {lead.length > 0 ? (
        <Section
          icon={<Sparkles className="size-4" />}
          title="Start here"
          description={
            current !== null
              ? `The highest-leverage phase ${current} work that nothing is blocking. The number on the right is how much each one releases.`
              : 'The highest-leverage work that nothing is blocking.'
          }
        >
          <ol className="space-y-2.5">
            {lead.map((r, i) => (
              <QueueRow key={r.task.key} ranked={r} rank={i + 1} emphasis />
            ))}
          </ol>
        </Section>
      ) : null}

      {rest.length > 0 ? (
        <Section
          title="Then"
          hint={`${rest.length} more ready`}
          description="Same ranking, in phase order."
        >
          <div className="space-y-6">
            {byPhaseRest.map((group) => (
              <div key={group.phase ?? 'none'} className="space-y-2">
                <h3 className="text-eyebrow">
                  {group.phase === null ? 'Unphased' : `Phase ${group.phase}`}
                  <span className="ml-2 tabular-nums">{group.tasks.length}</span>
                </h3>
                <ol className="space-y-2">
                  {group.tasks.map((r) => (
                    <QueueRow key={r.task.key} ranked={r} rank={queue.indexOf(r) + 1} />
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {rest.length > PAGE ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show less' : `Show all ${rest.length}`}
            </Button>
          ) : null}
        </Section>
      ) : null}

      {heldByParent.length > 0 ? (
        <Section
          title="Held by a parent"
          hint={`${heldByParent.length}`}
          description="These declare no dependencies of their own, so the board shows them as free. They are not: the task they sit under is still waiting."
        >
          <ul className="divide-y rounded-lg border">
            {heldByParent.slice(0, 8).map((r) => (
              <BlockedByParentRow key={r.task.key} ranked={r} />
            ))}
          </ul>
          {heldByParent.length > 8 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              and {heldByParent.length - 8} more.
            </p>
          ) : null}
        </Section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/graph">
            See the dependency graph <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/tracker">Where the build stands</Link>
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
          {hint ? (
            <span className="text-muted-foreground text-xs font-medium tabular-nums">{hint}</span>
          ) : null}
        </h2>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
