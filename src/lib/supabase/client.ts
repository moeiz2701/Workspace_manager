'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser Supabase client. Used for Realtime subscriptions and for the OAuth
 * sign-in redirect only — all reads are server-rendered and all writes go
 * through Server Actions.
 */
export function createClient() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
