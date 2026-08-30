import type { Metadata } from 'next';

import { BlockedPanel } from '@/components/tracker/blocked-panel';
import { CategoryProgressList } from '@/components/tracker/category-progress-list';
import { PersonProgressList } from '@/components/tracker/person-progress-list';
import { ProjectRing } from '@/components/tracker/project-ring';
import { EmptyWorkspace } from '@/components/shell/empty-workspace';
import { PageHeader } from '@/components/shell/page-header';
import { requireApprovedProfile } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { getDependencyEdges, getTaskCards } from '@/lib/tasks';
import type { CategoryProgress, PersonProgress, ProjectProgress } from '@/types/app';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tracker · Entropable Workspace' };

export default async function TrackerPage() {
  const profile = await requireApprovedProfile();
  const supabase = await createClient();

  const [{ data: project }, { data: categories }, { data: people }, tasks, edges] =
    await Promise.all([
      supabase.from('project_progress').select('*').maybeSingle(),
      supabase.from('category_progress').select('*').order('position'),
      supabase.from('person_progress').select('*'),
      getTaskCards(),
      getDependencyEdges(),
    ]);

  if (tasks.length === 0) {
    return (
      <>
        <PageHeader title="Tracker" />
        <EmptyWorkspace isAdmin={profile.role === 'admin'} />
      </>
    );
  }

  const projectProgress = (project ?? {
    total: 0,
    done: 0,
    in_flight: 0,
    todo: 0,
    pct: null,
  }) as ProjectProgress;

  return (
    <>
      <PageHeader
        title="Tracker"
        description="Where the build actually stands. Every number here is computed in SQL, so it cannot disagree with the board."
      />

      <div className="space-y-10 p-6">
        <div className="grid gap-8 lg:grid-cols-[auto_1fr]">
          <ProjectRing progress={projectProgress} />
          <CategoryProgressList categories={(categories ?? []) as CategoryProgress[]} />
        </div>

        <BlockedPanel tasks={tasks} edges={edges} />

        <PersonProgressList people={(people ?? []) as PersonProgress[]} />
      </div>
    </>
  );
}
