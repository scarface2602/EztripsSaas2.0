'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentLink {
  id: string;
  token: string;
  amount: number;
  label: string | null;
  status: string;
  created_at: string;
  used_at: string | null;
}

export function PaymentLinkGenerator({
  bookingId,
  currency = 'INR',
}: {
  bookingId: string;
  currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    const res = await fetch(`/api/bookings/${bookingId}/payment-links`);
    if (res.ok) {
      const data = await res.json();
      setLinks(data.links || []);
    }
  }, [bookingId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleCreate = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payment-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, label: label.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed to create');
      const data = await res.json();
      setLinks(prev => [data.link, ...prev]);
      setAmount('');
      setLabel('');
      toast.success('Payment link created');
    } catch {
      toast.error('Failed to create payment link');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (link: PaymentLink) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/p/pay/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sym = currency === 'INR' ? '₹' : currency;

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setOpen(true)}>
        <Link2 className="h-3.5 w-3.5" /> Generate Payment Link
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Payment Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount ({currency})</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. 2nd installment"
              />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Generate Link
            </Button>

            {/* Existing links */}
            {links.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Generated Links</p>
                {links.map(link => (
                  <div key={link.id} className="flex items-center gap-2 bg-muted/50 rounded p-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{sym}{Number(link.amount).toLocaleString('en-IN')}</span>
                        {link.label && <span className="text-xs text-muted-foreground">{link.label}</span>}
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${link.status === 'used' ? 'bg-green-50 text-green-700' : link.status === 'expired' ? 'bg-gray-50 text-gray-500' : ''}`}
                        >
                          {link.status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => copyLink(link)}
                      disabled={link.status !== 'active'}
                    >
                      {copiedId === link.id ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
