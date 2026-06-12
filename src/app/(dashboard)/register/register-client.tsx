'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, NotebookText, Building2, HandCoins } from 'lucide-react';
import { format } from 'date-fns';
import { Pagination } from '@/components/pagination';
import { hasPermission, type Role } from '@/lib/auth/permissions';
import { QuickAddDialog } from './quick-add-dialog';
import { RecordReceiptDialog } from '@/components/payments/record-receipt-dialog';

interface RegisterRow {
  id: string;
  trip_id: string | null;
  date: string;
  title: string;
  booking_type: string;
  destination: string | null;
  booking_status: string;
  guest: string;
  bill_to: string | null;
  bill_to_kind: string | null;
  bill_to_gst: boolean;
  vendor: string | null;
  reference: string | null;
  item_count: number;
  sell_price: number;
  total_paid: number;
  due: number;
  payment_status: 'received' | 'partial' | 'due' | 'na';
  currency: string;
  entered_by: string;
}

const TYPE_OPTIONS = [
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'package', label: 'Package' },
  { value: 'land', label: 'Land / Transfer' },
  { value: 'train', label: 'Train' },
  { value: 'insurance', label: 'Insurance' },
];

const PAYMENT_BADGES: Record<string, { label: string; className: string }> = {
  received: { label: 'Received', className: 'bg-green-100 text-green-700' },
  partial: { label: 'Partial', className: 'bg-amber-100 text-amber-800' },
  due: { label: 'Due', className: 'bg-red-100 text-red-700' },
  na: { label: '—', className: 'bg-gray-100 text-gray-500' },
};

const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function RegisterClient({ role }: { role: Role }) {
  const router = useRouter();
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [quickOpen, setQuickOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const canAdd = hasPermission(role, 'bookings.manage');
  const canReceive = hasPermission(role, 'payments.manage');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('q', search);
    if (type) params.set('type', type);
    const res = await fetch(`/api/register?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows || []);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
  }, [page, search, type]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchRows, search]);

  useEffect(() => { setPage(1); }, [search, type]);

  const visible = paymentFilter ? rows.filter((r) => r.payment_status === paymentFilter) : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NotebookText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Register</h1>
        </div>
        <div className="flex gap-2">
          {canReceive && (
            <Button variant="outline" onClick={() => setReceiptOpen(true)}>
              <HandCoins className="h-4 w-4 mr-2" /> Record Receipt
            </Button>
          )}
          {canAdd && (
            <Button onClick={() => setQuickOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Quick Entry
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trip ID, title, destination…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={type || 'all'} onValueChange={(v) => setType(v && v !== 'all' ? v : '')}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          {(['due', 'partial', 'received'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={paymentFilter === s ? 'default' : 'outline'}
              onClick={() => setPaymentFilter(paymentFilter === s ? '' : s)}
            >
              {PAYMENT_BADGES[s].label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Trip ID</TableHead>
              <TableHead>Billed To</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Booked Through</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                {paymentFilter ? 'No bookings with this payment status on this page' : 'No bookings yet'}
              </TableCell></TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/bookings/${r.id}`)}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{format(new Date(r.date), 'dd MMM')}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{r.trip_id || '—'}</TableCell>
                  <TableCell>
                    {r.bill_to ? (
                      <span className="flex items-center gap-1">
                        {r.bill_to_kind === 'business' && <Building2 className="h-3 w-3 text-muted-foreground" />}
                        {r.bill_to}
                        {r.bill_to_gst && <Badge variant="outline" className="text-[10px] px-1">GST</Badge>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{r.guest}</span>
                    )}
                  </TableCell>
                  <TableCell>{r.guest}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.title}>
                    <Badge variant="outline" className="text-[10px] mr-1 capitalize">{r.booking_type}</Badge>
                    {r.title}
                  </TableCell>
                  <TableCell>{r.vendor || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.reference || '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmtMoney(r.sell_price)}</TableCell>
                  <TableCell className={`text-right whitespace-nowrap ${r.due > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    {r.due > 0 ? fmtMoney(r.due) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={PAYMENT_BADGES[r.payment_status].className + ' text-xs'}>
                      {PAYMENT_BADGES[r.payment_status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {quickOpen && (
        <QuickAddDialog
          open={quickOpen}
          onOpenChange={setQuickOpen}
          onCreated={fetchRows}
        />
      )}
      {receiptOpen && (
        <RecordReceiptDialog
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          onCreated={fetchRows}
        />
      )}
    </div>
  );
}
