import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-96" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
