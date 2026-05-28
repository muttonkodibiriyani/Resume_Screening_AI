import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
