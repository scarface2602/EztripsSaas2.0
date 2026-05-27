'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { OrganizePackagesDialog } from './organize-packages-dialog';
import type { Proposal, BookingItem } from '@/lib/types/database';
import type { BookingItem as BookingItemType } from '@/lib/types/booking-items';

interface ConvertToBookingButtonProps {
  proposal: Proposal;
  clientId: string;
}

export function ConvertToBookingButton({ proposal, clientId }: ConvertToBookingButtonProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [bookingItems, setBookingItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);

  async function handleOpenDialog() {
    setLoadingItems(true);
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

  async function handleCreateBooking(packages: any[]) {
    setCreatingBooking(true);
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposal.id,
          client_id: clientId,
          packages,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create booking');
      }

      const data = await res.json();
      toast.success('Booking created! Now set up payment schedules.');
      setShowDialog(false);

      // Navigate to booking details page
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
      <Button
        size="sm"
        onClick={handleOpenDialog}
        disabled={loadingItems || creatingBooking}
        className="bg-blue-600 hover:bg-blue-700"
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
