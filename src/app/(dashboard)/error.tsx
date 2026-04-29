'use client';

import { EzTripsLogo } from '@/components/eztrips-logo';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <EzTripsLogo size="lg" className="opacity-40 mb-2" />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm max-w-md text-center">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
