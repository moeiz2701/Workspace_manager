import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { CommentThread } from '@/components/comments/comment-thread';
import { ActivityTimeline } from '@/components/task/activity-timeline';
import { TaskDetail } from '@/components/task/task-detail';
import { Button } from '@/components/ui/button';
import { getActivity, getComments } from '@/lib/comments';
import { displayNames } from '@/lib/display-names';
import { requireApprovedProfile } from '@/lib/queries';
import {
  getApprovedTeam,
  getCategories,
  getDependencyEdges,
  getTaskCardByKey,
  getTaskCards,
} from '@/lib/tasks';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  return { title: `${decodeURIComponent(key)} · Entropable Workspace` };
}

export default async function TaskPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const profile = await requireApprovedProfile();

  const task = await getTaskCardByKey(decodeURIComponent(key));
  if (!task) notFound();

  const [allTasks, categories, team, edges, comments, activity] = await Promise.all([
    getTaskCards(),
    getCategories(),
    getApprovedTeam(),
    getDependencyEdges(),
    getComments(task.id),
    getActivity(task.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/tasks">
          <ArrowLeft className="size-4" /> All tasks
        </Link>
      </Button>

      <TaskDetail
        task={task}
        allTasks={allTasks}
        categories={categories}
        team={team}
        profile={profile}
        edges={edges}
        comments={
          <CommentThread taskId={task.id} comments={comments} team={team} profile={profile} />
        }
        activity={
          <ActivityTimeline entries={activity} names={displayNames(team, categories, allTasks)} />
        }
      />
    </div>
  );
}
