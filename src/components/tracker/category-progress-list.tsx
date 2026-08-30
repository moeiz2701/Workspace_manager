import Link from 'next/link';

import { colorOf } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { CategoryProgress } from '@/types/app';

/** Per-category rows with a stacked todo / in-flight / done bar (§7.2). */
export function CategoryProgressList({ categories }: { categories: CategoryProgress[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        By category
      </h2>

      <ul className="space-y-3">
        {categories.map((category) => {
          const total = category.total ?? 0;
          const done = category.done ?? 0;
          const inFlight = category.in_flight ?? 0;
          const todo = category.todo ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const color = colorOf(category.color);

          return (
            <li key={category.category_id} className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className={cn('size-2.5 shrink-0 rounded-full', color.dot)} />
                <Link
                  href={`/tasks?cat=${category.key}`}
                  className="text-sm font-medium hover:underline"
                >
                  {category.name}
                </Link>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                  {done}/{total} · {pct}%
                </span>
              </div>

              <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-emerald-500"
                  style={{ width: pctOf(done, total) }}
                  title={`${done} done`}
                />
                <div
                  className="bg-blue-500"
                  style={{ width: pctOf(inFlight, total) }}
                  title={`${inFlight} in flight`}
                />
                <div
                  className="bg-muted-foreground/25"
                  style={{ width: pctOf(todo, total) }}
                  title={`${todo} to do`}
                />
              </div>
            </li>
          );
        })}

        {categories.length === 0 ? (
          <li className="text-muted-foreground text-sm">No categories yet.</li>
        ) : null}
      </ul>

      <div className="text-muted-foreground flex gap-4 text-[11px]">
        <Legend className="bg-emerald-500" label="Done" />
        <Legend className="bg-blue-500" label="In flight" />
        <Legend className="bg-muted-foreground/25" label="To do" />
      </div>
    </section>
  );
}

function pctOf(value: number, total: number) {
  return total > 0 ? `${(value / total) * 100}%` : '0%';
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-sm', className)} />
      {label}
    </span>
  );
}
