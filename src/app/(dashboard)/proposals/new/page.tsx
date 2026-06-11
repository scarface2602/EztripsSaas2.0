'use client';

// The old multi-step "manual vs AI import" chooser is gone — every new
// proposal is a Builder v2 draft. This page just creates one (forwarding
// enquiry/client links from the query string) and redirects into it.
// AI quote parsing now lives inside the builder ("AI fill from quote").

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NewProposalPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CreateAndRedirect />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" /> Creating proposal…
    </div>
  );
}

function CreateAndRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // strict-mode double-mount guard
    started.current = true;
    (async () => {
      const res = await fetch('/api/proposals/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiry_id: searchParams.get('enquiry_id') || undefined,
          client_id: searchParams.get('client_id') || undefined,
        }),
      });
      if (!res.ok) {
        setError('Could not create the proposal. Please try again.');
        return;
      }
      const { id } = await res.json();
      router.replace(`/proposals/${id}`);
    })();
  }, [router, searchParams]);

  if (error) return <div className="py-24 text-center text-destructive">{error}</div>;
  return <Spinner />;
}
