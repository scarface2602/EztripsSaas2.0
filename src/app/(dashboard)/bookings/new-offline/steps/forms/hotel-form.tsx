'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface HotelFormProps {
  itemData: Record<string, unknown>;
  costPrice: number;
  sellPrice: number;
  notes: string;
  onItemDataChange: (data: Record<string, unknown>) => void;
  onCostPriceChange: (price: number) => void;
  onSellPriceChange: (price: number) => void;
  onNotesChange: (notes: string) => void;
}

export default function HotelForm({
  itemData,
  costPrice,
  sellPrice,
  notes,
  onItemDataChange,
  onCostPriceChange,
  onSellPriceChange,
  onNotesChange,
}: HotelFormProps) {
  const handleChange = (field: string, value: unknown) => {
    onItemDataChange({ ...itemData, [field]: value });
  };

  const handleOccupancyChange = (field: 'adults' | 'children', value: number) => {
    onItemDataChange({
      ...itemData,
      occupancy: {
        ...((itemData.occupancy as Record<string, number>) || {}),
        [field]: value,
      },
    });
  };

  const margin = sellPrice - costPrice;
  const marginPct = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Hotel Information */}
      <Card>
        <CardHeader>
          <CardTitle>Hotel Information</CardTitle>
          <CardDescription>Enter details about the hotel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hotel_name">Hotel Name *</Label>
              <Input
                id="hotel_name"
                placeholder="e.g., The Leela Palace"
                value={(itemData.hotel_name as string) || ''}
                onChange={(e) => handleChange('hotel_name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="e.g., Dubai"
                value={(itemData.city as string) || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room_type">Room Type *</Label>
              <Input
                id="room_type"
                placeholder="e.g., Deluxe Sea View"
                value={(itemData.room_type as string) || ''}
                onChange={(e) => handleChange('room_type', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_in">Check-in Date *</Label>
              <Input
                id="check_in"
                type="date"
                value={(itemData.check_in as string) || ''}
                onChange={(e) => handleChange('check_in', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_out">Check-out Date *</Label>
              <Input
                id="check_out"
                type="date"
                value={(itemData.check_out as string) || ''}
                onChange={(e) => handleChange('check_out', e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Occupancy */}
      <Card>
        <CardHeader>
          <CardTitle>Occupancy</CardTitle>
          <CardDescription>Number of guests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adults">Adults *</Label>
              <Input
                id="adults"
                type="number"
                min="1"
                value={((itemData.occupancy as Record<string, number>)?.adults || 1)}
                onChange={(e) => handleOccupancyChange('adults', parseInt(e.target.value) || 0)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="children">Children</Label>
              <Input
                id="children"
                type="number"
                min="0"
                value={((itemData.occupancy as Record<string, number>)?.children || 0)}
                onChange={(e) => handleOccupancyChange('children', parseInt(e.target.value) || 0)}
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
            placeholder="Any special requests, confirmation details, etc."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="min-h-24"
          />
        </CardContent>
      </Card>
    </div>
  );
}
