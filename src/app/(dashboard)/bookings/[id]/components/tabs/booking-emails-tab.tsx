'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, Bell, CheckCircle2, Mail, Loader2 } from 'lucide-react';
import { useBooking } from '../../booking-context';
import { format } from 'date-fns';
import { ITEM_TYPE_LABELS } from '@/lib/types/booking-items';
import { toast } from 'sonner';

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function BookingEmailsTab() {
  const { bookingId, booking, items, emails, fetchAll } = useBooking();

  const [composeOpen, setComposeOpen] = useState(false);
  const [template, setTemplate] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  if (!booking) return null;

  const clientEmail = booking.clients?.email || '';

  const openCompose = (tpl: string) => {
    setTemplate(tpl);
    setPreviewHtml('');
    setPreviewSubject('');
    setSelectedItemId('');
    if (tpl === 'payment_reminder' || tpl === 'booking_confirmed') {
      setToEmail(clientEmail);
    } else if (tpl === 'confirmation_request' || tpl === 'follow_up') {
      const firstWithEmail = items.find((i) => i.vendor_email);
      setToEmail(firstWithEmail?.vendor_email || '');
      setSelectedItemId(firstWithEmail?.id || '');
    }
    setComposeOpen(true);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          to_email: toEmail,
          item_id: selectedItemId || undefined,
          preview: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewSubject(data.subject);
        setPreviewHtml(data.html);
      }
    } catch { /* ignore */ }
    setPreviewing(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          to_email: toEmail,
          item_id: selectedItemId || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Email sent!');
        setComposeOpen(false);
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to send');
      }
    } catch {
      toast.error('Failed to send email');
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Compose Email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => openCompose('confirmation_request')}>
              <Send className="h-4 w-4" />
              <span className="text-xs">Request Confirmation</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => openCompose('payment_reminder')}>
              <Bell className="h-4 w-4" />
              <span className="text-xs">Payment Reminder</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => openCompose('booking_confirmed')}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Booking Confirmed</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => openCompose('follow_up')}>
              <Mail className="h-4 w-4" />
              <span className="text-xs">Follow Up</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Email History ({emails.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No emails sent yet</TableCell></TableRow>
              ) : emails.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{e.subject}</TableCell>
                  <TableCell>{e.to_email || '-'}</TableCell>
                  <TableCell className="capitalize text-xs">{e.template_type?.replace(/_/g, ' ') || '-'}</TableCell>
                  <TableCell><Badge className={BOOKING_STATUS_COLORS[e.status] || ''}>{e.status}</Badge></TableCell>
                  <TableCell className="text-xs">{e.sent_at ? format(new Date(e.sent_at), 'dd MMM HH:mm') : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {template === 'confirmation_request' && 'Request Confirmation'}
              {template === 'payment_reminder' && 'Payment Reminder'}
              {template === 'booking_confirmed' && 'Booking Confirmed'}
              {template === 'follow_up' && 'Follow Up'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>To</Label>
              <Input value={toEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToEmail(e.target.value)} placeholder="email@example.com" />
            </div>

            {(template === 'confirmation_request' || template === 'follow_up') && items.length > 0 && (
              <div>
                <Label>Booking Item</Label>
                <Select value={selectedItemId} onValueChange={v => {
                  setSelectedItemId(v || '');
                  const item = items.find((i) => i.id === v);
                  if (item?.vendor_email) setToEmail(item.vendor_email);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label} {ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] ? `(${ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS]})` : ''}
                        {item.vendor_email ? ` — ${item.vendor_email}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!previewHtml && (
              <Button variant="outline" onClick={handlePreview} disabled={previewing || !toEmail}>
                {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Preview Email
              </Button>
            )}

            {previewHtml && (
              <div className="space-y-2">
                <div className="bg-muted/50 rounded-md p-2">
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium">{previewSubject}</p>
                </div>
                <div className="border rounded-md p-4 bg-white dark:bg-slate-900 max-h-80 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !toEmail}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
