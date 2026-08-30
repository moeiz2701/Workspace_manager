import type { Metadata } from 'next';
import { Suspense } from 'react';

import { DependencyGraph } from '@/components/graph/dependency-graph';
import { EmptyWorkspace } from '@/components/shell/empty-workspace';
import { PageHeader } from '@/components/shell/page-header';
import { requireApprovedProfile } from '@/lib/queries';
import { getApprovedTeam, getCategories, getDependencyEdges, getTaskCards } from '@/lib/tasks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Graph · Entropable Workspace' };

export default async function GraphPage() {
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
        <PageHeader title="Graph" />
        <EmptyWorkspace isAdmin={profile.role === 'admin'} />
      </>
    );
  }

  return (
    <Suspense>
      <DependencyGraph
        tasks={tasks}
        categories={categories}
        team={team}
        profile={profile}
        edges={edges}
      />
    </Suspense>
  );
}
