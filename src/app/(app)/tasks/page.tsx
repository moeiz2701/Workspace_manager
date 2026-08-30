import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TaskTable } from '@/components/list/task-table';
import { EmptyWorkspace } from '@/components/shell/empty-workspace';
import { PageHeader } from '@/components/shell/page-header';
import { requireApprovedProfile } from '@/lib/queries';
import { getApprovedTeam, getCategories, getDependencyEdges, getTaskCards } from '@/lib/tasks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tasks · Entropable Workspace' };

export default async function TasksPage() {
  const profile = await requireApprovedProfile();
  const [tasks, categories, team, edges] = await Promise.all([
    getTaskCards(),
    getCategories(),
    getApprovedTeam(),
    getDependencyEdges(),
  ]);

  if (tasks.length === 0) {
    return (
      <>
        <PageHeader title="Tasks" />
        <EmptyWorkspace isAdmin={profile.role === 'admin'} />
      </>
    );
  }

  return (
    <Suspense>
      <TaskTable
        tasks={tasks}
        categories={categories}
        team={team}
        profile={profile}
        edges={edges}
      />
    </Suspense>
  );
}
