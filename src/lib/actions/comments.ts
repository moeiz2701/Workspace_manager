'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { extractMentionIds } from '@/lib/mentions';
import { createClient } from '@/lib/supabase/server';

/**
 * Comment writes.
 *
 * The comment and its `comment_mentions` rows are inserted in the same action
 * so the notification triggers fire together (§7.2): `notify_on_comment` for
 * participants, `notify_on_mention` for the people named.
 */

const uuid = z.string().uuid();
const body = z.string().trim().min(1, 'Say something').max(10_000);

type Result = { error: string | null };

export async function addComment(input: {
  taskId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<Result> {
  const parsed = z
    .object({ taskId: uuid, body, parentCommentId: uuid.nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid comment' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  const { data: comment, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: parsed.data.taskId,
      parent_comment_id: parsed.data.parentCommentId ?? null,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  const mentioned = extractMentionIds(parsed.data.body).filter((id) => id !== user.id);
  if (mentioned.length > 0) {
    const { error: mentionError } = await supabase.from('comment_mentions').insert(
      mentioned.map((id) => ({
        comment_id: comment.id,
        mentioned_profile_id: id,
      })),
    );
    // A bad mention must not lose the comment that was already written.
    if (mentionError) {
      revalidatePath('/', 'layout');
      return { error: `Comment posted, but a mention failed: ${mentionError.message}` };
    }
  }

  revalidatePath('/', 'layout');
  return { error: null };
}

export async function editComment(commentId: string, newBody: string): Promise<Result> {
  const parsed = z.object({ commentId: uuid, newBody: body }).safeParse({ commentId, newBody });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid comment' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('task_comments')
    .update({ body: parsed.data.newBody, edited_at: new Date().toISOString() })
    .eq('id', parsed.data.commentId);

  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { error: null };
}

/** Deletion is soft — there is no DELETE policy on task_comments at all (§5). */
export async function deleteComment(commentId: string): Promise<Result> {
  if (!uuid.safeParse(commentId).success) return { error: 'Invalid comment' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('task_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { error: null };
}
