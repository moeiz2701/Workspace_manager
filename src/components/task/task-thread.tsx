'use client';

import { useQuery } from '@tanstack/react-query';

import { CommentThread } from '@/components/comments/comment-thread';
import { ActivityTimeline } from '@/components/task/activity-timeline';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityEntry, Comment } from '@/lib/comments';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/app';

/**
 * Comments and activity for the task open in the side sheet.
 *
 * The full-page view server-renders these; the sheet opens over an already
 * rendered board, so it fetches them on demand into the TanStack Query cache.
 * Both paths read through RLS as the signed-in user.
 */
export function TaskThread({
  taskId,
  team,
  profile,
  names,
}: {
  taskId: string;
  team: Profile[];
  profile: Profile;
  names: Record<string, string>;
}) {
  const { data, isPending } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: async () => {
      const supabase = createClient();

      const [comments, activity] = await Promise.all([
        supabase
          .from('task_comments')
          .select(
            'id, task_id, parent_comment_id, author_id, body, created_at, edited_at, deleted_at, ' +
              'author:profiles!task_comments_author_id_fkey(id, full_name, email, avatar_url, color)',
          )
          .eq('task_id', taskId)
          .order('created_at', { ascending: true }),
        supabase
          .from('task_activity')
          .select(
            'id, task_id, actor_id, type, from_value, to_value, metadata, created_at, ' +
              'actor:profiles!task_activity_actor_id_fkey(id, full_name, email, avatar_url, color)',
          )
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
      ]);

      return {
        comments: (comments.data ?? []) as unknown as Comment[],
        activity: (activity.data ?? []) as unknown as ActivityEntry[],
      };
    },
  });

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <>
      <CommentThread
        taskId={taskId}
        comments={data?.comments ?? []}
        team={team}
        profile={profile}
      />
      <ActivityTimeline entries={data?.activity ?? []} names={names} />
    </>
  );
}
