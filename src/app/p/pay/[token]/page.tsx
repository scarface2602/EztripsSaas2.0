'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { CheckoutDialog } from '@/components/proposals/CheckoutDialog';

interface PaymentLinkData {
  id: string;
  token: string;
  amount: number;
  currency: string;
  label: string | null;
  status: string;
  booking_id: string;
  share_token: string | null;
  pax_adults: number;
  pax_children: number;
}

export default function PaymentLinkPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<PaymentLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/p/pay/${token}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Invalid payment link');
      } else {
        setData(await res.json());
      }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-3">
            <h2 className="text-xl font-bold">Payment Link Unavailable</h2>
            <p className="text-muted-foreground text-sm">{error || 'This link is no longer valid.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <CheckoutDialog
        open={true}
        onOpenChange={() => {}}
        shareToken={data.share_token || ''}
        totalAmount={Number(data.amount)}
        currency={data.currency}
        paxAdults={data.pax_adults}
        paxChildren={data.pax_children}
        bookingId={data.booking_id}
        fixedAmount={Number(data.amount)}
        paymentLinkToken={data.token}
      />
    </div>
  );
}
