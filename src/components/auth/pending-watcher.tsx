'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

/**
 * Subscribes to the signed-in user's own `profiles` row. The moment the admin
 * approves them, `status` flips and we route into the app — no refresh (§7.2).
 *
 * Realtime is a signal only: we re-enter the app through the middleware gate,
 * which re-reads the profile through RLS. We never trust the payload (§2, rule 5).
 */
export function PendingWatcher({ profileId }: { profileId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`profile:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profileId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    // Belt and braces: Realtime can miss an event if the socket reconnects.
    const poll = setInterval(() => router.refresh(), 20_000);

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [profileId, router]);

  return null;
}
