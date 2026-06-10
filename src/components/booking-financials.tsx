'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown,
  DollarSign, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BookingFinancialsProps {
  bookingId: string;
  currency: string;
}

interface FinancialData {
  summary: {
    sellPrice: number;
    costPrice: number;
    totalCollected: number;
    pendingFromClient: number;
    totalPaidToSuppliers: number;
    pendingToSuppliers: number;
    totalBankCharges: number;
    totalTcs: number;
    projectedProfit: number;
    projectedMarginPct: number;
    actualProfit: number;
    variance: number;
  };
  collections: any[];
  supplierPayments: any[];
  supplierGroups: {
    name: string;
    totalCost: number;
    paid: number;
    balance: number;
    bankCharges: number;
    items: any[];
  }[];
  packagePayments: any[];
  pnl: {
    projected: { revenue: number; cost: number; profit: number };
    actual: { revenue: number; cost: number; profit: number };
    variance: number;
  };
  cashFlow: {
    date: string;
    type: 'in' | 'out';
    amount: number;
    description: string;
    ref?: string;
  }[];
  currency: string;
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function BookingFinancials({ bookingId, currency }: BookingFinancialsProps) {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'collections' | 'suppliers' | 'pnl' | 'cashflow'>('collections');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  // Record payment dialog
  const [recordDialog, setRecordDialog] = useState<{ type: 'collection' | 'supplier'; id?: string; packageId?: string } | null>(null);
  const [recordForm, setRecordForm] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);

  const cur = currency === 'INR' ? '\u20B9' : currency;
  const fmt = (n: number) => `${cur}${n.toLocaleString('en-IN')}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/financials`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRecordPayment = async () => {
    if (!recordDialog || !recordForm.amount) return;
    setRecording(true);
    try {
      const endpoint = `/api/bookings/${bookingId}/financials`;

      const body: Record<string, unknown> = {
        paymentId: recordDialog.id,
        packageId: recordDialog.packageId || null,
        status: 'paid',
        amount_paid: Number(recordForm.amount) || 0,
        payment_method: recordForm.payment_mode || 'bank_transfer',
      };

      if (recordDialog.type === 'supplier') {
        if (recordForm.reference) body.reference_number = recordForm.reference;
        if (recordForm.bank_charges) body.bank_charges = Number(recordForm.bank_charges);
      }

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success('Payment recorded');
        setRecordDialog(null);
        setRecordForm({});
        await fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to record');
      }
    } catch {
      toast.error('Failed to record payment');
    }
    setRecording(false);
  };

  if (loading) return <div className="flex items-center justify-center h-32 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading financials...</div>;
  if (!data) return <div className="text-center text-muted-foreground py-8">No financial data available</div>;

  const { summary, pnl, cashFlow } = data;

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sell Price</p>
          <p className="text-lg font-bold">{fmt(summary.sellPrice)}</p>
        </Card>
        <Card className="p-3 border-green-200 dark:border-green-800">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Collected</p>
          <p className="text-lg font-bold text-green-600">{fmt(summary.totalCollected)}</p>
        </Card>
        <Card className="p-3 border-amber-200 dark:border-amber-800">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending (Client)</p>
          <p className="text-lg font-bold text-amber-600">{fmt(summary.pendingFromClient)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid (Suppliers)</p>
          <p className="text-lg font-bold">{fmt(summary.totalPaidToSuppliers)}</p>
        </Card>
        <Card className="p-3 border-red-200 dark:border-red-800">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Due (Suppliers)</p>
          <p className="text-lg font-bold text-red-600">{fmt(summary.pendingToSuppliers)}</p>
        </Card>
        <Card className={`p-3 ${summary.projectedProfit >= 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit</p>
          <p className={`text-lg font-bold ${summary.projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(summary.projectedProfit)} <span className="text-xs font-normal">({summary.projectedMarginPct}%)</span>
          </p>
        </Card>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        {([
          ['collections', 'Collections (Money In)', ArrowDownCircle],
          ['suppliers', 'Supplier Payments (Out)', ArrowUpCircle],
          ['pnl', 'P&L', TrendingUp],
          ['cashflow', 'Cash Flow', DollarSign],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              activeSection === key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Collections (Money IN) */}
      {activeSection === 'collections' && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-green-600" />
              Collections from Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.collections.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No receivables recorded for this booking.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>TCS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.collections.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.description}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(Number(r.amount))}</TableCell>
                      <TableCell>{r.due_date ? format(new Date(r.due_date), 'dd MMM yyyy') : '-'}</TableCell>
                      <TableCell className="capitalize text-xs">{r.payment_method?.replace(/_/g, ' ') || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.receipt_number || '-'}</TableCell>
                      <TableCell>{r.tcs_amount && Number(r.tcs_amount) > 0 ? fmt(Number(r.tcs_amount)) : '-'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[r.status] || ''}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setRecordForm({ amount: String(r.amount) });
                              setRecordDialog({ type: 'collection', id: r.id, packageId: r.package_id });
                            }}
                          >
                            Record
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals */}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmt(data.collections.reduce((s: number, r: any) => s + Number(r.amount), 0))}</TableCell>
                    <TableCell colSpan={4}></TableCell>
                    <TableCell>
                      <span className="text-green-600">{fmt(summary.totalCollected)}</span>
                      {summary.pendingFromClient > 0 && (
                        <span className="text-amber-600 ml-2 font-normal text-xs">({fmt(summary.pendingFromClient)} pending)</span>
                      )}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Supplier Payments (Money OUT) */}
      {activeSection === 'suppliers' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-red-600" />
              Supplier Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.supplierGroups.length === 0 && data.packagePayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No supplier payments recorded.</p>
            ) : (
              <>
                {/* Grouped by supplier */}
                {data.supplierGroups.map((group, idx) => (
                  <div key={idx} className="border rounded-lg">
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedSupplier(expandedSupplier === group.name ? null : group.name)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{group.name}</span>
                        <Badge variant="outline" className="text-xs">{group.items.length} payments</Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-bold">{fmt(group.totalCost)}</span>
                          <span className="text-green-600 ml-2">Paid: {fmt(group.paid)}</span>
                          {group.balance > 0 && <span className="text-red-600 ml-2">Due: {fmt(group.balance)}</span>}
                        </div>
                        {expandedSupplier === group.name ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {expandedSupplier === group.name && (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Mode</TableHead>
                              <TableHead>Bank Charges</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((p: any) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.description}</TableCell>
                                <TableCell className="text-right font-bold">{fmt(Number(p.amount))}</TableCell>
                                <TableCell>{p.due_date ? format(new Date(p.due_date), 'dd MMM yyyy') : '-'}</TableCell>
                                <TableCell className="capitalize text-xs">{p.payment_mode?.replace(/_/g, ' ') || '-'}</TableCell>
                                <TableCell>{p.bank_charges && Number(p.bank_charges) > 0 ? fmt(Number(p.bank_charges)) : '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{p.reference || '-'}</TableCell>
                                <TableCell>
                                  <Badge className={STATUS_COLORS[p.status] || ''}>{p.status}</Badge>
                                </TableCell>
                                <TableCell>
                                  {p.status !== 'paid' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => {
                                        setRecordForm({ amount: String(p.amount) });
                                        setRecordDialog({ type: 'supplier', id: p.id, packageId: p.package_id });
                                      }}
                                    >
                                      Record
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}

                {/* Package payments (if no payables but package payments exist) */}
                {data.supplierGroups.length === 0 && data.packagePayments.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Paid Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.packagePayments.map((p: any, i: number) => (
                        <TableRow key={p.id || i}>
                          <TableCell>{p.sequence}</TableCell>
                          <TableCell className="font-medium">
                            {p.supplier_name ? `${p.supplier_name} — ` : ''}Payment #{p.sequence}
                          </TableCell>
                          <TableCell className="text-right font-bold">{fmt(Number(p.amount))}</TableCell>
                          <TableCell>{p.due_date ? format(new Date(p.due_date), 'dd MMM yyyy') : '-'}</TableCell>
                          <TableCell>{p.paid_date ? format(new Date(p.paid_date), 'dd MMM yyyy') : '-'}</TableCell>
                          <TableCell><Badge className={STATUS_COLORS[p.status] || ''}>{p.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Bank charges summary */}
                {summary.totalBankCharges > 0 && (
                  <div className="bg-muted/50 rounded-md p-3 text-sm">
                    Total Bank Charges: <span className="font-bold">{fmt(summary.totalBankCharges)}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* P&L */}
      {activeSection === 'pnl' && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Projected */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Projected (During Booking)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue (Sell Price)</span>
                  <span className="font-bold">{fmt(pnl.projected.revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost (Cost Price)</span>
                  <span className="font-bold">{fmt(pnl.projected.cost)}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="font-semibold">Projected Profit</span>
                  <span className={`text-lg font-bold ${pnl.projected.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(pnl.projected.profit)}
                    <span className="text-xs font-normal ml-1">({summary.projectedMarginPct}%)</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actual */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actual (Post-Trip)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue (Collected)</span>
                  <span className="font-bold">{fmt(pnl.actual.revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost (Paid + Charges)</span>
                  <span className="font-bold">{fmt(pnl.actual.cost)}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="font-semibold">Actual Profit</span>
                  <span className={`text-lg font-bold ${pnl.actual.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(pnl.actual.profit)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Variance</span>
                  <span className={`font-bold flex items-center gap-1 ${pnl.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pnl.variance >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {pnl.variance >= 0 ? '+' : ''}{fmt(pnl.variance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Flow */}
      {activeSection === 'cashflow' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cash Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cashFlow.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No cash flow entries yet.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">In</TableHead>
                      <TableHead className="text-right">Out</TableHead>
                      <TableHead className="text-right">Running Balance</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let runningBalance = 0;
                      return cashFlow.map((entry, idx) => {
                        runningBalance += entry.type === 'in' ? entry.amount : -entry.amount;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{format(new Date(entry.date), 'dd MMM yyyy')}</TableCell>
                            <TableCell className="font-medium text-sm">{entry.description}</TableCell>
                            <TableCell className="text-right">
                              {entry.type === 'in' ? (
                                <span className="text-green-600 font-bold">{fmt(entry.amount)}</span>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.type === 'out' ? (
                                <span className="text-red-600 font-bold">{fmt(entry.amount)}</span>
                              ) : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {fmt(runningBalance)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{entry.ref || '-'}</TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
                {/* Net summary */}
                <div className="mt-4 grid grid-cols-3 gap-3 bg-muted/50 rounded-lg p-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total In</span>
                    <p className="font-bold text-green-600">{fmt(cashFlow.filter(e => e.type === 'in').reduce((s, e) => s + e.amount, 0))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Out</span>
                    <p className="font-bold text-red-600">{fmt(cashFlow.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Net Balance</span>
                    <p className={`font-bold ${
                      cashFlow.reduce((s, e) => s + (e.type === 'in' ? e.amount : -e.amount), 0) >= 0
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {fmt(cashFlow.reduce((s, e) => s + (e.type === 'in' ? e.amount : -e.amount), 0))}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={!!recordDialog} onOpenChange={open => { if (!open) setRecordDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Record {recordDialog?.type === 'collection' ? 'Collection' : 'Supplier Payment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input value={recordForm.amount || ''} disabled className="font-bold" />
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select
                value={recordForm.payment_mode || 'bank_transfer'}
                onValueChange={v => setRecordForm(f => ({ ...f, payment_mode: v || 'bank_transfer' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer / NEFT / RTGS</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recordDialog?.type === 'supplier' && (
              <>
                <div>
                  <Label>Reference / Transaction ID</Label>
                  <Input
                    value={recordForm.reference || ''}
                    onChange={e => setRecordForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="UTR, cheque number..."
                  />
                </div>
                <div>
                  <Label>Bank Charges (if any)</Label>
                  <Input
                    type="number"
                    value={recordForm.bank_charges || ''}
                    onChange={e => setRecordForm(f => ({ ...f, bank_charges: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialog(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={recording}>
              {recording && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
