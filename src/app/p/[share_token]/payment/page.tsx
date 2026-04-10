'use client';

import { useSearchParams, useParams } from 'next/navigation';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Banknote, Loader2 } from 'lucide-react';

export default function PaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shareToken = params.share_token as string;
  const total = Number(searchParams.get('total')) || 0;
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Razorpay surcharge
  const razorpaySurcharge = total * 0.02;
  const razorpayGST = razorpaySurcharge * 0.18;
  const onlineTotal = total + razorpaySurcharge + razorpayGST;

  async function handleConfirm(paymentMethod: 'online' | 'offline') {
    setLoading(true);

    const addons = searchParams.get('addons') || '';
    const choices = searchParams.get('choices') || '{}';

    const res = await fetch(`/api/proposals/${shareToken}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        share_token: shareToken,
        payment_method: paymentMethod,
        addon_ids: addons ? addons.split(',') : [],
        choices: JSON.parse(choices),
      }),
    });

    if (res.ok) {
      setConfirmed(true);
    }
    setLoading(false);
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
            <p className="text-muted-foreground">Your travel proposal has been confirmed. Your agent will be in touch with next steps.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader><CardTitle>Complete Your Booking</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground">Confirmed Total</p>
            <p className="text-3xl font-bold">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>

          <Separator />

          {/* Option A: Razorpay */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="font-semibold">Pay Deposit Online</h3>
                <p className="text-sm text-muted-foreground">Via Razorpay (cards, UPI, net banking)</p>
              </div>
            </div>
            <div className="text-sm space-y-1 pl-9">
              <div className="flex justify-between"><span>Base amount</span><span>₹{total.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Payment gateway fee (2%)</span><span>+₹{razorpaySurcharge.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GST on fee (18%)</span><span>+₹{razorpayGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
              <Separator />
              <div className="flex justify-between font-medium"><span>Online total</span><span>₹{onlineTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
            </div>
            <Button className="w-full" onClick={() => handleConfirm('online')} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Pay Online
            </Button>
          </div>

          {/* Option B: Offline */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <Banknote className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold">Pay Offline</h3>
                <p className="text-sm text-muted-foreground">Bank transfer, cash, or cheque — confirm booking now</p>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={() => handleConfirm('offline')} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Banknote className="h-4 w-4 mr-2" />}
              Confirm & Pay Offline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
