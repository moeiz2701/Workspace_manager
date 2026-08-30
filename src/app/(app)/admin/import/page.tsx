import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';

import { ImportPanel } from '@/components/admin/import-panel';
import { PageHeader } from '@/components/shell/page-header';
import { requireAdminProfile } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Import · Entropable Workspace' };

type ImportRow = {
  id: string;
  filename: string | null;
  created_at: string;
  summary: {
    tasks_created?: number;
    tasks_updated?: number;
    categories_created?: number;
    categories_updated?: number;
    warnings?: { message: string }[];
  } | null;
};

export default async function AdminImportPage() {
  await requireAdminProfile();

  const supabase = await createClient();
  const { data: history } = await supabase
    .from('imports')
    .select('id, filename, created_at, summary')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <>
      <PageHeader
        title="Import"
        description="Define the whole implementation plan in one JSON file. Every upload is recorded."
      />

      <div className="max-w-4xl space-y-10 p-6">
        <ImportPanel />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">History</h2>
          {(history ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No imports yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {((history ?? []) as ImportRow[]).map((row) => {
                const s = row.summary ?? {};
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="font-medium">{row.filename ?? 'untitled.json'}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(row.created_at))} ago
                    </span>
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      +{s.tasks_created ?? 0} tasks · ~{s.tasks_updated ?? 0} updated · +
                      {s.categories_created ?? 0} categories
                      {s.warnings?.length ? ` · ${s.warnings.length} warnings` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
