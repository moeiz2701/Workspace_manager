import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Board } from '@/components/board/board';
import { EmptyWorkspace } from '@/components/shell/empty-workspace';
import { PageHeader } from '@/components/shell/page-header';
import { requireApprovedProfile } from '@/lib/queries';
import { getApprovedTeam, getCategories, getDependencyEdges, getTaskCards } from '@/lib/tasks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Board · Entropable Workspace' };

export default async function BoardPage() {
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
        <PageHeader title="Board" />
        <EmptyWorkspace isAdmin={profile.role === 'admin'} />
      </>
    );
  }

  return (
    <Suspense>
      <Board tasks={tasks} categories={categories} team={team} profile={profile} edges={edges} />
    </Suspense>
  );
}
