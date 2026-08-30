import Link from 'next/link';

import { PersonBadge } from '@/components/shell/person-badge';
import type { PersonProgress } from '@/types/app';

/** Per-person rollup, each row led by that person's colour badge (§7.2). */
export function PersonProgressList({ people }: { people: PersonProgress[] }) {
  const sorted = [...people].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        By person
      </h2>

      <ul className="divide-y rounded-lg border">
        {sorted.map((person) => {
          const total = person.total ?? 0;
          const done = person.done ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <li key={person.profile_id} className="flex items-center gap-3 p-3">
              <PersonBadge
                person={{
                  full_name: person.full_name,
                  email: person.email ?? '',
                  color: person.color,
                }}
                size="md"
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/tasks?who=${person.profile_id}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {person.full_name ?? person.email}
                </Link>
                {person.title ? (
                  <div className="text-muted-foreground text-xs">{person.title}</div>
                ) : null}
              </div>

              <div className="text-muted-foreground hidden gap-4 text-xs tabular-nums sm:flex">
                <span>{person.in_flight ?? 0} in flight</span>
                <span>{person.todo ?? 0} to do</span>
              </div>

              <div className="w-28 shrink-0">
                <div className="flex items-baseline justify-between text-xs tabular-nums">
                  <span>
                    {done}/{total}
                  </span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          );
        })}

        {sorted.length === 0 ? (
          <li className="text-muted-foreground p-4 text-sm">Nobody approved yet.</li>
        ) : null}
      </ul>
    </section>
  );
}
