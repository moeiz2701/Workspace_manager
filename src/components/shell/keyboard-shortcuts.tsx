'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Global shortcuts (§7.3): `/` focuses search, `b`/`l`/`g`/`t` jump to views.
 * `j`/`k` and `Esc` are handled by the views that own a selection.
 */
export function KeyboardShortcuts({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'combobox');

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/' && !typing) {
        const search = document.querySelector<HTMLInputElement>('[data-search-input]');
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }

      if (typing) return;

      const routes: Record<string, string> = {
        b: '/board',
        l: '/tasks',
        g: '/graph',
        t: '/tracker',
        ...(isAdmin ? { p: '/admin/people', i: '/admin/import' } : {}),
      };

      const to = routes[e.key.toLowerCase()];
      if (to) {
        e.preventDefault();
        router.push(to);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, isAdmin]);

  return null;
}
