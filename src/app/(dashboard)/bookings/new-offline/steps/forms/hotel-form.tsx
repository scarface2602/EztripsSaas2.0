'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SupplierSelect } from '@/components/ui/inline-add-select';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface RoomOccupancy {
  id: string;
  adults: number;
  children: number;
  extraBeds: number;
}

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

  const makeRoom = (): RoomOccupancy => ({
    id: crypto.randomUUID(),
    adults: 1,
    children: 0,
    extraBeds: 0,
  });

  // Initialize rooms array on mount
  useEffect(() => {
    if (!itemData.rooms) {
      onItemDataChange({
        ...itemData,
        rooms: [makeRoom()],
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const rooms = (itemData.rooms as RoomOccupancy[]) || [];

  const handleChange = (field: string, value: unknown) => {
    onItemDataChange({ ...itemData, [field]: value });
  };

  const updateRoom = (roomId: string, field: keyof Omit<RoomOccupancy, 'id'>, value: number) => {
    const updated = rooms.map((r) =>
      r.id === roomId ? { ...r, [field]: value } : r
    );
    onItemDataChange({ ...itemData, rooms: updated });
  };

  const addRoom = () => {
    onItemDataChange({ ...itemData, rooms: [...rooms, makeRoom()] });
  };

  const removeRoom = (roomId: string) => {
    onItemDataChange({ ...itemData, rooms: rooms.filter((r) => r.id !== roomId) });
  };

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
          <CardDescription>Configure guests per room</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rooms.map((room, idx) => (
            <div
              key={room.id}
              className="p-4 border rounded-lg space-y-3 dark:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm dark:text-slate-200">Room {idx + 1}</span>
                {rooms.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                    onClick={() => removeRoom(room.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Adults *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={room.adults}
                    onChange={(e) => updateRoom(room.id, 'adults', parseInt(e.target.value) || 1)}
                    className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Children</Label>
                  <Input
                    type="number"
                    min="0"
                    value={room.children}
                    onChange={(e) => updateRoom(room.id, 'children', parseInt(e.target.value) || 0)}
                    className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Extra Beds</Label>
                  <Input
                    type="number"
                    min="0"
                    value={room.extraBeds}
                    onChange={(e) => updateRoom(room.id, 'extraBeds', parseInt(e.target.value) || 0)}
                    className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRoom}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Room
          </Button>
        </CardContent>
      </Card>

      {/* Supplier */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Supplier</CardTitle>
          <CardDescription>Select supplier for internal tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierSelect
            type="hotel"
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
