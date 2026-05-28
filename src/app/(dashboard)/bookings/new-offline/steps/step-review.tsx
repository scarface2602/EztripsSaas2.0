'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Hotel, Plane, Truck } from 'lucide-react';

interface StepReviewProps {
  itemType: 'hotel' | 'flight' | 'vehicle';
  itemData: Record<string, unknown>;
  costPrice: number;
  sellPrice: number;
  notes: string;
  clientName: string;
  isLoading: boolean;
}

export default function StepReview({
  itemType,
  itemData,
  costPrice,
  sellPrice,
  notes,
  clientName,
}: StepReviewProps) {
  const margin = sellPrice - costPrice;
  const marginPct = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : '0';

  const typeIcon = {
    hotel: <Hotel className="h-5 w-5" />,
    flight: <Plane className="h-5 w-5" />,
    vehicle: <Truck className="h-5 w-5" />,
  };

  const typeLabel = {
    hotel: 'Hotel Booking',
    flight: 'Flight Booking',
    vehicle: 'Vehicle Booking',
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Review Booking Details</h2>
        <p className="text-sm text-muted-foreground">
          Verify all information before creating the booking
        </p>
      </div>

      {/* Item Type & Client */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {typeIcon[itemType]}
            {typeLabel[itemType]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client:</span>
              <span className="font-medium">{clientName}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Item Details */}
      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {itemType === 'hotel' && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hotel:</span>
                  <span className="font-medium">{itemData.hotel_name as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">City:</span>
                  <span className="font-medium">{itemData.city as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room Type:</span>
                  <span className="font-medium">{itemData.room_type as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in:</span>
                  <span className="font-medium">{itemData.check_in as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out:</span>
                  <span className="font-medium">{itemData.check_out as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guests:</span>
                  <span className="font-medium">
                    {(itemData.occupancy as Record<string, number>)?.adults || 0} Adults,{' '}
                    {(itemData.occupancy as Record<string, number>)?.children || 0} Children
                  </span>
                </div>
              </>
            )}

            {itemType === 'flight' && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Airline:</span>
                  <span className="font-medium">{itemData.airline as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flight:</span>
                  <span className="font-medium">{itemData.flight_number as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route:</span>
                  <span className="font-medium">
                    {itemData.departure_city as string} → {itemData.arrival_city as string}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Passenger:</span>
                  <span className="font-medium">{itemData.passenger_name as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Class:</span>
                  <Badge variant="outline" className="capitalize">
                    {(itemData.cabin_class as string) || 'Economy'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Departure:</span>
                  <span className="font-medium">{itemData.departure_datetime as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arrival:</span>
                  <span className="font-medium">{itemData.arrival_datetime as string}</span>
                </div>
              </>
            )}

            {itemType === 'vehicle' && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle:</span>
                  <span className="font-medium">
                    {itemData.vehicle_brand as string} {itemData.vehicle_type as string}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route:</span>
                  <span className="font-medium">
                    {itemData.pickup_location as string} → {itemData.dropoff_location as string}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pickup:</span>
                  <span className="font-medium">{itemData.pickup_datetime as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Drop-off:</span>
                  <span className="font-medium">{itemData.dropoff_datetime as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode:</span>
                  <Badge variant="outline" className="capitalize">
                    {((itemData.availability_type as string) || '').replace('_', ' ')}
                  </Badge>
                </div>

                {(itemData.availability_type as string) === 'at_disposal' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Daily Hours:</span>
                    <span className="font-medium">
                      {itemData.daily_start_time as string} - {itemData.daily_end_time as string}
                    </span>
                  </div>
                )}

                {itemData.driver_name && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Driver:</span>
                      <span className="font-medium">{itemData.driver_name as string}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">License:</span>
                      <span className="font-medium">{itemData.driver_license as string}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Insurance:</span>
                      <Badge variant="outline">
                        {(itemData.driver_insurance_type as string) || 'Basic'}
                      </Badge>
                    </div>
                  </div>
                )}

                {(itemData.itinerary as Array<Record<string, string>>)?.length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="font-medium">Itinerary</div>
                    {(itemData.itinerary as Array<Record<string, string>>).map((day, idx) => (
                      <div key={idx} className="text-xs p-2 bg-muted rounded">
                        <div>{day.date} at {day.time}</div>
                        <div className="font-medium">{day.location}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {notes && (
              <div className="pt-2 border-t">
                <div className="text-muted-foreground mb-1">Notes:</div>
                <div className="text-sm whitespace-pre-wrap">{notes}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost Price:</span>
              <span className="font-medium">₹{costPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selling Price:</span>
              <span className="font-medium">₹{sellPrice.toLocaleString()}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Margin:</span>
              <span className={margin < 0 ? 'text-red-600' : 'text-green-600'}>
                ₹{margin.toLocaleString()} ({marginPct}%)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
        ✓ All details are ready. Click &quot;Create Booking&quot; to proceed. You&apos;ll be able to add a payment schedule on the next page.
      </div>
    </div>
  );
}
