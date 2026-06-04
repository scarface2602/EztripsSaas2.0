'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { PaymentScheduleEditor } from './payment-schedule-editor';
import type { PaymentAccount, PaymentSchedulePayment } from '@/lib/types/database';

interface PaymentScheduleSetupProps {
  bookingId: string;
  bookingTotal: number;
  paymentAccounts: PaymentAccount[];
  /** If provided, adds payments to existing package instead of creating new one */
  existingPackageId?: string;
  onSuccess: () => void;
}

export function PaymentScheduleSetup({
  bookingId,
  bookingTotal,
  paymentAccounts,
  existingPackageId,
  onSuccess,
}: PaymentScheduleSetupProps) {
  const [step, setStep] = useState<'type-selection' | 'schedule-setup'>('type-selection');
  const [paymentType, setPaymentType] = useState<'full_payment' | 'hold_payment' | 'custom'>('full_payment');
  const [schedulePayments, setSchedulePayments] = useState<PaymentSchedulePayment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Initialize payments based on selected type
  const initializePayments = (type: 'full_payment' | 'hold_payment' | 'custom') => {
    const today = new Date();
    let payments: PaymentSchedulePayment[] = [];

    switch (type) {
      case 'full_payment':
        payments = [
          {
            sequence: 1,
            amount: bookingTotal,
            due_date: format(addDays(today, 3), 'yyyy-MM-dd'),
          },
        ];
        break;

      case 'hold_payment': {
        const advanceAmount = Math.round(bookingTotal * 0.3);
        const remainingAmount = bookingTotal - advanceAmount;
        payments = [
          {
            sequence: 1,
            amount: advanceAmount,
            due_date: format(today, 'yyyy-MM-dd'),
            reference_number: 'Advance',
          },
          {
            sequence: 2,
            amount: remainingAmount,
            due_date: format(addDays(today, 3), 'yyyy-MM-dd'),
            reference_number: 'Final',
          },
        ];
        break;
      }

      case 'custom':
        payments = [
          {
            sequence: 1,
            amount: bookingTotal,
            due_date: format(addDays(today, 3), 'yyyy-MM-dd'),
          },
        ];
        break;
    }

    setSchedulePayments(payments);
  };

  const handlePaymentTypeChange = (type: 'full_payment' | 'hold_payment' | 'custom') => {
    setPaymentType(type);
    initializePayments(type);
  };

  const handleCreateSchedule = async () => {
    if (schedulePayments.length === 0) {
      toast.error('Please add at least one payment installment');
      return;
    }

    const totalScheduled = schedulePayments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalScheduled - bookingTotal) > 0.01) {
      toast.error(`Payment total must equal booking amount. Scheduled: ₹${totalScheduled.toLocaleString()}, Required: ₹${bookingTotal.toLocaleString()}`);
      return;
    }

    setIsSaving(true);
    try {
      let res: Response;

      if (existingPackageId) {
        // Add payments to existing package
        res = await fetch(`/api/booking-packages/${existingPackageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payments: schedulePayments,
            total_cost: totalScheduled,
          }),
        });
      } else {
        // Create new package with payments
        res = await fetch(`/api/bookings/${bookingId}/packages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'individual',
            supplier_id: null,
            payments: schedulePayments,
          }),
        });
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error + (error.details ? `: ${error.details}` : '') || 'Failed to create payment schedule');
      }

      toast.success('Payment schedule created successfully');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create payment schedule');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 'type-selection') {
    return (
      <Card className="border-blue-200 bg-blue-50 dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg">Set Up Payment Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select how you want to structure the payment for this booking
            </p>

            <RadioGroup value={paymentType} onValueChange={(v) => handlePaymentTypeChange(v as 'full_payment' | 'hold_payment' | 'custom')}>
              {/* Full Payment */}
              <div className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-white/50 dark:hover:bg-slate-800/50 transition dark:border-slate-600"
                onClick={() => handlePaymentTypeChange('full_payment')}>
                <RadioGroupItem value="full_payment" className="mt-1" />
                <div className="flex-1">
                  <Label className="font-semibold cursor-pointer">Full Payment</Label>
                  <p className="text-xs text-muted-foreground">
                    Complete amount due on a single date (typical for near-date bookings)
                  </p>
                  <p className="text-xs font-medium text-foreground mt-1">
                    ₹{bookingTotal.toLocaleString()} due in 3 days
                  </p>
                </div>
              </div>

              {/* Hold Payment */}
              <div className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-white/50 dark:hover:bg-slate-800/50 transition dark:border-slate-600"
                onClick={() => handlePaymentTypeChange('hold_payment')}>
                <RadioGroupItem value="hold_payment" className="mt-1" />
                <div className="flex-1">
                  <Label className="font-semibold cursor-pointer">Hold Payment (Advance + Final)</Label>
                  <p className="text-xs text-muted-foreground">
                    30% advance + remaining amount on confirmation (typical for hotel blocks)
                  </p>
                  <p className="text-xs font-medium text-foreground mt-1">
                    ₹{Math.round(bookingTotal * 0.3).toLocaleString()} now + ₹{Math.round(bookingTotal * 0.7).toLocaleString()} later
                  </p>
                </div>
              </div>

              {/* Custom */}
              <div className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-white/50 dark:hover:bg-slate-800/50 transition dark:border-slate-600"
                onClick={() => handlePaymentTypeChange('custom')}>
                <RadioGroupItem value="custom" className="mt-1" />
                <div className="flex-1">
                  <Label className="font-semibold cursor-pointer">Custom Payment Plan</Label>
                  <p className="text-xs text-muted-foreground">
                    Create your own payment schedule with multiple installments
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Details Preview */}
          <div className="border-t dark:border-slate-700 pt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showDetails ? 'Hide' : 'Show'} Details
            </button>

            {showDetails && (
              <div className="mt-3 space-y-2 text-sm">
                {schedulePayments.map((p) => (
                  <div key={p.sequence} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded">
                    <span className="font-medium">Installment #{p.sequence}</span>
                    <div className="text-right">
                      <span className="font-bold">₹{p.amount.toLocaleString()}</span>
                      <p className="text-xs text-muted-foreground">Due: {format(new Date(p.due_date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setStep('schedule-setup')}
              className="flex-1"
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Review Payment Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaymentScheduleEditor
            packageTotal={bookingTotal}
            initialPayments={schedulePayments}
            paymentAccounts={paymentAccounts}
            onPaymentsChange={setSchedulePayments}
            showTemplates={false}
            templateMode="none"
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setStep('type-selection')}
          className="flex-1"
          disabled={isSaving}
        >
          Back
        </Button>
        <Button
          onClick={handleCreateSchedule}
          disabled={isSaving}
          className="flex-1"
        >
          {isSaving ? 'Creating...' : 'Create Payment Schedule'}
        </Button>
      </div>
    </div>
  );
}
