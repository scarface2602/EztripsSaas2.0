'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, CheckCircle2, CreditCard, Banknote, Upload, ChevronRight, ChevronLeft, User, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CheckoutPassenger } from '@/lib/schemas/passengers';

interface RzpOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}
interface RzpWindow { Razorpay: new (opts: RzpOptions) => { open: () => void } }

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('razorpay-sdk')) return resolve();
    const script = document.createElement('script');
    script.id = 'razorpay-sdk';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.head.appendChild(script);
  });
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string;
  totalAmount: number;
  currency: string;
  paxAdults: number;
  paxChildren: number;
  bookingId?: string | null;
  /** Fixed amount from payment link — locks the amount */
  fixedAmount?: number | null;
  paymentLinkToken?: string | null;
}

type Step = 'passengers' | 'payment' | 'success';

export function CheckoutDialog({
  open, onOpenChange, shareToken, totalAmount, currency,
  paxAdults, paxChildren, bookingId,
  fixedAmount, paymentLinkToken,
}: CheckoutDialogProps) {
  const paxTotal = paxAdults + paxChildren;

  // Passengers
  const [passengers, setPassengers] = useState<CheckoutPassenger[]>(() =>
    Array.from({ length: paxTotal }, (_, i) => ({
      type: i < paxAdults ? 'adult' : 'child',
      title: null,
      first_name: '',
      last_name: null,
      dob: null,
      passport_number: null,
      passport_expiry: null,
    }))
  );
  const [skipDetails, setSkipDetails] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'offline' | null>(null);
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Step
  const [step, setStep] = useState<Step>('passengers');

  const payAmount = fixedAmount ?? totalAmount;

  const updatePassenger = (idx: number, patch: Partial<CheckoutPassenger>) => {
    setPassengers(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  const canProceedToPayment = () => {
    // Only primary traveler name is required
    return passengers[0]?.first_name?.trim().length > 0;
  };

  const handleSubmit = async () => {
    if (paymentMethod === 'offline' && !utr.trim()) {
      toast.error('Transaction reference (UTR) is required for offline payment');
      return;
    }

    setLoading(true);
    try {
      // 1. Save passengers
      if (bookingId) {
        const passengerPayload = skipDetails
          ? [passengers[0]] // Only primary
          : passengers.filter(p => p.first_name?.trim());

        await fetch(`/api/bookings/${bookingId}/passengers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passengers: passengerPayload }),
        });
      }

      // 2. Process payment
      const paymentBody: Record<string, unknown> = {
        share_token: shareToken,
        payment_method: paymentMethod,
        amount: payAmount,
        utr: paymentMethod === 'offline' ? utr.trim() : undefined,
        payment_link_token: paymentLinkToken || undefined,
      };

      const res = await fetch(`/api/proposals/${shareToken}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentBody),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Payment failed');
      }

      setStep('success');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleOnlinePayment = async () => {
    setPaymentMethod('online');
    setLoading(true);
    try {
      // 1. Save passengers first
      if (bookingId) {
        const passengerPayload = skipDetails
          ? [passengers[0]]
          : passengers.filter(p => p.first_name?.trim());
        await fetch(`/api/bookings/${bookingId}/passengers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passengers: passengerPayload }),
        });
      }

      // 2. Create Razorpay order
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payAmount,
          currency,
          share_token: shareToken,
          booking_id: bookingId || undefined,
          payment_link_token: paymentLinkToken || undefined,
        }),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || 'Failed to create payment order');
      }
      const { order_id, key_id, amount: amountPaise } = await orderRes.json();

      // 3. Load Razorpay script if not already loaded
      await loadRazorpayScript();

      // 4. Open Razorpay checkout
      const rzp = new (window as unknown as RzpWindow).Razorpay({
        key: key_id,
        amount: amountPaise,
        currency,
        order_id,
        name: 'EzTrips',
        description: fixedAmount ? 'Partial Payment' : 'Booking Payment',
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          // Payment successful — confirm the proposal
          try {
            const res = await fetch(`/api/proposals/${shareToken}/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                share_token: shareToken,
                payment_method: 'online',
                amount: payAmount,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                payment_link_token: paymentLinkToken || undefined,
              }),
            });
            if (!res.ok) {
              const err = await res.json();
              toast.error(err.error || 'Payment recorded but confirmation failed');
            }
          } catch {
            // Webhook will handle reconciliation
          }
          setStep('success');
          setLoading(false);
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.error('Payment was cancelled');
          },
        },
        theme: { color: '#2563eb' },
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {step === 'success' ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
            <p className="text-muted-foreground">
              Your travel booking has been confirmed. Your agent will be in touch with next steps.
            </p>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {step === 'passengers' ? (
                  <><Users className="h-5 w-5" /> Traveler Details</>
                ) : (
                  <><CreditCard className="h-5 w-5" /> Payment</>
                )}
              </DialogTitle>
              {/* Step indicator */}
              <div className="flex gap-2 mt-2">
                <div className={`h-1 flex-1 rounded ${step === 'passengers' ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`h-1 flex-1 rounded ${step === 'payment' ? 'bg-primary' : 'bg-muted'}`} />
              </div>
            </DialogHeader>

            {step === 'passengers' && (
              <div className="space-y-4">
                {passengers.map((pax, idx) => (
                  <Card key={idx} className={idx === 0 ? 'border-primary/30' : ''}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {idx === 0 ? 'Primary Traveler' : `Traveler ${idx + 1}`}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {pax.type}
                        </Badge>
                        {idx === 0 && <span className="text-xs text-red-500">*Required</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Title</Label>
                          <Select
                            value={pax.title || undefined}
                            onValueChange={v => updatePassenger(idx, { title: v })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Title" /></SelectTrigger>
                            <SelectContent>
                              {['Mr', 'Mrs', 'Ms', 'Dr', 'Mstr'].map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">
                            First Name {idx === 0 && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            value={pax.first_name || ''}
                            onChange={e => updatePassenger(idx, { first_name: e.target.value })}
                            placeholder="First name"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Last Name</Label>
                          <Input
                            value={pax.last_name || ''}
                            onChange={e => updatePassenger(idx, { last_name: e.target.value })}
                            placeholder="Last name"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      {!skipDetails && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Date of Birth</Label>
                            <Input
                              type="date"
                              value={pax.dob || ''}
                              onChange={e => updatePassenger(idx, { dob: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Passport No.</Label>
                            <Input
                              value={pax.passport_number || ''}
                              onChange={e => updatePassenger(idx, { passport_number: e.target.value })}
                              placeholder="Optional"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Passport Expiry</Label>
                            <Input
                              type="date"
                              value={pax.passport_expiry || ''}
                              onChange={e => updatePassenger(idx, { passport_expiry: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Skip toggle */}
                <label className="flex items-center gap-2 cursor-pointer bg-muted/50 rounded-lg p-3">
                  <Checkbox
                    checked={skipDetails}
                    onCheckedChange={v => setSkipDetails(v === true)}
                  />
                  <div>
                    <span className="text-sm font-medium">Skip &amp; Provide Later</span>
                    <span className="block text-xs text-muted-foreground">
                      DOBs and passport details can be shared with your agent later
                    </span>
                  </div>
                </label>
              </div>
            )}

            {step === 'payment' && (
              <div className="space-y-4">
                {/* Amount */}
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Amount to Pay</p>
                    <p className="text-3xl font-bold mt-1">
                      {currency === 'INR' ? '₹' : currency}{' '}
                      {payAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    {fixedAmount && (
                      <Badge variant="outline" className="mt-1 text-xs">Partial Payment</Badge>
                    )}
                  </CardContent>
                </Card>

                {/* Online */}
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex items-center gap-3 justify-start"
                  onClick={handleOnlinePayment}
                  disabled={loading}
                >
                  <CreditCard className="h-5 w-5 text-blue-600 shrink-0" />
                  <div className="text-left">
                    <span className="font-medium block">Pay Online</span>
                    <span className="text-xs text-muted-foreground">Card, UPI, or Net Banking</span>
                  </div>
                  {loading && paymentMethod === 'online' && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
                </Button>

                {/* Offline */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-sm">Bank Transfer (Offline)</span>
                  </div>
                  <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
                    <p className="font-medium">Bank Details</p>
                    <p>Account details will be shared by your travel agent</p>
                    <p className="text-muted-foreground">Please share the UTR after transfer</p>
                  </div>
                  <div>
                    <Label className="text-xs">
                      Transaction Reference (UTR) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={utr}
                      onChange={e => setUtr(e.target.value)}
                      placeholder="Enter UTR or reference number"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Payment Screenshot (optional)</Label>
                    <div className="mt-1">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer border border-dashed rounded p-2 hover:bg-muted/50">
                        <Upload className="h-3.5 w-3.5" />
                        {screenshot ? screenshot.name : 'Upload screenshot'}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => setScreenshot(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => { setPaymentMethod('offline'); handleSubmit(); }}
                    disabled={loading || !utr.trim()}
                  >
                    {loading && paymentMethod === 'offline' && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Confirm Offline Payment
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="flex-row gap-2">
              {step === 'payment' && (
                <Button variant="outline" onClick={() => setStep('passengers')} disabled={loading}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              {step === 'passengers' && (
                <Button
                  className="ml-auto"
                  onClick={() => setStep('payment')}
                  disabled={!canProceedToPayment()}
                >
                  Continue to Payment <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
