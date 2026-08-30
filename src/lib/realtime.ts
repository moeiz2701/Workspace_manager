'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

/**
 * Realtime is a cache-invalidation signal, not a data source (§2, rule 5).
 * Every handler here either invalidates a query key or calls router.refresh();
 * nothing renders straight from a payload, and nothing authorizes from one.
 *
 * Realtime respects RLS, so a `pending` user's socket receives nothing.
 */

type Handler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

type Subscription = {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onChange: Handler;
};

/** Low-level: subscribe to one or more postgres_changes streams on a channel. */
export function useRealtimeChannel(name: string, subscriptions: Subscription[], deps: unknown[]) {
  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel(name);

    for (const sub of subscriptions) {
      channel = channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: sub.event ?? '*',
          schema: 'public',
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        sub.onChange,
      );
    }

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Board / list / graph / tracker: any task change invalidates every derived view. */
export function useTaskRealtime() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useRealtimeChannel(
    'workspace-tasks',
    [
      {
        table: 'tasks',
        onChange: () => {
          void queryClient.invalidateQueries({ queryKey: ['tasks'] });
          void queryClient.invalidateQueries({ queryKey: ['progress'] });
          void queryClient.invalidateQueries({ queryKey: ['graph'] });
          router.refresh();
        },
      },
      {
        table: 'task_assignees',
        onChange: () => {
          void queryClient.invalidateQueries({ queryKey: ['tasks'] });
          router.refresh();
        },
      },
    ],
    [queryClient, router],
  );
}

/** Notification bell: only my own rows come down the socket. */
export function useNotificationRealtime(profileId: string, onInsert?: (title: string) => void) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useRealtimeChannel(
    `notifications:${profileId}`,
    [
      {
        table: 'notifications',
        filter: `recipient_id=eq.${profileId}`,
        onChange: (payload) => {
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          router.refresh();
          if (payload.eventType === 'INSERT' && onInsert) {
            const title = (payload.new as { title?: string }).title;
            if (title) onInsert(title);
          }
        },
      },
    ],
    [profileId, queryClient, router],
  );
}

/** Admin approval queue: live as people sign in. */
export function useProfilesRealtime() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useRealtimeChannel(
    'workspace-profiles',
    [
      {
        table: 'profiles',
        onChange: () => {
          void queryClient.invalidateQueries({ queryKey: ['profiles'] });
          router.refresh();
        },
      },
    ],
    [router, queryClient],
  );
}

/** Live comment thread on the open task only. */
export function useCommentRealtime(taskId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useRealtimeChannel(
    `comments:${taskId}`,
    [
      {
        table: 'task_comments',
        filter: `task_id=eq.${taskId}`,
        onChange: () => {
          void queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
          router.refresh();
        },
      },
    ],
    [taskId, queryClient, router],
  );
}
