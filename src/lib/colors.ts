/**
 * The colour system (§7.1).
 *
 * Store the TOKEN in the database, never a hex value, so light/dark themes and
 * future palette tweaks are one file. Every badge also carries initials as
 * text, so colour-blind users and greyscale printouts still work. The twelve
 * tokens are chosen to be distinguishable under deuteranopia — that is why
 * there is no red/green pair adjacent in the list.
 *
 * Class strings are written out in full because Tailwind scans source for
 * literal candidates; do not build them by interpolation.
 */

export const COLORS = [
  'violet',
  'blue',
  'cyan',
  'teal',
  'emerald',
  'lime',
  'amber',
  'orange',
  'rose',
  'pink',
  'fuchsia',
  'slate',
] as const;

export type ColorToken = (typeof COLORS)[number];

export type ColorClasses = {
  /** Filled circle with initials — "who". */
  badge: string;
  /** Small text chip — "which area". */
  chip: string;
  /** 3px left border on a card. */
  border: string;
  /** Small status/legend dot. */
  dot: string;
  /** Solid background fill, used for progress bars. */
  bar: string;
  /** Stroke/fill for SVG and React Flow nodes, resolved at runtime. */
  hex: string;
};

export const PALETTE: Record<ColorToken, ColorClasses> = {
  violet: {
    badge: 'bg-violet-500 text-white',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    border: 'border-l-violet-500',
    dot: 'bg-violet-500',
    bar: 'bg-violet-500',
    hex: '#8b5cf6',
  },
  blue: {
    badge: 'bg-blue-500 text-white',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
    bar: 'bg-blue-500',
    hex: '#3b82f6',
  },
  cyan: {
    badge: 'bg-cyan-600 text-white',
    chip: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
    border: 'border-l-cyan-600',
    dot: 'bg-cyan-600',
    bar: 'bg-cyan-600',
    hex: '#0891b2',
  },
  teal: {
    badge: 'bg-teal-600 text-white',
    chip: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
    border: 'border-l-teal-600',
    dot: 'bg-teal-600',
    bar: 'bg-teal-600',
    hex: '#0d9488',
  },
  emerald: {
    badge: 'bg-emerald-600 text-white',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    border: 'border-l-emerald-600',
    dot: 'bg-emerald-600',
    bar: 'bg-emerald-600',
    hex: '#059669',
  },
  lime: {
    badge: 'bg-lime-600 text-white',
    chip: 'bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200',
    border: 'border-l-lime-600',
    dot: 'bg-lime-600',
    bar: 'bg-lime-600',
    hex: '#65a30d',
  },
  amber: {
    badge: 'bg-amber-500 text-black',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    hex: '#f59e0b',
  },
  orange: {
    badge: 'bg-orange-500 text-white',
    chip: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
    border: 'border-l-orange-500',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    hex: '#f97316',
  },
  rose: {
    badge: 'bg-rose-500 text-white',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    border: 'border-l-rose-500',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    hex: '#f43f5e',
  },
  pink: {
    badge: 'bg-pink-500 text-white',
    chip: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200',
    border: 'border-l-pink-500',
    dot: 'bg-pink-500',
    bar: 'bg-pink-500',
    hex: '#ec4899',
  },
  fuchsia: {
    badge: 'bg-fuchsia-500 text-white',
    chip: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200',
    border: 'border-l-fuchsia-500',
    dot: 'bg-fuchsia-500',
    bar: 'bg-fuchsia-500',
    hex: '#d946ef',
  },
  slate: {
    badge: 'bg-slate-500 text-white',
    chip: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    border: 'border-l-slate-500',
    dot: 'bg-slate-500',
    bar: 'bg-slate-500',
    hex: '#64748b',
  },
};

export function isColorToken(value: string | null | undefined): value is ColorToken {
  return !!value && (COLORS as readonly string[]).includes(value);
}

export function colorOf(value: string | null | undefined): ColorClasses {
  return PALETTE[isColorToken(value) ? value : 'slate'];
}

/** "Abdul Moiz" -> "AM"; falls back to the email local part. */
export function initialsOf(name: string | null | undefined, email?: string | null): string {
  const source = name?.trim() || email?.split('@')[0]?.replace(/[._-]+/g, ' ') || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
