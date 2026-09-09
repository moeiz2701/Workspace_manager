import type { Metadata } from 'next';

import { EmptyWorkspace } from '@/components/shell/empty-workspace';
import { PageHeader } from '@/components/shell/page-header';
import { StartQueue } from '@/components/start/start-queue';
import { requireApprovedProfile } from '@/lib/queries';
import { getDependencyEdges, getTaskCards } from '@/lib/tasks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Start · Entropable Workspace' };

export default async function StartPage() {
  const profile = await requireApprovedProfile();
  const [tasks, edges] = await Promise.all([getTaskCards(), getDependencyEdges()]);

  if (tasks.length === 0) {
    return (
      <>
        <PageHeader title="Start here" />
        <EmptyWorkspace isAdmin={profile.role === 'admin'} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Start here"
        description="The plan in the order it can actually be built. Ranked by delivery phase, then by how much each task releases — so the top of the list is the work everything else is waiting on."
      />
      <StartQueue tasks={tasks} edges={edges} profile={profile} />
    </>
  );
}
