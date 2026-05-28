import { z } from 'zod';

// ============================================================
// Offline Booking Schemas
// ============================================================

// Common fields for all offline items
const commonOfflineItemSchema = z.object({
  cost_price: z.number().min(0, 'Cost price must be 0 or greater'),
  sell_price: z.number().min(0, 'Selling price must be 0 or greater'),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional(),
});

// Hotel offline schema
export const hotelOfflineSchema = commonOfflineItemSchema.extend({
  item_type: z.literal('hotel'),
  hotel_name: z.string().min(1, 'Hotel name is required').max(200),
  city: z.string().min(1, 'City is required').max(100),
  check_in: z.string().date('Check-in must be a valid date'),
  check_out: z.string().date('Check-out must be a valid date'),
  room_type: z.string().min(1, 'Room type is required').max(100),
  occupancy: z.object({
    adults: z.number().int().min(1, 'At least 1 adult required'),
    children: z.number().int().min(0, 'Children count cannot be negative'),
  }),
});

// Flight offline schema
export const flightOfflineSchema = commonOfflineItemSchema.extend({
  item_type: z.literal('flight'),
  airline: z.string().min(1, 'Airline is required').max(100),
  flight_number: z.string().min(1, 'Flight number is required').max(20),
  departure_city: z.string().min(1, 'Departure city is required').max(100),
  departure_iata: z.string().length(3, 'IATA code must be 3 characters').optional(),
  arrival_city: z.string().min(1, 'Arrival city is required').max(100),
  arrival_iata: z.string().length(3, 'IATA code must be 3 characters').optional(),
  departure_datetime: z.string().datetime('Departure must be a valid datetime'),
  arrival_datetime: z.string().datetime('Arrival must be a valid datetime'),
  passenger_name: z.string().min(1, 'Passenger name is required').max(200),
  cabin_class: z.enum(['economy', 'business', 'first']).optional(),
});

// Vehicle offline schema
export const vehicleOfflineSchema = commonOfflineItemSchema.extend({
  item_type: z.literal('vehicle'),
  vehicle_type: z.enum(['car', 'suv', 'taxi', 'coach']),
  vehicle_brand: z.string().max(100, 'Vehicle brand max 100 characters').optional(),
  pickup_location: z.string().min(1, 'Pickup location is required').max(200),
  dropoff_location: z.string().min(1, 'Drop-off location is required').max(200),
  pickup_datetime: z.string().datetime('Pickup must be a valid datetime'),
  dropoff_datetime: z.string().datetime('Drop-off must be a valid datetime'),
  availability_type: z.enum(['point_to_point', 'at_disposal']),
  daily_start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:mm format').optional(),
  daily_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:mm format').optional(),
  driver_name: z.string().max(200, 'Driver name max 200 characters').optional().nullable(),
  driver_license: z.string().max(50, 'License number max 50 characters').optional().nullable(),
  driver_license_valid_until: z.string().date('License expiry must be a valid date').optional().nullable(),
  driver_insurance_type: z.enum(['basic', 'premium']).optional().nullable(),
  itinerary: z.array(
    z.object({
      date: z.string().date('Date must be valid'),
      time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm format'),
      location: z.string().min(1, 'Location required').max(300),
      notes: z.string().max(500, 'Notes max 500 characters').optional(),
    })
  ).optional(),
});

// Union of all item types
export const offlineItemDetailsSchema = z.union(
  [hotelOfflineSchema, flightOfflineSchema, vehicleOfflineSchema]
);

// Main create offline booking schema
export const createOfflineBookingSchema = z.object({
  item_type: z.enum(['hotel', 'flight', 'vehicle']),
  client_id: z.string().uuid('Client ID must be a valid UUID'),
  item_details: z.record(z.string(), z.unknown()), // Allow any object, will validate based on item_type
  cost_price: z.number().min(0),
  sell_price: z.number().min(0),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => {
    // Validate item_details based on item_type
    if (data.item_type === 'hotel') {
      return hotelOfflineSchema.safeParse({ ...data.item_details, item_type: 'hotel', cost_price: data.cost_price, sell_price: data.sell_price }).success;
    } else if (data.item_type === 'flight') {
      return flightOfflineSchema.safeParse({ ...data.item_details, item_type: 'flight', cost_price: data.cost_price, sell_price: data.sell_price }).success;
    } else if (data.item_type === 'vehicle') {
      return vehicleOfflineSchema.safeParse({ ...data.item_details, item_type: 'vehicle', cost_price: data.cost_price, sell_price: data.sell_price }).success;
    }
    return true;
  },
  {
    message: 'Item details do not match the selected item type',
    path: ['item_details'],
  }
);

// Type exports for form usage
export type OfflineBookingFormData = z.infer<typeof createOfflineBookingSchema>;
export type HotelOfflineItem = z.infer<typeof hotelOfflineSchema>;
export type FlightOfflineItem = z.infer<typeof flightOfflineSchema>;
export type VehicleOfflineItem = z.infer<typeof vehicleOfflineSchema>;
