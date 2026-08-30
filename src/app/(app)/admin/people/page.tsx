import type { Metadata } from 'next';

import { PendingQueue } from '@/components/admin/pending-queue';
import { TeamTable } from '@/components/admin/team-table';
import { PageHeader } from '@/components/shell/page-header';
import { createClient } from '@/lib/supabase/server';
import { getTeam, requireAdminProfile } from '@/lib/queries';
import type { Profile } from '@/types/app';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'People · Entropable Workspace' };

export default async function PeoplePage() {
  const me = await requireAdminProfile();
  const team = await getTeam();

  const supabase = await createClient();
  const { data: counts } = await supabase.from('person_progress').select('*');

  const pending = team.filter((p) => p.status === 'pending');
  const rest = team.filter((p) => p.status !== 'pending');

  // `person_progress` is a view, so every column types as nullable.
  const countsById: Record<string, { total: number; done: number; in_flight: number }> = {};
  for (const c of counts ?? []) {
    if (!c.profile_id) continue;
    countsById[c.profile_id] = {
      total: c.total ?? 0,
      done: c.done ?? 0,
      in_flight: c.in_flight ?? 0,
    };
  }

  return (
    <>
      <PageHeader
        title="People"
        description="Approve access requests and manage the team. Access is enforced by the database, not this screen."
      />

      <div className="space-y-8 p-6">
        <PendingQueue pending={pending as Profile[]} />
        <TeamTable team={rest as Profile[]} meId={me.id} counts={countsById} />
      </div>
    </>
  );
}
