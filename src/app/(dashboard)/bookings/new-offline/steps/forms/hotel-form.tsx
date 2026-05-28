'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

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
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const supabase = useMemo(() => createClient(), []);

  // Fetch suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('type', 'hotel')
        .order('name');
      if (data) setSuppliers(data);
    };
    fetchSuppliers();
  }, [supabase]);

  const handleChange = (field: string, value: unknown) => {
    onItemDataChange({ ...itemData, [field]: value });
  };

  const handleOccupancyChange = (field: 'adults' | 'children', value: number) => {
    const newOccupancy = {
      ...((itemData.occupancy as Record<string, number>) || {}),
      [field]: value,
    };
    
    // Reset children_ages if children count changes
    if (field === 'children' && value === 0) {
      const { children_ages, ...rest } = itemData;
      onItemDataChange({ ...rest, occupancy: newOccupancy });
    } else {
      onItemDataChange({ ...itemData, occupancy: newOccupancy });
    }
  };

  const handleChildrenAgeChange = (index: number, age: number) => {
    const ages = ((itemData.children_ages as number[]) || []);
    const newAges = [...ages];
    newAges[index] = age;
    handleChange('children_ages', newAges);
  };

  const childrenCount = ((itemData.occupancy as Record<string, number>)?.children || 0);
  const childrenAges = ((itemData.children_ages as number[]) || []);

  const margin = sellPrice - costPrice;
  const marginPct = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Hotel Information */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Hotel Information</CardTitle>
          <CardDescription>Enter details about the hotel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hotel_name" className="dark:text-slate-200">Hotel Name *</Label>
              <Input
                id="hotel_name"
                placeholder="e.g., The Leela Palace"
                value={(itemData.hotel_name as string) || ''}
                onChange={(e) => handleChange('hotel_name', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className="dark:text-slate-200">City *</Label>
              <Input
                id="city"
                placeholder="e.g., Dubai"
                value={(itemData.city as string) || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room_type" className="dark:text-slate-200">Room Type *</Label>
              <Input
                id="room_type"
                placeholder="e.g., Deluxe Sea View"
                value={(itemData.room_type as string) || ''}
                onChange={(e) => handleChange('room_type', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_in" className="dark:text-slate-200">Check-in Date *</Label>
              <Input
                id="check_in"
                type="date"
                value={(itemData.check_in as string) || ''}
                onChange={(e) => handleChange('check_in', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_out" className="dark:text-slate-200">Check-out Date *</Label>
              <Input
                id="check_out"
                type="date"
                value={(itemData.check_out as string) || ''}
                onChange={(e) => handleChange('check_out', e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Occupancy */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Occupancy</CardTitle>
          <CardDescription>Number of guests and rooms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adults" className="dark:text-slate-200">Adults *</Label>
              <Input
                id="adults"
                type="number"
                min="1"
                value={((itemData.occupancy as Record<string, number>)?.adults || 1)}
                onChange={(e) => handleOccupancyChange('adults', parseInt(e.target.value) || 0)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="children" className="dark:text-slate-200">Children</Label>
              <Input
                id="children"
                type="number"
                min="0"
                value={childrenCount}
                onChange={(e) => handleOccupancyChange('children', parseInt(e.target.value) || 0)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra_beds" className="dark:text-slate-200">Extra Beds</Label>
              <Input
                id="extra_beds"
                type="number"
                min="0"
                value={((itemData.extra_beds as number) || 0)}
                onChange={(e) => handleChange('extra_beds', parseInt(e.target.value) || 0)}
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              />
            </div>
          </div>

          {/* Children Ages */}
          {childrenCount > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Label className="dark:text-slate-200">Children Ages *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: childrenCount }).map((_, idx) => (
                  <div key={idx} className="space-y-1">
                    <Label htmlFor={`child_age_${idx}`} className="text-sm dark:text-slate-300">Child {idx + 1} Age</Label>
                    <Input
                      id={`child_age_${idx}`}
                      type="number"
                      min="0"
                      max="18"
                      placeholder="Age"
                      value={childrenAges[idx] || ''}
                      onChange={(e) => handleChildrenAgeChange(idx, parseInt(e.target.value) || 0)}
                      className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Supplier</CardTitle>
          <CardDescription>Select supplier for internal tracking (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={((itemData.supplier_id as string) || '')}
            onValueChange={(value) => handleChange('supplier_id', value || null)}
          >
            <SelectTrigger className="dark:bg-slate-800 dark:border-slate-600 dark:text-white">
              <SelectValue placeholder="Select a supplier..." />
            </SelectTrigger>
            <SelectContent className="dark:bg-slate-800 dark:border-slate-600">
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id} className="dark:text-white">
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
