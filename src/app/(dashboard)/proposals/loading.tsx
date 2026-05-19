import { Skeleton } from '@/components/ui/skeleton';

export default function ProposalsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <div className="grid grid-cols-6 gap-4">
            {['w-24', 'w-20', 'w-16', 'w-20', 'w-16', 'w-12'].map((w, i) => (
              <Skeleton key={i} className={`h-4 ${w}`} />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-3">
            <div className="grid grid-cols-6 gap-4 items-center">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
