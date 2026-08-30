'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/**
 * Notification writes. RLS ("update own notifications") means a caller can only
 * ever mark their own rows read — the `recipient_id` filter here is a courtesy.
 */

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { error: null };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { error: null };
}
