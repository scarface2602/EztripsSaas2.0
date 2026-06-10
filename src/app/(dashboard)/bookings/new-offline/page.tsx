'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Hotel, Plane, Truck, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ClientSelect } from '@/components/ui/inline-add-select';
import HotelForm from './steps/forms/hotel-form';
import FlightForm from './steps/forms/flight-form';
import VehicleForm from './steps/forms/vehicle-form';

type ItemType = 'hotel' | 'flight' | 'vehicle';
type PaymentMode = 'full' | 'split';

interface PaymentSchedule {
  mode: PaymentMode;
  deposit_amount: number;
  deposit_due_date: string;
  balance_amount: number;
  balance_due_date: string;
}

export default function NewOfflineBookingPage() {
  const router = useRouter();

  // Step 1 state: Core Meta
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [itemType, setItemType] = useState<ItemType | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Step 2 state: Item Details
  const [itemData, setItemData] = useState<Record<string, unknown>>({});
  const [costPrice, setCostPrice] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [notes, setNotes] = useState('');

  // Payment scheduler state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositDueDate, setDepositDueDate] = useState('');
  const [balanceDueDate, setBalanceDueDate] = useState('');

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch('/api/clients');
        if (!res.ok) throw new Error('Failed to load clients');
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } catch {
        toast.error('Failed to load clients');
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  // Auto-calculate payment defaults when cost price changes
  useEffect(() => {
    if (costPrice > 0) {
      const defaultDeposit = Math.round(costPrice * 0.3);
      setDepositAmount(defaultDeposit);

      // Default deposit due: today
      const today = new Date().toISOString().split('T')[0];
      setDepositDueDate(today);

      // Default balance due: 7 days before travel date
      const travelDate = getTravelDate();
      if (travelDate) {
        const balDate = new Date(travelDate);
        balDate.setDate(balDate.getDate() - 7);
        setBalanceDueDate(balDate.toISOString().split('T')[0]);
      } else {
        // Fallback: 30 days from now
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 30);
        setBalanceDueDate(fallback.toISOString().split('T')[0]);
      }
    }
  }, [costPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const getTravelDate = (): string | null => {
    return (itemData.check_in as string) ||
      (itemData.departure_datetime as string)?.split('T')[0] ||
      (itemData.pickup_datetime as string)?.split('T')[0] ||
      null;
  };

  const balanceAmount = costPrice - depositAmount;

  const buildPaymentSchedule = (): PaymentSchedule => {
    const today = new Date().toISOString().split('T')[0];
    if (paymentMode === 'full') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      return {
        mode: 'full',
        deposit_amount: costPrice,
        deposit_due_date: dueDate.toISOString().split('T')[0],
        balance_amount: 0,
        balance_due_date: today,
      };
    }
    return {
      mode: 'split',
      deposit_amount: depositAmount,
      deposit_due_date: depositDueDate || today,
      balance_amount: balanceAmount,
      balance_due_date: balanceDueDate || today,
    };
  };

  const canProceedStep1 = clientId && itemType;
  const canSubmit = clientId && itemType && Object.keys(itemData).length > 0 && itemData.supplier_id && costPrice > 0;

  const handleCreateBooking = async () => {
    if (!canSubmit) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    const paymentSchedule = buildPaymentSchedule();

    const payload = {
      item_type: itemType,
      client_id: clientId,
      item_details: itemData,
      cost_price: costPrice,
      sell_price: sellPrice,
      notes: notes || undefined,
      payment_schedule: paymentSchedule,
    };

    try {
      const res = await fetch('/api/bookings/offline/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        let errorMessage = error.error || 'Failed to create booking';
        if (error.fieldErrors) {
          const fieldErrors = Object.entries(error.fieldErrors)
            .map(([field, msgs]: [string, unknown]) => {
              const msgStr = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
              return `${field}: ${msgStr}`;
            })
            .join('; ');
          errorMessage = `${errorMessage} - ${fieldErrors}`;
        }
        if (error.details) errorMessage += ` — ${error.details}`;
        throw new Error(errorMessage);
      }

      const data = await res.json();
      toast.success(`Booking created! Trip ID: ${data.trip_id}`);
      router.push(`/bookings/${data.booking_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking');
    } finally {
      setIsCreating(false);
    }
  };

  const typeOptions = [
    { value: 'hotel' as ItemType, label: 'Hotel', icon: Hotel, desc: 'Room booking' },
    { value: 'flight' as ItemType, label: 'Flight', icon: Plane, desc: 'Air ticket' },
    { value: 'vehicle' as ItemType, label: 'Vehicle', icon: Truck, desc: 'Car / transfer' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Create Offline Booking</h1>
          <p className="text-muted-foreground">
            Quick standalone booking — no proposal needed
          </p>
        </div>
        <Link
          href="/bookings"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bookings
        </Link>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        <div className={`flex-1 h-1.5 rounded-full ${currentStep >= 1 ? 'bg-blue-600' : 'bg-muted'}`} />
        <div className={`flex-1 h-1.5 rounded-full ${currentStep >= 2 ? 'bg-blue-600' : 'bg-muted'}`} />
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span className={currentStep === 1 ? 'font-semibold text-foreground' : ''}>1. Client & Service Type</span>
        <span className={currentStep === 2 ? 'font-semibold text-foreground' : ''}>2. Details & Payment</span>
      </div>

      {/* ─── STEP 1: Client + Type ─── */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Client Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
              <CardDescription>Select or create a client</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading clients...
                </div>
              ) : (
                <ClientSelect
                  clients={clients}
                  value={clientId || ''}
                  onChange={(id) => {
                    const client = clients.find((c) => c.id === id);
                    if (client) {
                      setClientId(client.id);
                      setClientName(client.full_name);
                    }
                  }}
                  onClientAdded={(client) => {
                    setClients([...clients, client]);
                    setClientId(client.id);
                    setClientName(client.full_name);
                    toast.success(`Client ${client.full_name} created`);
                  }}
                />
              )}
              {clientName && (
                <p className="mt-2 text-sm text-green-600 font-medium">
                  Selected: {clientName}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Service Type */}
          <Card>
            <CardHeader>
              <CardTitle>Service Type</CardTitle>
              <CardDescription>What are you booking?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {typeOptions.map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setItemType(value);
                      setItemData({});
                      setCostPrice(0);
                      setSellPrice(0);
                      setNotes('');
                    }}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      itemType === value
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                        : 'border-muted hover:border-blue-300'
                    }`}
                  >
                    <Icon className={`h-8 w-8 mx-auto mb-2 ${itemType === value ? 'text-blue-600' : 'text-muted-foreground'}`} />
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── STEP 2: Scoped Form + Payment Scheduler ─── */}
      {currentStep === 2 && itemType && (
        <div className="space-y-6">
          {/* Scoped detail form */}
          {itemType === 'hotel' && (
            <HotelForm
              itemData={itemData}
              costPrice={costPrice}
              sellPrice={sellPrice}
              notes={notes}
              onItemDataChange={setItemData}
              onCostPriceChange={setCostPrice}
              onSellPriceChange={setSellPrice}
              onNotesChange={setNotes}
            />
          )}
          {itemType === 'flight' && (
            <FlightForm
              itemData={itemData}
              costPrice={costPrice}
              sellPrice={sellPrice}
              notes={notes}
              onItemDataChange={setItemData}
              onCostPriceChange={setCostPrice}
              onSellPriceChange={setSellPrice}
              onNotesChange={setNotes}
            />
          )}
          {itemType === 'vehicle' && (
            <VehicleForm
              itemData={itemData}
              costPrice={costPrice}
              sellPrice={sellPrice}
              notes={notes}
              onItemDataChange={setItemData}
              onCostPriceChange={setCostPrice}
              onSellPriceChange={setSellPrice}
              onNotesChange={setNotes}
            />
          )}

          {/* ─── Payment Scheduler ─── */}
          {costPrice > 0 && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle>Supplier Payment Schedule</CardTitle>
                <CardDescription>
                  How will the supplier be paid? (Cost Price: ₹{costPrice.toLocaleString()})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={paymentMode === 'full' ? 'default' : 'outline'}
                    onClick={() => setPaymentMode('full')}
                    className="flex-1"
                  >
                    Full Payment
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMode === 'split' ? 'default' : 'outline'}
                    onClick={() => setPaymentMode('split')}
                    className="flex-1"
                  >
                    Split Payment (Advance + Final)
                  </Button>
                </div>

                {paymentMode === 'full' && (
                  <div className="p-4 bg-muted rounded-lg text-sm space-y-1">
                    <div className="font-medium">Single payment of ₹{costPrice.toLocaleString()}</div>
                    <div className="text-muted-foreground">Due in 3 days from today</div>
                  </div>
                )}

                {paymentMode === 'split' && (
                  <div className="space-y-4">
                    {/* Deposit */}
                    <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                      <div className="font-medium text-sm text-green-800 dark:text-green-200">Advance / Deposit</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Amount (₹)</Label>
                          <Input
                            type="number"
                            min="0"
                            max={costPrice}
                            value={depositAmount || ''}
                            onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Due Date</Label>
                          <Input
                            type="date"
                            value={depositDueDate}
                            onChange={(e) => setDepositDueDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg space-y-3">
                      <div className="font-medium text-sm text-orange-800 dark:text-orange-200">Balance Payment</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Amount (₹)</Label>
                          <Input
                            type="number"
                            value={balanceAmount}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Due Date</Label>
                          <Input
                            type="date"
                            value={balanceDueDate}
                            onChange={(e) => setBalanceDueDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {balanceAmount < 0 && (
                      <p className="text-sm text-red-600">Deposit exceeds cost price</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        {currentStep === 1 ? (
          <>
            <div />
            <Button
              onClick={() => setCurrentStep(2)}
              disabled={!canProceedStep1}
            >
              Next: Enter Details
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setCurrentStep(1)} disabled={isCreating}>
              Back
            </Button>
            <Button
              onClick={handleCreateBooking}
              disabled={!canSubmit || isCreating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreating ? 'Creating...' : 'Create Booking'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
