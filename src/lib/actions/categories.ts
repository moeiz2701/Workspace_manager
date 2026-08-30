'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { categoryInput } from '@/lib/schemas/category';
import { createClient } from '@/lib/supabase/server';

/**
 * Category writes. RLS ("admins write categories") is the authorization
 * boundary; these actions only shape and validate input.
 */

type Result = { error: string | null };

function done(error: { message: string } | null): Result {
  if (error) return { error: error.message };
  revalidatePath('/admin/categories');
  revalidatePath('/', 'layout');
  return { error: null };
}

export async function createCategory(input: unknown): Promise<Result> {
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid category' };

  const supabase = await createClient();

  // Append to the end unless a position was given.
  let position = parsed.data.position;
  if (position === undefined) {
    const { data } = await supabase
      .from('categories')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    position = (data?.position ?? 0) + 1000;
  }

  const { error } = await supabase.from('categories').insert({
    key: parsed.data.key,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    color: parsed.data.color,
    icon: parsed.data.icon ?? null,
    position,
  });

  if (error?.code === '23505') return { error: `A category with key "${parsed.data.key}" exists` };
  return done(error);
}

export async function updateCategory(id: string, input: unknown): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid category' };

  const parsed = categoryInput.partial().safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid category' };

  const supabase = await createClient();
  const { error } = await supabase.from('categories').update(parsed.data).eq('id', id);

  if (error?.code === '23505') return { error: 'That key is already taken' };
  return done(error);
}

export async function deleteCategory(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid category' };

  const supabase = await createClient();
  const { error } = await supabase.from('categories').delete().eq('id', id);

  // categories.id is referenced by tasks with ON DELETE RESTRICT.
  if (error?.code === '23503') {
    return { error: 'This category still has tasks. Move or cancel them first.' };
  }
  return done(error);
}

/** Drag-to-reorder writes the whole new order in one round trip. */
export async function reorderCategories(orderedIds: string[]): Promise<Result> {
  const parsed = z.array(z.string().uuid()).min(1).safeParse(orderedIds);
  if (!parsed.success) return { error: 'Invalid order' };

  const supabase = await createClient();

  for (const [index, id] of parsed.data.entries()) {
    const { error } = await supabase
      .from('categories')
      .update({ position: (index + 1) * 1000 })
      .eq('id', id);
    if (error) return { error: error.message };
  }

  return done(null);
}
