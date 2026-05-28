'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const handleChange = (field: string, value: unknown) => {
    onItemDataChange({ ...itemData, [field]: value });
  };

  const margin = sellPrice - costPrice;
  const marginPct = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Flight Information */}
      <Card>
        <CardHeader>
          <CardTitle>Flight Information</CardTitle>
          <CardDescription>Enter flight and passenger details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="airline">Airline *</Label>
              <Input
                id="airline"
                placeholder="e.g., Emirates"
                value={(itemData.airline as string) || ''}
                onChange={(e) => handleChange('airline', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="flight_number">Flight Number *</Label>
              <Input
                id="flight_number"
                placeholder="e.g., EK501"
                value={(itemData.flight_number as string) || ''}
                onChange={(e) => handleChange('flight_number', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure_city">Departure City *</Label>
              <Input
                id="departure_city"
                placeholder="e.g., Mumbai"
                value={(itemData.departure_city as string) || ''}
                onChange={(e) => handleChange('departure_city', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure_iata">Departure IATA</Label>
              <Input
                id="departure_iata"
                placeholder="e.g., BOM"
                maxLength={3}
                value={(itemData.departure_iata as string) || ''}
                onChange={(e) => handleChange('departure_iata', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrival_city">Arrival City *</Label>
              <Input
                id="arrival_city"
                placeholder="e.g., Dubai"
                value={(itemData.arrival_city as string) || ''}
                onChange={(e) => handleChange('arrival_city', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrival_iata">Arrival IATA</Label>
              <Input
                id="arrival_iata"
                placeholder="e.g., DXB"
                maxLength={3}
                value={(itemData.arrival_iata as string) || ''}
                onChange={(e) => handleChange('arrival_iata', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passenger & Flight Details */}
      <Card>
        <CardHeader>
          <CardTitle>Passenger & Flight Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passenger_name">Passenger Name *</Label>
              <Input
                id="passenger_name"
                placeholder="Full name on ticket"
                value={(itemData.passenger_name as string) || ''}
                onChange={(e) => handleChange('passenger_name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cabin_class">Cabin Class</Label>
              <Select
                value={(itemData.cabin_class as string) || 'economy'}
                onValueChange={(value) => handleChange('cabin_class', value)}
              >
                <SelectTrigger id="cabin_class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="economy">Economy</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="first">First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure_datetime">Departure Date & Time *</Label>
              <Input
                id="departure_datetime"
                type="datetime-local"
                value={(itemData.departure_datetime as string) || ''}
                onChange={(e) => handleChange('departure_datetime', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrival_datetime">Arrival Date & Time *</Label>
              <Input
                id="arrival_datetime"
                type="datetime-local"
                value={(itemData.arrival_datetime as string) || ''}
                onChange={(e) => handleChange('arrival_datetime', e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Cost and selling prices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price (₹) *</Label>
              <Input
                id="cost_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={costPrice || ''}
                onChange={(e) => onCostPriceChange(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sell_price">Selling Price (₹) *</Label>
              <Input
                id="sell_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={sellPrice || ''}
                onChange={(e) => onSellPriceChange(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          {costPrice > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="space-y-1">
                <div>Margin: ₹{(margin).toLocaleString()} ({marginPct}%)</div>
                {margin < 0 && (
                  <div className="text-red-600">⚠ Selling price is less than cost price</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="PNR code, seat assignments, special requests, etc."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="min-h-24"
          />
        </CardContent>
      </Card>
    </div>
  );
}
