'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useBooking } from '../../booking-context';
import { ClientCombobox } from '@/components/clients/client-combobox';

export function BookingDetailsTab() {
  const { booking, billTo, updateBooking, saving } = useBooking();

  const [refNumber, setRefNumber] = useState('');
  const [blockingRef, setBlockingRef] = useState('');
  const [blockingExpires, setBlockingExpires] = useState('');
  const [notes, setNotes] = useState('');
  const [minConfirmationAmount, setMinConfirmationAmount] = useState('');

  useEffect(() => {
    if (booking) {
      setRefNumber(booking.reference_number || '');
      setBlockingRef(booking.blocking_reference || '');
      setBlockingExpires(booking.blocking_expires_at ? booking.blocking_expires_at.split('T')[0] : '');
      setNotes(booking.internal_notes || '');
      setMinConfirmationAmount(booking.min_confirmation_amount?.toString() || '');
    }
  }, [booking]);

  if (!booking) return null;

  const saveDetails = () => {
    updateBooking({
      reference_number: refNumber,
      blocking_reference: blockingRef,
      blocking_expires_at: blockingExpires || null,
      internal_notes: notes,
      min_confirmation_amount: minConfirmationAmount ? Number(minConfirmationAmount) : null,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Booking Details</CardTitle>
        <Button size="sm" onClick={saveDetails} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" /> Save
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Billed To
              {billTo?.client_kind === 'business' && billTo.gstin && (
                <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                  <Building2 className="h-3 w-3 mr-1" /> B2B · GST invoice
                </Badge>
              )}
            </Label>
            <ClientCombobox
              value={billTo ? { id: billTo.id, label: billTo.full_name } : null}
              onChange={(c) => updateBooking({ bill_to_client_id: c?.id || null })}
              promptDetailsOnCreate
              placeholder={`Defaults to ${booking.clients?.full_name || 'travelling client'}`}
            />
            <p className="text-xs text-muted-foreground">
              Who pays for this booking. Leave empty when the travelling client pays themselves.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Reference / Confirmation Number</Label>
            <Input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} placeholder="Supplier confirmation #" />
          </div>
          <div className="space-y-2">
            <Label>Pax</Label>
            <Input disabled value={`${booking.pax_adults} Adults${booking.pax_children > 0 ? `, ${booking.pax_children} Children` : ''}`} />
          </div>
          {booking.booking_type === 'hotel' && (
            <>
              <div className="space-y-2">
                <Label>Blocking Reference</Label>
                <Input value={blockingRef} onChange={(e) => setBlockingRef(e.target.value)} placeholder="Hotel blocking ref" />
              </div>
              <div className="space-y-2">
                <Label>Blocking Expires</Label>
                <Input type="date" value={blockingExpires} onChange={(e) => setBlockingExpires(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Min. Confirmation Amount</Label>
            <Input
              type="number"
              value={minConfirmationAmount}
              onChange={(e) => setMinConfirmationAmount(e.target.value)}
              placeholder="Client must pay at least this amount"
            />
            <p className="text-xs text-muted-foreground">If set, client cannot pay less than this on the payment page.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Internal Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Internal notes..." />
        </div>
        {booking.proposal_id && (
          <div className="text-sm text-muted-foreground">
            From proposal: <span className="font-medium">{booking.proposals?.title || booking.proposal_id}</span>
            {booking.proposals?.quote_type && ` (${booking.proposals.quote_type})`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
