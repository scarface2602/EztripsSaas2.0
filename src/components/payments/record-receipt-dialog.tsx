'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ClientCombobox } from '@/components/clients/client-combobox';
import { AccountSelect } from '@/components/payments/account-select';

interface OutstandingBooking {
  id: string;
  trip_id: string | null;
  title: string;
  created_at: string;
  sell_price: number;
  total_paid: number;
  due: number;
}

interface RecordReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  /** Pre-select the payer (e.g. when opened from a client page). */
  initialPayer?: { id: string; label: string } | null;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/**
 * One receipt, many bookings: enter who paid and how much, and the
 * payer's dues auto-allocate oldest-first. Whatever isn't allocated
 * stays on their account as an advance.
 */
export function RecordReceiptDialog({ open, onOpenChange, onCreated, initialPayer = null }: RecordReceiptDialogProps) {
  const [saving, setSaving] = useState(false);
  const [payer, setPayer] = useState<{ id: string; label: string } | null>(initialPayer);
  const [amount, setAmount] = useState('');
  const [receivedOn, setReceivedOn] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [outstanding, setOutstanding] = useState<OutstandingBooking[]>([]);
  const [loadingDues, setLoadingDues] = useState(false);
  // booking_id -> allocation amount (string for editing)
  const [allocs, setAllocs] = useState<Record<string, string>>({});

  const autoAllocate = useCallback((bookings: OutstandingBooking[], total: number) => {
    const next: Record<string, string> = {};
    let remaining = total;
    for (const b of bookings) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, b.due);
      next[b.id] = String(take);
      remaining = Math.round((remaining - take) * 100) / 100;
    }
    setAllocs(next);
  }, []);

  useEffect(() => {
    if (!payer) { setOutstanding([]); setAllocs({}); return; }
    setLoadingDues(true);
    (async () => {
      const res = await fetch(`/api/clients/${payer.id}/outstanding`);
      const rows: OutstandingBooking[] = res.ok ? await res.json() : [];
      setOutstanding(rows);
      autoAllocate(rows, Number(amount) || 0);
      setLoadingDues(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payer]);

  useEffect(() => {
    autoAllocate(outstanding, Number(amount) || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  const amountNum = Number(amount) || 0;
  const allocatedTotal = Object.values(allocs).reduce((s, v) => s + (Number(v) || 0), 0);
  const advance = Math.round((amountNum - allocatedTotal) * 100) / 100;
  const overAllocated = allocatedTotal > amountNum + 0.01;
  const canSubmit = payer && amountNum > 0 && !overAllocated;

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/client-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: payer!.id,
          amount: amountNum,
          received_on: receivedOn,
          account_id: accountId,
          reference,
          allocations: Object.entries(allocs)
            .map(([booking_id, v]) => ({ booking_id, amount: Number(v) || 0 }))
            .filter((a) => a.amount > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record receipt');
      toast.success(`${data.receipt_number} recorded${data.unallocated > 0 ? ` — ${fmt(data.unallocated)} kept as advance` : ''}`);
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record receipt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Receipt</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Received from *</Label>
            <ClientCombobox
              value={payer}
              onChange={(c) => setPayer(c ? { id: c.id, label: c.full_name } : null)}
              placeholder="Billing entity / client…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Received into</Label>
            <AccountSelect value={accountId} onChange={(a) => setAccountId(a?.id || null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-full">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no / UPI ref (optional)" />
          </div>
        </div>

        {payer && (
          <div className="space-y-2 mt-2">
            <Label>Allocate to bookings</Label>
            {loadingDues ? (
              <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : outstanding.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No outstanding bookings for {payer.label} — the full amount will be held as an advance.
              </p>
            ) : (
              <div className="border rounded-md divide-y">
                {outstanding.map((b) => {
                  const checked = (Number(allocs[b.id]) || 0) > 0;
                  return (
                    <div key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          setAllocs((prev) => ({ ...prev, [b.id]: c ? String(Math.min(b.due, Math.max(0, amountNum - allocatedTotal + (Number(prev[b.id]) || 0)))) : '' }));
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{b.trip_id}</span>
                        <span className="truncate">{b.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">due {fmt(b.due)}</span>
                      <Input
                        type="number"
                        min="0"
                        max={b.due}
                        value={allocs[b.id] || ''}
                        onChange={(e) => setAllocs((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        className="w-28 h-8 text-right"
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div className={`text-sm flex justify-between px-1 ${overAllocated ? 'text-red-600' : 'text-muted-foreground'}`}>
              <span>Allocated: {fmt(allocatedTotal)}</span>
              {overAllocated ? (
                <span>Allocations exceed the receipt amount</span>
              ) : (
                advance > 0 && amountNum > 0 && <span className="text-green-700">Advance: {fmt(advance)}</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit || saving} onClick={submit}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Record {amountNum > 0 ? fmt(amountNum) : 'Receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
