'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { MessageSquare, Reply, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { CommentComposer } from '@/components/comments/comment-composer';
import { PersonBadge } from '@/components/shell/person-badge';
import { Button } from '@/components/ui/button';
import { deleteComment } from '@/lib/actions/comments';
import type { Comment } from '@/lib/comments';
import { tokenizeMentions } from '@/lib/mentions';
import { useCommentRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/app';

/** Threaded comments, one level of nesting, newest last (§7.2). */
export function CommentThread({
  taskId,
  comments,
  team,
  profile,
}: {
  taskId: string;
  comments: Comment[];
  team: Profile[];
  profile: Profile;
}) {
  useCommentRealtime(taskId);

  const { roots, repliesOf } = useMemo(() => {
    const replies = new Map<string, Comment[]>();
    const top: Comment[] = [];

    for (const comment of comments) {
      if (comment.parent_comment_id) {
        replies.set(comment.parent_comment_id, [
          ...(replies.get(comment.parent_comment_id) ?? []),
          comment,
        ]);
      } else {
        top.push(comment);
      }
    }

    return { roots: top, repliesOf: replies };
  }, [comments]);

  return (
    <section className="space-y-4">
      <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase">
        <MessageSquare className="size-3.5" />
        Comments
        {comments.length > 0 ? <span className="tabular-nums">{comments.length}</span> : null}
      </h2>

      {roots.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {roots.map((comment) => (
            <li key={comment.id} className="space-y-3">
              <CommentRow
                comment={comment}
                taskId={taskId}
                team={team}
                profile={profile}
                canReply
              />

              {(repliesOf.get(comment.id) ?? []).length > 0 ? (
                <ul className="ml-8 space-y-3 border-l pl-4">
                  {(repliesOf.get(comment.id) ?? []).map((reply) => (
                    <li key={reply.id}>
                      <CommentRow comment={reply} taskId={taskId} team={team} profile={profile} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <CommentComposer taskId={taskId} team={team} />
    </section>
  );
}

function CommentRow({
  comment,
  taskId,
  team,
  profile,
  canReply,
}: {
  comment: Comment;
  taskId: string;
  team: Profile[];
  profile: Profile;
  canReply?: boolean;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [, startTransition] = useTransition();

  const isAuthor = comment.author_id === profile.id;
  const canDelete = isAuthor || profile.role === 'admin';

  if (comment.deleted_at) {
    return <p className="text-muted-foreground text-sm italic">Comment deleted.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2.5">
        {comment.author ? <PersonBadge person={comment.author} size="sm" /> : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">
              {comment.author?.full_name ?? comment.author?.email ?? 'Unknown'}
            </span>
            <time className="text-muted-foreground text-[11px]">
              {format(new Date(comment.created_at), 'd MMM, HH:mm')}
            </time>
            {comment.edited_at ? (
              <span className="text-muted-foreground text-[11px]">edited</span>
            ) : null}
          </div>

          <p className="mt-0.5 text-sm whitespace-pre-wrap">
            <CommentBody body={comment.body} meId={profile.id} />
          </p>

          <div className="mt-1 flex items-center gap-1">
            {canReply ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs"
                onClick={() => setReplying((v) => !v)}
              >
                <Reply className="size-3" /> Reply
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs"
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteComment(comment.id);
                    if (res.error) toast.error(res.error);
                    else router.refresh();
                  })
                }
              >
                <Trash2 className="size-3" /> Delete
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {replying ? (
        <div className="ml-8">
          <CommentComposer
            taskId={taskId}
            team={team}
            parentCommentId={comment.id}
            placeholder="Reply…"
            autoFocus
            onDone={() => setReplying(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function CommentBody({ body, meId }: { body: string; meId: string }) {
  return (
    <>
      {tokenizeMentions(body).map((token, i) =>
        token.type === 'text' ? (
          <span key={i}>{token.value}</span>
        ) : (
          <span
            key={i}
            className={cn(
              'rounded px-1 py-0.5 text-[13px] font-medium',
              token.profileId === meId
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                : 'bg-muted',
            )}
          >
            @{token.name}
          </span>
        ),
      )}
    </>
  );
}
