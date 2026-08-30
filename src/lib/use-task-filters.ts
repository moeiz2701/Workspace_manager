'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { parseFilters, serializeFilters, type TaskFilters } from '@/lib/filters';

/**
 * Reads filter state from the URL and writes changes back to it, so every
 * filtered view is a shareable link and the back button works (§7.2).
 */
export function useTaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (next: TaskFilters) => {
      // Preserve params this hook does not own, such as ?open=<task>.
      const preserved = new URLSearchParams(searchParams.toString());
      for (const key of ['cat', 'who', 'pri', 'st', 'mine', 'unblocked', 'q']) {
        preserved.delete(key);
      }

      const query = serializeFilters(next, preserved).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const patch = useCallback(
    (partial: Partial<TaskFilters>) => setFilters({ ...filters, ...partial }),
    [filters, setFilters],
  );

  const toggle = useCallback(
    (key: 'categories' | 'assignees' | 'priorities' | 'statuses', value: string) => {
      const current = filters[key] as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      patch({ [key]: next } as Partial<TaskFilters>);
    },
    [filters, patch],
  );

  return { filters, setFilters, patch, toggle };
}

/**
 * Search feels bad if every keystroke rewrites the URL. Keep the input local
 * and push to the URL once typing pauses.
 */
export function useDebouncedSearch(value: string, onCommit: (value: string) => void, ms = 250) {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => onCommit(local), ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, ms]);

  return [local, setLocal] as const;
}
