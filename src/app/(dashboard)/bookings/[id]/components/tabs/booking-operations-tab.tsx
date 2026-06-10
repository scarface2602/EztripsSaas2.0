'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookingERP } from '@/components/booking-erp';
import { useBooking } from '../../booking-context';

export function BookingOperationsTab() {
  const { bookingId, booking, items, enquiry } = useBooking();

  if (!booking) return null;

  const proposalVehicleType = booking.proposals?.draft_data ? (booking.proposals.draft_data as Record<string, unknown> & { vehicle_type?: string; vehicle_model?: string }).vehicle_type : null;
  const proposalVehicleModel = booking.proposals?.draft_data ? (booking.proposals.draft_data as Record<string, unknown> & { vehicle_type?: string; vehicle_model?: string }).vehicle_model : null;

  const req = (enquiry?.requirement_details ?? null) as {
    departure_city?: string;
    travel_month?: string;
    room_count?: number;
    cities?: string[];
    special_services?: string[];
    is_pilgrimage?: boolean;
  } | null;

  return (
    <div className="space-y-6">
      {req && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-primary">Original Yatra Preferences & Wizard Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {req.departure_city && (
                <div>
                  <span className="text-muted-foreground block text-xs">Origin Hub</span>
                  <span className="font-semibold text-sm">{req.departure_city}</span>
                </div>
              )}
              {req.travel_month && (
                <div>
                  <span className="text-muted-foreground block text-xs">Preferred Travel Month</span>
                  <span className="font-semibold text-sm">{req.travel_month}</span>
                </div>
              )}
              {req.room_count && (
                <div>
                  <span className="text-muted-foreground block text-xs">Requested Rooms</span>
                  <span className="font-semibold text-sm">{req.room_count} Room(s)</span>
                </div>
              )}
            </div>

            {Array.isArray(req.cities) && req.cities.length > 0 && (
              <div>
                <span className="text-muted-foreground block text-xs mb-1">
                  {req.is_pilgrimage ? 'Sacred Shrines / Cities in Focus' : 'Cities / Regions in Focus'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {req.cities.map((city) => (
                    <Badge key={city} variant="secondary">
                      {city}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(req.special_services) && req.special_services.length > 0 && (
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Special Services Requested</span>
                <div className="flex flex-wrap gap-1.5">
                  {req.special_services.map((service) => (
                    <Badge key={service} variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(proposalVehicleType || proposalVehicleModel) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-primary">Confirmed Vehicle Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposalVehicleType && (
                <div>
                  <span className="text-muted-foreground block text-xs">Vehicle Type</span>
                  <span className="font-semibold text-sm capitalize">{proposalVehicleType.replace(/_/g, ' ')}</span>
                </div>
              )}
              {proposalVehicleModel && (
                <div>
                  <span className="text-muted-foreground block text-xs">Vehicle Model / Brand</span>
                  <span className="font-semibold text-sm">{proposalVehicleModel}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <BookingERP
        activeTab="operations"
        bookingId={bookingId}
        currency={booking.currency || 'INR'}
        travelStartDate={booking.travel_start || ''}
        clientTotal={booking.sell_price || 0}
        supplierNames={items
          .filter((item) => item.vendor_name)
          .reduce((acc: { id: string; name: string; amount: number }[], item) => {
            const existing = acc.find((s: { name: string }) => s.name === item.vendor_name);
            if (existing) {
              existing.amount += (item.cost_price || 0);
            } else {
              acc.push({ id: item.id, name: item.vendor_name!, amount: item.cost_price || 0 });
            }
            return acc;
          }, [] as Array<{ id: string; name: string; amount: number }>)
        }
      />
    </div>
  );
}
