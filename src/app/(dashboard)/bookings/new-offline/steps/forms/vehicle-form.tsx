'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierSelect } from '@/components/ui/inline-add-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';

interface VehicleFormProps {
  itemData: Record<string, unknown>;
  costPrice: number;
  sellPrice: number;
  notes: string;
  onItemDataChange: (data: Record<string, unknown>) => void;
  onCostPriceChange: (price: number) => void;
  onSellPriceChange: (price: number) => void;
  onNotesChange: (notes: string) => void;
}

export default function VehicleForm({
  itemData,
  costPrice,
  sellPrice,
  notes,
  onItemDataChange,
  onCostPriceChange,
  onSellPriceChange,
  onNotesChange,
}: VehicleFormProps) {  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const supabase = useMemo(() => createClient(), []);

  // Fetch suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('type', 'vehicle')
        .order('name');
      if (data) setSuppliers(data);
    };
    fetchSuppliers();
  }, [supabase]);

  
  const [assignDriverNow, setAssignDriverNow] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);

  const handleChange = (field: string, value: unknown) => {
    onItemDataChange({ ...itemData, [field]: value });
  };

  const margin = sellPrice - costPrice;
  const marginPct = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : '0';

  const addItineraryDay = () => {
    const current = (itemData.itinerary as Array<Record<string, string>>) || [];
    current.push({ date: '', time: '09:00', location: '', notes: '' });
    onItemDataChange({ ...itemData, itinerary: current });
  };

  const updateItineraryDay = (idx: number, field: string, value: string) => {
    const current = (itemData.itinerary as Array<Record<string, string>>) || [];
    current[idx] = { ...current[idx], [field]: value };
    onItemDataChange({ ...itemData, itinerary: current });
  };

  const removeItineraryDay = (idx: number) => {
    const current = (itemData.itinerary as Array<Record<string, string>>) || [];
    current.splice(idx, 1);
    onItemDataChange({ ...itemData, itinerary: current });
  };

  return (
    <div className="space-y-6">
      {/* Vehicle Information */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Vehicle Information</CardTitle>
          <CardDescription>Enter vehicle rental details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_type" className="dark:text-slate-200">Vehicle Type *</Label>
              <Select
                value={(itemData.vehicle_type as string) || ''}
                onValueChange={(value) => handleChange('vehicle_type', value)}
              >
                <SelectTrigger id="vehicle_type">
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-600">
                <SelectItem key="hatchback" value="hatchback" className="dark:text-white">Hatchback</SelectItem>
                <SelectItem key="sedan" value="sedan" className="dark:text-white">Sedan</SelectItem>
                <SelectItem key="premium_sedan" value="premium_sedan" className="dark:text-white">Premium Sedan</SelectItem>
                <SelectItem key="muv" value="muv" className="dark:text-white">MUV</SelectItem>
                <SelectItem key="premium_muv" value="premium_muv" className="dark:text-white">Premium MUV</SelectItem>
                <SelectItem key="suv" value="suv" className="dark:text-white">SUV</SelectItem>
                <SelectItem key="van" value="van" className="dark:text-white">Van</SelectItem>
                <SelectItem key="luxury_van" value="luxury_van" className="dark:text-white">Luxury Van</SelectItem>
                <SelectItem key="coach" value="coach" className="dark:text-white">Coach</SelectItem>
                <SelectItem key="luxury_coach" value="luxury_coach" className="dark:text-white">Luxury Coach</SelectItem>
              </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle_brand" className="dark:text-slate-200">Vehicle Brand (Optional)</Label>
              <Input
                id="vehicle_brand"
                placeholder="e.g., Toyota Camry"
                value={(itemData.vehicle_brand as string) || ''}
                onChange={(e) => handleChange('vehicle_brand', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup_location" className="dark:text-slate-200">Pickup Location *</Label>
              <Input
                id="pickup_location"
                placeholder="e.g., Dubai Airport"
                value={(itemData.pickup_location as string) || ''}
                onChange={(e) => handleChange('pickup_location', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dropoff_location" className="dark:text-slate-200">Drop-off Location *</Label>
              <Input
                id="dropoff_location"
                placeholder="e.g., Dubai City Center"
                value={(itemData.dropoff_location as string) || ''}
                onChange={(e) => handleChange('dropoff_location', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup_datetime" className="dark:text-slate-200">Pickup Date & Time *</Label>
              <Input
                id="pickup_datetime"
                type="datetime-local"
                value={(itemData.pickup_datetime as string) || ''}
                onChange={(e) => handleChange('pickup_datetime', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dropoff_datetime" className="dark:text-slate-200">Drop-off Date & Time *</Label>
              <Input
                id="dropoff_datetime"
                type="datetime-local"
                value={(itemData.dropoff_datetime as string) || ''}
                onChange={(e) => handleChange('dropoff_datetime', e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Mode */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Availability Mode</CardTitle>
          <CardDescription>How will the vehicle be available?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-muted">
              <input
                type="radio"
                name="availability_type"
                value="point_to_point"
                checked={(itemData.availability_type as string) === 'point_to_point'}
                onChange={(e) => {
                  handleChange('availability_type', e.target.value);
                  handleChange('daily_start_time', null);
                  handleChange('daily_end_time', null);
                }}
                className="h-4 w-4"
              />
              <div>
                <div className="font-medium">Point-to-Point</div>
                <div className="text-sm text-muted-foreground">Single journey from pickup to drop location</div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-muted">
              <input
                type="radio"
                name="availability_type"
                value="at_disposal"
                checked={(itemData.availability_type as string) === 'at_disposal'}
                onChange={(e) => handleChange('availability_type', e.target.value)}
                className="h-4 w-4"
              />
              <div>
                <div className="font-medium">At Disposal</div>
                <div className="text-sm text-muted-foreground">Vehicle available for entire duration with daily hours</div>
              </div>
            </label>
          </div>

          {(itemData.availability_type as string) === 'at_disposal' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="daily_start_time" className="dark:text-slate-200">Daily Start Time</Label>
                <Input
                  id="daily_start_time"
                  type="time"
                  value={(itemData.daily_start_time as string) || '09:00'}
                  onChange={(e) => handleChange('daily_start_time', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="daily_end_time" className="dark:text-slate-200">Daily End Time</Label>
                <Input
                  id="daily_end_time"
                  type="time"
                  value={(itemData.daily_end_time as string) || '22:00'}
                  onChange={(e) => handleChange('daily_end_time', e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Assignment */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Driver Assignment</CardTitle>
          <CardDescription>Assign driver now or add later</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="assign_driver"
              checked={assignDriverNow}
              onCheckedChange={(checked) => setAssignDriverNow(checked as boolean)}
            />
            <Label htmlFor="assign_driver" className="text-sm">
              Assign driver now
            </Label>
          </div>

          {assignDriverNow ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="driver_name" className="dark:text-slate-200">Driver Name</Label>
                <Input
                  id="driver_name"
                  placeholder="Full name"
                  value={(itemData.driver_name as string) || ''}
                  onChange={(e) => handleChange('driver_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver_license" className="dark:text-slate-200">License Number</Label>
                <Input
                  id="driver_license"
                  placeholder="License #"
                  value={(itemData.driver_license as string) || ''}
                  onChange={(e) => handleChange('driver_license', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver_license_valid_until" className="dark:text-slate-200">License Valid Until</Label>
                <Input
                  id="driver_license_valid_until"
                  type="date"
                  value={(itemData.driver_license_valid_until as string) || ''}
                  onChange={(e) => handleChange('driver_license_valid_until', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver_insurance_type" className="dark:text-slate-200">Insurance Type</Label>
                <Select
                  value={(itemData.driver_insurance_type as string) || 'basic'}
                  onValueChange={(value) => handleChange('driver_insurance_type', value)}
                >
                  <SelectTrigger id="driver_insurance_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-600">
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium (Damage Covered)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900">
              Driver will be assigned after booking is created. You can add driver details anytime.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Itinerary (Optional) */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Itinerary (Optional)</CardTitle>
          <CardDescription>Add daily schedule for the trip</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show_itinerary"
              checked={showItinerary}
              onCheckedChange={(checked) => setShowItinerary(checked as boolean)}
            />
            <Label htmlFor="show_itinerary" className="text-sm">
              Add itinerary
            </Label>
          </div>

          {showItinerary && (
            <div className="space-y-3">
              {((itemData.itinerary as Array<Record<string, string>>) || []).map((day, idx) => (
                <div key={idx} className="p-3 bg-muted rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={day.date || ''}
                        onChange={(e) => updateItineraryDay(idx, 'date', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        value={day.time || '09:00'}
                        onChange={(e) => updateItineraryDay(idx, 'time', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Location/Activity</Label>
                      <Input
                        placeholder="Location or activity name"
                        value={day.location || ''}
                        onChange={(e) => updateItineraryDay(idx, 'location', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      placeholder="Any special notes for this day"
                      value={day.notes || ''}
                      onChange={(e) => updateItineraryDay(idx, 'notes', e.target.value)}
                      className="min-h-16 text-xs"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeItineraryDay(idx)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addItineraryDay}>
                <Plus className="h-4 w-4 mr-1" />
                Add Day
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Supplier */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Supplier</CardTitle>
          <CardDescription>Select or create supplier for payment tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierSelect
            type="vehicle"
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
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Confirmation details, special requests, parking info, etc."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="min-h-24"
          />
        </CardContent>
      </Card>
    </div>
  );
}
