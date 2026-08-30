import type { TaskCard, TaskPriority, TaskStatus } from '@/types/app';

/**
 * Filter state lives in the URL so a filtered view is a shareable link (§7.2).
 * The board and the list share both the state shape and this apply function,
 * so the two can never filter differently.
 */

export type TaskFilters = {
  categories: string[]; // category keys
  assignees: string[]; // profile ids
  priorities: TaskPriority[];
  statuses: TaskStatus[];
  onlyMine: boolean;
  hideBlocked: boolean;
  search: string;
};

export const EMPTY_FILTERS: TaskFilters = {
  categories: [],
  assignees: [],
  priorities: [],
  statuses: [],
  onlyMine: false,
  hideBlocked: false,
  search: '',
};

const PARAM = {
  categories: 'cat',
  assignees: 'who',
  priorities: 'pri',
  statuses: 'st',
  onlyMine: 'mine',
  hideBlocked: 'unblocked',
  search: 'q',
} as const;

export function parseFilters(params: URLSearchParams | Record<string, string | undefined>) {
  const get = (key: string) =>
    params instanceof URLSearchParams ? params.get(key) : (params[key] ?? null);

  const list = (key: string) =>
    (get(key) ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  return {
    categories: list(PARAM.categories),
    assignees: list(PARAM.assignees),
    priorities: list(PARAM.priorities) as TaskPriority[],
    statuses: list(PARAM.statuses) as TaskStatus[],
    onlyMine: get(PARAM.onlyMine) === '1',
    hideBlocked: get(PARAM.hideBlocked) === '1',
    search: get(PARAM.search) ?? '',
  } satisfies TaskFilters;
}

/** Only non-default values are written, so a clean view has a clean URL. */
export function serializeFilters(filters: TaskFilters, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);

  const setList = (key: string, values: string[]) => {
    if (values.length > 0) params.set(key, values.join(','));
    else params.delete(key);
  };

  setList(PARAM.categories, filters.categories);
  setList(PARAM.assignees, filters.assignees);
  setList(PARAM.priorities, filters.priorities);
  setList(PARAM.statuses, filters.statuses);

  if (filters.onlyMine) params.set(PARAM.onlyMine, '1');
  else params.delete(PARAM.onlyMine);

  if (filters.hideBlocked) params.set(PARAM.hideBlocked, '1');
  else params.delete(PARAM.hideBlocked);

  if (filters.search.trim()) params.set(PARAM.search, filters.search.trim());
  else params.delete(PARAM.search);

  return params;
}

export function countActiveFilters(filters: TaskFilters): number {
  return (
    filters.categories.length +
    filters.assignees.length +
    filters.priorities.length +
    filters.statuses.length +
    (filters.onlyMine ? 1 : 0) +
    (filters.hideBlocked ? 1 : 0) +
    (filters.search.trim() ? 1 : 0)
  );
}

export function applyFilters(
  tasks: TaskCard[],
  filters: TaskFilters,
  currentProfileId: string,
): TaskCard[] {
  const needle = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.categories.length > 0 && !filters.categories.includes(task.category_key)) {
      return false;
    }
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }
    if (filters.hideBlocked && task.is_blocked && task.status === 'todo') {
      return false;
    }

    const assigneeIds = task.assignees.map((a) => a.id);
    if (filters.onlyMine && !assigneeIds.includes(currentProfileId)) return false;
    if (filters.assignees.length > 0 && !filters.assignees.some((id) => assigneeIds.includes(id))) {
      return false;
    }

    if (needle) {
      const haystack = [
        task.key,
        task.title,
        task.description ?? '',
        task.note ?? '',
        task.category_name,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}
