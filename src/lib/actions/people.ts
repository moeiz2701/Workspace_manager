'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { COLORS } from '@/lib/colors';
import { createClient } from '@/lib/supabase/server';

/**
 * Membership writes. Every one of these is a SECURITY DEFINER RPC with its own
 * internal `is_admin()` check (§4.4) — the action is a thin wrapper, not the
 * authorization boundary.
 */

const uuid = z.string().uuid();
const role = z.enum(['admin', 'member']);
const color = z.enum(COLORS);

type Result = { error: string | null };

function done(error: { message: string } | null): Result {
  if (error) return { error: error.message };
  revalidatePath('/admin/people');
  revalidatePath('/', 'layout');
  return { error: null };
}

export async function approveMember(profileId: string, asRole: 'admin' | 'member' = 'member') {
  const parsed = z.object({ profileId: uuid, asRole: role }).safeParse({ profileId, asRole });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_member', {
    p_profile_id: parsed.data.profileId,
    p_role: parsed.data.asRole,
  });
  return done(error);
}

export async function rejectMember(profileId: string) {
  if (!uuid.safeParse(profileId).success) return { error: 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_member', { p_profile_id: profileId });
  return done(error);
}

export async function setMemberRole(profileId: string, newRole: 'admin' | 'member') {
  const parsed = z.object({ profileId: uuid, newRole: role }).safeParse({ profileId, newRole });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_member_role', {
    p_profile_id: parsed.data.profileId,
    p_role: parsed.data.newRole,
  });
  return done(error);
}

export async function setMemberColor(profileId: string, newColor: string) {
  const parsed = z.object({ profileId: uuid, newColor: color }).safeParse({ profileId, newColor });
  if (!parsed.success) return { error: 'Invalid colour' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_member_color', {
    p_profile_id: parsed.data.profileId,
    p_color: parsed.data.newColor,
  });
  return done(error);
}

export async function setMemberTitle(profileId: string, title: string) {
  if (!uuid.safeParse(profileId).success) return { error: 'Invalid input' };

  const supabase = await createClient();
  // `title` is not a guarded column; RLS ("admins manage profiles") covers it.
  const { error } = await supabase
    .from('profiles')
    .update({ title: title.trim() || null })
    .eq('id', profileId);
  return done(error);
}
