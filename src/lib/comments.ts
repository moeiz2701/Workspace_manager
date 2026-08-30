import { createClient } from '@/lib/supabase/server';
import type { ActivityType, Profile } from '@/types/app';

export type CommentAuthor = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'color'>;

export type Comment = {
  id: string;
  task_id: string;
  parent_comment_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author: CommentAuthor | null;
};

export type ActivityEntry = {
  id: string;
  task_id: string;
  actor_id: string | null;
  type: ActivityType;
  from_value: string | null;
  to_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: CommentAuthor | null;
};

export async function getComments(taskId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('task_comments')
    .select(
      'id, task_id, parent_comment_id, author_id, body, created_at, edited_at, deleted_at, ' +
        'author:profiles!task_comments_author_id_fkey(id, full_name, email, avatar_url, color)',
    )
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  return (data ?? []) as unknown as Comment[];
}

/** Reverse-chronological audit trail: who moved what, and when (§7.2). */
export async function getActivity(taskId: string): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('task_activity')
    .select(
      'id, task_id, actor_id, type, from_value, to_value, metadata, created_at, ' +
        'actor:profiles!task_activity_actor_id_fkey(id, full_name, email, avatar_url, color)',
    )
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  return (data ?? []) as unknown as ActivityEntry[];
}
