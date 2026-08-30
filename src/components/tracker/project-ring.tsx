import type { ProjectProgress } from '@/types/app';

/**
 * Overall completion (§7.2). Drawn as inline SVG rather than a chart library:
 * it is one arc, and this way it inherits the theme's colours exactly.
 */
export function ProjectRing({ progress }: { progress: ProjectProgress }) {
  const total = progress.total ?? 0;
  const done = progress.done ?? 0;
  const pct = total > 0 ? (done / total) * 100 : 0;

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  return (
    <section className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          role="img"
          aria-label={`${Math.round(pct)}% complete`}
        >
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            strokeWidth="14"
            className="stroke-muted"
          />
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 90 90)"
            className="stroke-emerald-500 transition-[stroke-dasharray] duration-500"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums">{Math.round(pct)}%</span>
          <span className="text-muted-foreground text-sm tabular-nums">
            {done} / {total}
          </span>
        </div>
      </div>

      <div className="text-muted-foreground flex gap-4 text-xs tabular-nums">
        <span>{progress.in_flight ?? 0} in flight</span>
        <span>{progress.todo ?? 0} to do</span>
      </div>
    </section>
  );
}
