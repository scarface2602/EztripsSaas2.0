'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SupplierSelect } from '@/components/ui/inline-add-select';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface FlightFormProps {
  itemData: Record<string, unknown>;
  costPrice: number;
  sellPrice: number;
  notes: string;
  onItemDataChange: (data: Record<string, unknown>) => void;
  onCostPriceChange: (price: number) => void;
  onSellPriceChange: (price: number) => void;
  onNotesChange: (notes: string) => void;
}

export default function FlightForm({
  itemData,
  costPrice,
  sellPrice,
  notes,
  onItemDataChange,
  onCostPriceChange,
  onSellPriceChange,
  onNotesChange,
}: FlightFormProps) {
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const supabase = useMemo(() => createClient(), []);

  // Fetch suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('type', 'flight')
        .order('name');
      if (data) setSuppliers(data);
    };
    fetchSuppliers();
  }, [supabase]);

  const handleChange = (field: string, value: unknown) => {
    onItemDataChange({ ...itemData, [field]: value });
  };

  const margin = sellPrice - costPrice;
  const marginPct = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Flight Information */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Flight Information</CardTitle>
          <CardDescription>Enter flight and passenger details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="airline" className="dark:text-slate-200">Airline *</Label>
              <Input
                id="airline"
                placeholder="e.g., Air India"
                value={(itemData.airline as string) || ''}
                onChange={(e) => handleChange('airline', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="flight_number" className="dark:text-slate-200">Flight Number *</Label>
              <Input
                id="flight_number"
                placeholder="e.g., AI-101"
                value={(itemData.flight_number as string) || ''}
                onChange={(e) => handleChange('flight_number', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure_city" className="dark:text-slate-200">Departure City *</Label>
              <Input
                id="departure_city"
                placeholder="e.g., New York"
                value={(itemData.departure_city as string) || ''}
                onChange={(e) => handleChange('departure_city', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure_iata" className="dark:text-slate-200">Departure IATA</Label>
              <Input
                id="departure_iata"
                placeholder="e.g., JFK"
                maxLength={3}
                value={(itemData.departure_iata as string) || ''}
                onChange={(e) => handleChange('departure_iata', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrival_city" className="dark:text-slate-200">Arrival City *</Label>
              <Input
                id="arrival_city"
                placeholder="e.g., London"
                value={(itemData.arrival_city as string) || ''}
                onChange={(e) => handleChange('arrival_city', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrival_iata" className="dark:text-slate-200">Arrival IATA</Label>
              <Input
                id="arrival_iata"
                placeholder="e.g., LHR"
                maxLength={3}
                value={(itemData.arrival_iata as string) || ''}
                onChange={(e) => handleChange('arrival_iata', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passenger & Departure Details */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Passenger & Travel Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passenger_name" className="dark:text-slate-200">Passenger Name *</Label>
              <Input
                id="passenger_name"
                placeholder="Full name"
                value={(itemData.passenger_name as string) || ''}
                onChange={(e) => handleChange('passenger_name', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cabin_class" className="dark:text-slate-200">Cabin Class</Label>
              <Select value={((itemData.cabin_class as string) || '')} onValueChange={(value) => handleChange('cabin_class', value)}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                  <SelectValue placeholder="Select cabin class..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-600">
                  <SelectItem value="economy" className="dark:text-white">Economy</SelectItem>
                  <SelectItem value="business" className="dark:text-white">Business</SelectItem>
                  <SelectItem value="first" className="dark:text-white">First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure_datetime" className="dark:text-slate-200">Departure *</Label>
              <Input
                id="departure_datetime"
                type="datetime-local"
                value={(itemData.departure_datetime as string) || ''}
                onChange={(e) => handleChange('departure_datetime', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrival_datetime" className="dark:text-slate-200">Arrival *</Label>
              <Input
                id="arrival_datetime"
                type="datetime-local"
                value={(itemData.arrival_datetime as string) || ''}
                onChange={(e) => handleChange('arrival_datetime', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Supplier</CardTitle>
          <CardDescription>Select supplier for internal tracking (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierSelect
            type="flight"
            suppliers={suppliers}
            value={((itemData.supplier_id as string) || '')}
            onChange={(id) => handleChange('supplier_id', id)}
            onSupplierAdded={(supplier) => {
              setSuppliers([...suppliers, supplier]);
              handleChange('supplier_id', supplier.id);
              toast.success(`Supplier ${supplier.name} added`);
            }}
            className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
          />
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Cost and selling prices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price" className="dark:text-slate-200">Cost Price (₹) *</Label>
              <Input
                id="cost_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={costPrice || ''}
                onChange={(e) => onCostPriceChange(parseFloat(e.target.value) || 0)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sell_price" className="dark:text-slate-200">Selling Price (₹) *</Label>
              <Input
                id="sell_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={sellPrice || ''}
                onChange={(e) => onSellPriceChange(parseFloat(e.target.value) || 0)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>
          </div>

          {costPrice > 0 && (
            <div className={`p-3 rounded-lg text-sm ${margin < 0 ? 'bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800' : 'bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800'}`}>
              <div className="space-y-1">
                <div className={margin < 0 ? 'text-red-900 dark:text-red-200' : 'text-blue-900 dark:text-blue-200'}>
                  Margin: ₹{(margin).toLocaleString()} ({marginPct}%)
                </div>
                {margin < 0 && (
                  <div className="text-red-600 dark:text-red-300">⚠ Selling price is less than cost price</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Any special requests, confirmation details, etc."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="min-h-24 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
          />
        </CardContent>
      </Card>
    </div>
  );
}
