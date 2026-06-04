'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import StepItemTypeSelect from './steps/step-item-type-select';
import StepItemDetails from './steps/step-item-details';
import StepClientSelect from './steps/step-client-select';
import StepReview from './steps/step-review';

export default function NewOfflineBookingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [itemType, setItemType] = useState<'hotel' | 'flight' | 'vehicle' | null>(null);
  const [itemData, setItemData] = useState<Record<string, unknown>>({});
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const steps = ['Item Type', 'Details', 'Client', 'Review'];
  const progressValue = (currentStep / 4) * 100;


  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleCreateBooking = async () => {
    if (!itemType || !clientId || Object.keys(itemData).length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    const payload = {
      item_type: itemType,
      client_id: clientId,
      item_details: itemData,
      cost_price: costPrice,
      sell_price: sellPrice,
      notes: notes || undefined,
    };

    console.log('Creating booking with payload:', {
      ...payload,
      item_details: JSON.stringify(payload.item_details)
    });

    try {
      const res = await fetch('/api/bookings/offline/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        let errorMessage = error.error || 'Failed to create booking';

        // Show validation field errors if present
        if (error.fieldErrors) {
          const fieldErrors = Object.entries(error.fieldErrors)
            .map(([field, msgs]: [string, unknown]) => {
              const msgStr = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
              return `${field}: ${msgStr}`;
            })
            .join('; ');
          errorMessage = `${errorMessage} - ${fieldErrors}`;
        }

        if (error.formErrors && Array.isArray(error.formErrors)) {
          errorMessage += ` - ${error.formErrors.join('; ')}`;
        }

        if (error.details) {
          errorMessage += ` — ${error.details}`;
        }

        console.error('API Error Details:', { status: res.status, error, errorMessage });
        throw new Error(errorMessage);
      }

      const data = await res.json();
      toast.success('Offline booking created! Setting up payment schedule...');
      router.push(`/bookings/${data.booking_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Create Offline Booking</h1>
          <p className="text-muted-foreground">
            Create a booking directly without a proposal
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
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm mb-4">
              {steps.map((step, idx) => (
                <div
                  key={step}
                  className={`${
                    idx + 1 === currentStep ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {idx + 1}. {step}
                </div>
              ))}
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && (
            <StepItemTypeSelect
              selectedType={itemType}
              onSelect={(type) => {
                setItemType(type);
                setItemData({});
              }}
            />
          )}

          {currentStep === 2 && itemType && (
            <StepItemDetails
              itemType={itemType}
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

          {currentStep === 3 && (
            <StepClientSelect
              selectedClientId={clientId}
              selectedClientName={clientName}
              onClientSelect={(id, name) => {
                setClientId(id);
                setClientName(name);
              }}
            />
          )}

          {currentStep === 4 && (
            <StepReview
              itemType={itemType!}
              itemData={itemData}
              costPrice={costPrice}
              sellPrice={sellPrice}
              notes={notes}
              clientName={clientName}
              isLoading={isCreating}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePreviousStep}
          disabled={currentStep === 1 || isCreating}
        >
          Back
        </Button>

        {currentStep < 4 ? (
          <Button
            onClick={handleNextStep}
            disabled={
              (currentStep === 1 && !itemType) ||
              (currentStep === 2 && (Object.keys(itemData).length === 0 || !itemData.supplier_id)) ||
              (currentStep === 3 && !clientId) ||
              isCreating
            }
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleCreateBooking}
            disabled={!clientId || Object.keys(itemData).length === 0 || !itemData.supplier_id || isCreating}
            className="bg-green-600 hover:bg-green-700"
          >
            {isCreating ? 'Creating...' : 'Create Booking'}
          </Button>
        )}
      </div>
    </div>
  );
}
