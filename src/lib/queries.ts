import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { Notification, Profile } from '@/types/app';

/**
 * Server-side reads. Every one of these runs through RLS as the signed-in user
 * (§2, rule 2) — there is no privileged path.
 */

export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile) ?? null;
}

/** Use inside the (app) shell: guarantees an approved profile or redirects. */
export async function requireApprovedProfile(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  if (profile.status !== 'approved') redirect('/pending');
  return profile;
}

export async function requireAdminProfile(): Promise<Profile> {
  const profile = await requireApprovedProfile();
  if (profile.role !== 'admin') redirect('/start');
  return profile;
}

export async function getTeam(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('status', { ascending: true })
    .order('full_name', { ascending: true });
  return (data as Profile[]) ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return count ?? 0;
}

export async function getNotifications(limit = 50): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as Notification[]) ?? [];
}
