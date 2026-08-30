import type { Metadata } from 'next';

import { CategoryManager } from '@/components/admin/category-manager';
import { PageHeader } from '@/components/shell/page-header';
import { requireAdminProfile } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Category } from '@/types/app';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Categories · Entropable Workspace' };

export default async function AdminCategoriesPage() {
  await requireAdminProfile();

  const supabase = await createClient();
  const [{ data: categories }, { data: tasks }] = await Promise.all([
    supabase.from('categories').select('*').order('position'),
    supabase.from('tasks').select('category_id'),
  ]);

  const taskCounts: Record<string, number> = {};
  for (const t of tasks ?? []) {
    taskCounts[t.category_id] = (taskCounts[t.category_id] ?? 0) + 1;
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="The areas of the build. Drag to reorder — the order is used by the board's swimlanes and the tracker."
      />
      <div className="p-6">
        <CategoryManager categories={(categories ?? []) as Category[]} taskCounts={taskCounts} />
      </div>
    </>
  );
}
