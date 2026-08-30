import Link from 'next/link';
import { SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function TaskNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-24 text-center">
      <SearchX className="text-muted-foreground size-8" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No such task</h2>
        <p className="text-muted-foreground text-sm">
          It may have been renamed, or you may not have access to it.
        </p>
      </div>
      <Button asChild>
        <Link href="/tasks">Back to tasks</Link>
      </Button>
    </div>
  );
}
