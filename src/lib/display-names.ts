import type { Category, Profile, TaskCard } from '@/types/app';

/**
 * The audit log stores raw ids for assignee, category and parent changes.
 * Resolve them to names so the activity timeline reads as a sentence.
 *
 * Lives here rather than beside the components because both a Server Component
 * (`/tasks/[key]`) and a client one (the sheet) call it — a plain function
 * exported from a `'use client'` module reaches the server as a client
 * reference, not as something callable.
 */
export function displayNames(
  team: Profile[],
  categories: Category[],
  tasks: TaskCard[],
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const person of team) names[person.id] = person.full_name ?? person.email;
  for (const category of categories) names[category.id] = category.name;
  for (const task of tasks) names[task.id] = task.key;
  return names;
}
