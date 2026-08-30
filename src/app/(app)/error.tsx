'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-24 text-center">
      <AlertTriangle className="text-muted-foreground size-8" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          {error.message || 'This screen failed to load.'}
        </p>
        {error.digest ? (
          <p className="text-muted-foreground text-xs">Reference: {error.digest}</p>
        ) : null}
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
