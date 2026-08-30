import { z } from 'zod';

import { COLORS } from '@/lib/colors';

export const categoryKey = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase slug, e.g. ml-pipeline');

export const categoryInput = z.object({
  key: categoryKey,
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  color: z.enum(COLORS).default('slate'),
  icon: z.string().optional().nullable(),
  position: z.number().optional(),
});

export type CategoryInput = z.infer<typeof categoryInput>;

/**
 * Lucide icon names offered in the picker. Kept to a short, meaningful list —
 * the icon is a recognition aid, not decoration.
 */
export const CATEGORY_ICONS = [
  'brain',
  'workflow',
  'activity',
  'server',
  'database',
  'line-chart',
  'shield',
  'wallet',
  'bot',
  'cpu',
  'globe',
  'layers',
  'plug',
  'flask-conical',
  'file-text',
  'settings',
] as const;
