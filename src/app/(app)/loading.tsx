import { Skeleton } from '@/components/ui/skeleton';

export default function AppLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, column) => (
          <div key={column} className="space-y-2 rounded-lg border p-2">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, card) => (
              <Skeleton key={card} className="h-20 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
