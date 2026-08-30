import Link from 'next/link';
import { Download, FileJson, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Empty states are instructive, not decorative (§7.3): an empty board points
 * straight at the import screen with an example file to start from.
 */
export function EmptyWorkspace({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-24 text-center">
      <FileJson className="text-muted-foreground size-10" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No tasks yet</h2>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          {isAdmin
            ? 'Define the whole plan in one JSON file — categories, the task tree, who is assigned and what depends on what — then upload it.'
            : 'The admin has not set up the plan yet. Your assigned tasks will appear here.'}
        </p>
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/admin/import">
              <Upload className="size-4" /> Import a plan
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href="/example-import.json" download>
              <Download className="size-4" /> Download example JSON
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
