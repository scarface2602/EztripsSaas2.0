'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Download, Loader2 } from 'lucide-react';
import { BookingFinancials } from '@/components/booking-financials';
import { useBooking } from '../../booking-context';
import { toast } from 'sonner';

function InvoiceReceiptList({ bookingId }: { bookingId: string }) {
  const [invoices, setInvoices] = useState<Array<{ id: string; invoice_number: string; invoice_type: string; total: number; pdf_url: string | null; created_at: string }>>([]);
  const [receipts, setReceipts] = useState<Array<{ id: string; receipt_number: string; amount: number; pdf_url: string | null; created_at: string }>>([]);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}/invoices`).then(r => r.ok ? r.json() : []).then(setInvoices).catch(() => {});
    fetch(`/api/bookings/${bookingId}/receipts`).then(r => r.ok ? r.json() : []).then(setReceipts).catch(() => {});
  }, [bookingId]);

  if (invoices.length === 0 && receipts.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Past Documents</p>
      {invoices.map(inv => (
        <div key={inv.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-sm">{inv.invoice_number}</span>
            <Badge variant="outline" className="text-[10px]">{inv.invoice_type}</Badge>
            <span className="text-xs text-muted-foreground">₹{Number(inv.total).toLocaleString('en-IN')}</span>
          </div>
          {inv.pdf_url && (
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => window.open(inv.pdf_url!, '_blank')}>
              <Download className="h-3 w-3 mr-1" /> PDF
            </Button>
          )}
        </div>
      ))}
      {receipts.map(rec => (
        <div key={rec.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
          <div className="flex items-center gap-2">
            <Download className="h-3.5 w-3.5 text-green-600" />
            <span className="text-sm">{rec.receipt_number}</span>
            <Badge variant="outline" className="text-[10px]">Receipt</Badge>
            <span className="text-xs text-muted-foreground">₹{Number(rec.amount).toLocaleString('en-IN')}</span>
          </div>
          {rec.pdf_url && (
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => window.open(rec.pdf_url!, '_blank')}>
              <Download className="h-3 w-3 mr-1" /> PDF
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function BookingFinancialsTab() {
  const { bookingId, booking } = useBooking();
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ amount: '', payment_mode: '', payment_date: new Date().toISOString().split('T')[0], reference_number: '', notes: '' });
  const [receiptLoading, setReceiptLoading] = useState(false);

  if (!booking) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={invoiceLoading}
              onClick={async () => {
                setInvoiceLoading(true);
                try {
                  const res = await fetch(`/api/bookings/${bookingId}/invoices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_type: 'proforma' }),
                  });
                  if (res.ok) {
                    const invoice = await res.json();
                    if (invoice.pdf_url) window.open(invoice.pdf_url, '_blank');
                    toast.success(`Invoice ${invoice.invoice_number} generated`);
                  } else {
                    const err = await res.json();
                    toast.error(err.error || 'Failed to generate invoice');
                  }
                } catch { toast.error('Failed to generate invoice'); }
                setInvoiceLoading(false);
              }}
            >
              {invoiceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate Proforma Invoice
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={invoiceLoading}
              onClick={async () => {
                setInvoiceLoading(true);
                try {
                  const res = await fetch(`/api/bookings/${bookingId}/invoices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_type: 'final' }),
                  });
                  if (res.ok) {
                    const invoice = await res.json();
                    if (invoice.pdf_url) window.open(invoice.pdf_url, '_blank');
                    toast.success(`Invoice ${invoice.invoice_number} generated`);
                  } else {
                    const err = await res.json();
                    toast.error(err.error || 'Failed to generate invoice');
                  }
                } catch { toast.error('Failed to generate invoice'); }
                setInvoiceLoading(false);
              }}
            >
              {invoiceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate Final Invoice
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setShowReceiptDialog(true)}
            >
              <Download className="h-4 w-4" /> Generate Receipt
            </Button>
          </div>
          <InvoiceReceiptList bookingId={bookingId} />
        </CardContent>
      </Card>

      <BookingFinancials bookingId={bookingId} currency={booking.currency} />

      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Payment Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                placeholder="Enter amount received"
                value={receiptForm.amount}
                onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={receiptForm.payment_date}
                onChange={(e) => setReceiptForm({ ...receiptForm, payment_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select
                value={receiptForm.payment_mode}
                onValueChange={(v) => setReceiptForm({ ...receiptForm, payment_mode: v || '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                placeholder="Transaction/cheque reference"
                value={receiptForm.reference_number}
                onChange={(e) => setReceiptForm({ ...receiptForm, reference_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={receiptForm.notes}
                onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>Cancel</Button>
            <Button
              disabled={receiptLoading || !receiptForm.amount || !receiptForm.payment_date}
              onClick={async () => {
                setReceiptLoading(true);
                try {
                  const res = await fetch(`/api/bookings/${bookingId}/receipts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(receiptForm),
                  });
                  if (res.ok) {
                    const receipt = await res.json();
                    if (receipt.pdf_url) window.open(receipt.pdf_url, '_blank');
                    toast.success(`Receipt ${receipt.receipt_number} generated`);
                    setShowReceiptDialog(false);
                    setReceiptForm({ amount: '', payment_mode: '', payment_date: new Date().toISOString().split('T')[0], reference_number: '', notes: '' });
                  } else {
                    const err = await res.json();
                    toast.error(err.error || 'Failed to generate receipt');
                  }
                } catch { toast.error('Failed to generate receipt'); }
                setReceiptLoading(false);
              }}
            >
              {receiptLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Generate Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
