import { cn } from '@/lib/utils';
import { colorOf, initialsOf } from '@/lib/colors';

type Person = {
  id?: string;
  full_name: string | null;
  email: string;
  color: string;
  avatar_url?: string | null;
};

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

/**
 * The "who" channel (§7). A filled circle in that person's palette colour with
 * their initials as TEXT — never colour alone, so it survives greyscale and
 * colour blindness.
 */
export function PersonBadge({
  person,
  size = 'sm',
  className,
  title,
}: {
  person: Person;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}) {
  const color = colorOf(person.color);
  return (
    <span
      title={title ?? person.full_name ?? person.email}
      className={cn(
        'ring-background inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 select-none',
        color.badge,
        SIZES[size],
        className,
      )}
    >
      {initialsOf(person.full_name, person.email)}
    </span>
  );
}

/** Overlapping stack, max 3 + "+n" (§7). */
export function PersonBadgeStack({
  people,
  max = 3,
  size = 'sm',
}: {
  people: Person[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  if (people.length === 0) {
    return <span className="text-muted-foreground text-xs">Unassigned</span>;
  }

  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <PersonBadge key={p.id ?? p.email ?? i} person={p} size={size} />
      ))}
      {rest > 0 ? (
        <span
          title={people
            .slice(max)
            .map((p) => p.full_name ?? p.email)
            .join(', ')}
          className={cn(
            'bg-muted text-muted-foreground ring-background inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2',
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
