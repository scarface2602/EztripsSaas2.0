'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ClientCombobox } from '@/components/clients/client-combobox';

const ITEM_TYPES = [
  { value: 'flight_segment', label: 'Flight' },
  { value: 'hotel_room', label: 'Hotel' },
  { value: 'train', label: 'Train' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'dmc_package', label: 'Package' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'activity', label: 'Activity' },
] as const;

// Common "booked through" channels — free text with suggestions, so new
// suppliers don't need any setup.
const VENDOR_SUGGESTIONS = ['Tripjack', 'AirIQ', 'MMT Partner', 'Indigo Portal', 'Own IRCTC', 'Trip banao', 'Yeti Airlines'];

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/**
 * The 30-second register entry: guest, what, how much — done.
 * Mirrors one row of the old query sheet; everything else can be
 * completed later on the booking page.
 */
export function QuickAddDialog({ open, onOpenChange, onCreated }: QuickAddDialogProps) {
  const [saving, setSaving] = useState(false);
  const [guest, setGuest] = useState<{ id: string; label: string } | null>(null);
  const [billTo, setBillTo] = useState<{ id: string; label: string } | null>(null);
  const [itemType, setItemType] = useState('flight_segment');
  const [label, setLabel] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [vendor, setVendor] = useState('');
  const [reference, setReference] = useState('');

  const canSubmit = guest && label.trim() && sellPrice !== '' && Number(sellPrice) >= 0;

  async function submit(addAnother: boolean) {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/bookings/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: guest!.id,
          bill_to_client_id: billTo?.id || null,
          item_type: itemType,
          label: label.trim(),
          destination,
          start_date: startDate,
          sell_price: Number(sellPrice),
          cost_price: costPrice === '' ? null : Number(costPrice),
          vendor_name: vendor,
          supplier_reference: reference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create entry');
      toast.success(`Entry created — ${data.trip_id}`);
      onCreated();
      if (addAnother) {
        // Keep guest/bill-to/vendor (typical: many tickets for one biller);
        // clear what changes per line.
        setLabel(''); setReference(''); setSellPrice(''); setCostPrice(''); setStartDate('');
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Quick Entry</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Guest *</Label>
            <ClientCombobox
              value={guest}
              onChange={(c) => setGuest(c ? { id: c.id, label: c.full_name } : null)}
              placeholder="Traveller name…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Billed to</Label>
            <ClientCombobox
              value={billTo}
              onChange={(c) => setBillTo(c ? { id: c.id, label: c.full_name } : null)}
              promptDetailsOnCreate
              placeholder="Defaults to guest"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select value={itemType} onValueChange={(v) => v && setItemType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. DEL → BOM 6E204, Taj Palace 2N…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Booked through</Label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} list="vendor-suggestions" placeholder="Tripjack, AirIQ…" />
            <datalist id="vendor-suggestions">
              {VENDOR_SUGGESTIONS.map((v) => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Booking reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PNR / tracker ID" className="font-mono" />
            <p className="text-xs text-muted-foreground">
              {reference ? 'Will be marked supplier-confirmed' : 'No reference → stays pending for ops'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Sell price (₹) *</Label>
            <Input type="number" min="0" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cost price (₹)</Label>
            <Input type="number" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="Fill later from supplier statement" />
            {costPrice !== '' && sellPrice !== '' && Number(sellPrice) >= Number(costPrice) && (
              <p className="text-xs text-green-700">Margin: ₹{(Number(sellPrice) - Number(costPrice)).toLocaleString('en-IN')}</p>
            )}
            {costPrice !== '' && sellPrice !== '' && Number(sellPrice) < Number(costPrice) && (
              <p className="text-xs text-red-600">Selling below cost — negative margin</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Travel date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Destination</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" disabled={!canSubmit || saving} onClick={() => submit(true)}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save & add another
          </Button>
          <Button disabled={!canSubmit || saving} onClick={() => submit(false)}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
