'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { OrganizePackagesDialog } from './organize-packages-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Proposal } from '@/lib/types/database';

interface HandoverChecklist {
  passports_verified: boolean;
  pan_verified: boolean;
  initial_deposit_received: boolean;
}

interface ConvertToBookingButtonProps {
  proposal: Proposal;
  clientId: string;
  handoverChecklist?: HandoverChecklist;
}

export function ConvertToBookingButton({ proposal, clientId, handoverChecklist }: ConvertToBookingButtonProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookingItems, setBookingItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);

  // Compute missing checks
  const missingChecks: string[] = [];
  if (handoverChecklist) {
    if (!handoverChecklist.passports_verified) missingChecks.push('Passports');
    if (!handoverChecklist.pan_verified) missingChecks.push('PAN');
    if (!handoverChecklist.initial_deposit_received) missingChecks.push('Initial Deposit');
  }
  const hasWarnings = missingChecks.length > 0;

  async function proceedToBookingItems() {
    setLoadingItems(true);
    setShowOverrideDialog(false);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/booking-items`);
      if (!res.ok) throw new Error('Failed to load booking items');
      const data = await res.json();
      setBookingItems(data.bookingItems || []);
      setShowDialog(true);
    } catch (error) {
      toast.error('Failed to load booking items');
      console.error(error);
    } finally {
      setLoadingItems(false);
    }
  }

  function handleOpenDialog() {
    if (hasWarnings) {
      // Show override dialog instead of blocking
      setOverrideReason('');
      setShowOverrideDialog(true);
    } else {
      proceedToBookingItems();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleCreateBooking(packages: any[]) {
    setCreatingBooking(true);
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposal.id,
          client_id: clientId,
          sell_price: proposal.total_sp || undefined,
          packages,
          ...(overrideReason ? { handover_override_reason: overrideReason } : {}),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create booking');
      }

      const data = await res.json();
      toast.success('Booking created! Now set up payment schedules.');
      setShowDialog(false);
      router.push(`/bookings/${data.booking.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking');
      console.error(error);
    } finally {
      setCreatingBooking(false);
    }
  }

  // Only show if proposal is confirmed
  if (proposal.status !== 'confirmed') {
    return null;
  }

  return (
    <>
      {hasWarnings && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Missing: {missingChecks.join(', ')}
        </p>
      )}
      <Button
        size="sm"
        onClick={handleOpenDialog}
        disabled={loadingItems || creatingBooking}
        className={hasWarnings ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}
      >
        {loadingItems || creatingBooking ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            {loadingItems ? 'Loading...' : 'Creating...'}
          </>
        ) : (
          'Convert to Booking'
        )}
      </Button>

      {/* Override Confirmation Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Handover Checklist Incomplete</DialogTitle>
            <DialogDescription>
              The following items have not been verified. You can still proceed by providing a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {missingChecks.map((check) => (
              <div key={check} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{check} not verified</span>
              </div>
            ))}

            <div className="pt-2">
              <label className="text-sm font-medium block mb-1.5">
                Override Reason <span className="text-red-500">*</span>
              </label>
              <Input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g., Domestic booking — no passport needed"
              />
              <p className="text-xs text-muted-foreground mt-1">This will be logged for audit purposes.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={proceedToBookingItems}
              disabled={!overrideReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrganizePackagesDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        proposal={proposal}
        bookingItems={bookingItems}
        onConfirm={handleCreateBooking}
        isLoading={creatingBooking}
      />
    </>
  );
}
