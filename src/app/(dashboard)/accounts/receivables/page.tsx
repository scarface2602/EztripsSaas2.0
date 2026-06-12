'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, HandCoins, Plus, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { RecordReceiptDialog } from '@/components/payments/record-receipt-dialog';

interface EntityRow {
  client_id: string;
  name: string;
  kind: string;
  gstin: boolean;
  bookings: number;
  billed: number;
  received: number;
  due: number;
  advance: number;
}

interface ReceiptRow {
  id: string;
  receipt_number: string;
  amount: number;
  received_on: string;
  status: string;
  reference: string | null;
  allocated: number;
  unallocated: number;
  client: { full_name: string } | null;
  account: { account_name: string } | null;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function ReceivablesPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payer, setPayer] = useState<{ id: string; label: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [sumRes, recRes] = await Promise.all([
      fetch('/api/receivables/summary'),
      fetch('/api/client-receipts'),
    ]);
    if (sumRes.ok) setEntities(await sumRes.json());
    if (recRes.ok) setReceipts(await recRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function voidReceipt(r: ReceiptRow) {
    const reason = prompt(`Void ${r.receipt_number}? Booking dues will come back. Reason:`);
    if (reason === null) return;
    const res = await fetch(`/api/client-receipts/${r.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) { toast.success(`${r.receipt_number} voided`); fetchAll(); }
    else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to void'); }
  }

  const totalDue = entities.reduce((s, e) => s + e.due, 0);
  const totalAdvance = entities.reduce((s, e) => s + e.advance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HandCoins className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Receivables</h1>
        </div>
        <Button onClick={() => { setPayer(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Record Receipt
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            Outstanding by billing entity
            <Badge variant="outline" className="text-red-600 border-red-300">{fmt(totalDue)} due</Badge>
            {totalAdvance > 0 && (
              <Badge variant="outline" className="text-green-700 border-green-300">{fmt(totalAdvance)} in advances</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Advance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : entities.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nothing outstanding — all settled.</TableCell></TableRow>
              ) : (
                entities.map((e) => (
                  <TableRow key={e.client_id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/clients/${e.client_id}`)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {e.kind === 'business' && <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
                        {e.name}
                        {e.gstin && <Badge variant="outline" className="text-[10px] px-1">GST</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{e.bookings}</TableCell>
                    <TableCell className="text-right">{fmt(e.billed)}</TableCell>
                    <TableCell className="text-right">{fmt(e.received)}</TableCell>
                    <TableCell className={`text-right font-medium ${e.due > 0 ? 'text-red-600' : ''}`}>{e.due > 0 ? fmt(e.due) : '—'}</TableCell>
                    <TableCell className="text-right text-green-700">{e.advance > 0 ? fmt(e.advance) : '—'}</TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => { setPayer({ id: e.client_id, label: e.name }); setDialogOpen(true); }}>
                        Receive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Advance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No receipts yet</TableCell></TableRow>
              ) : (
                receipts.map((r) => (
                  <TableRow key={r.id} className={r.status === 'void' ? 'opacity-50' : ''}>
                    <TableCell className="font-mono text-xs">
                      {r.receipt_number}
                      {r.status === 'void' && <Badge variant="outline" className="ml-2 text-[10px]">VOID</Badge>}
                    </TableCell>
                    <TableCell>{r.client?.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(r.received_on), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{r.account?.account_name || '—'}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.amount))}</TableCell>
                    <TableCell className="text-right">{fmt(r.allocated)}</TableCell>
                    <TableCell className="text-right text-green-700">{r.unallocated > 0 ? fmt(r.unallocated) : '—'}</TableCell>
                    <TableCell>
                      {r.status === 'active' && (
                        <Button size="sm" variant="ghost" title="Void receipt" onClick={() => voidReceipt(r)}>
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {dialogOpen && (
        <RecordReceiptDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={fetchAll}
          initialPayer={payer}
        />
      )}
    </div>
  );
}
