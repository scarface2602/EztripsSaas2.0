import { z } from 'zod';

// ============================================================
// Offline Booking Schemas
// ============================================================

// Common fields for all offline items
const commonOfflineItemSchema = z.object({
  cost_price: z.number().min(0, 'Cost price must be 0 or greater'),
  sell_price: z.number().min(0, 'Selling price must be 0 or greater'),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional(),
  supplier_id: z.string().uuid('Supplier ID must be a valid UUID').optional().nullable(),
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
  extra_beds: z.number().int().min(0, 'Extra beds cannot be negative').optional(),
  children_ages: z.array(z.number().int().min(0, 'Age must be 0 or greater').max(18, 'Age must be 18 or less')).optional(),
});

// Flight offline schema
export const flightOfflineSchema = commonOfflineItemSchema.extend({
  item_type: z.literal('flight'),
  airline: z.string().min(1, 'Airline is required').max(100),
  flight_number: z.string().min(1, 'Flight number is required').max(20),
  departure_city: z.string().min(1, 'Departure city is required').max(100),
  departure_iata: z.string().length(3, 'IATA code must be 3 characters').optional().or(z.literal('')),
  arrival_city: z.string().min(1, 'Arrival city is required').max(100),
  arrival_iata: z.string().length(3, 'IATA code must be 3 characters').optional().or(z.literal('')),
  departure_datetime: z.string().min(1, 'Departure datetime is required').regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/, 'Departure must be a valid datetime'),
  arrival_datetime: z.string().min(1, 'Arrival datetime is required').regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/, 'Arrival must be a valid datetime'),
  passenger_name: z.string().min(1, 'Passenger name is required').max(200).optional().or(z.literal('')),
  cabin_class: z.enum(['economy', 'business', 'first']).optional().or(z.literal('')),
});

// Vehicle offline schema
export const vehicleOfflineSchema = commonOfflineItemSchema.extend({
  item_type: z.literal('vehicle'),
  vehicle_type: z.enum(['hatchback', 'sedan', 'premium_sedan', 'muv', 'premium_muv', 'suv', 'van', 'luxury_van', 'coach', 'luxury_coach']),
  vehicle_brand: z.string().max(100, 'Vehicle brand max 100 characters').optional().or(z.literal('')),
  pickup_location: z.string().min(1, 'Pickup location is required').max(200),
  dropoff_location: z.string().min(1, 'Drop-off location is required').max(200),
  pickup_datetime: z.string().min(1, 'Pickup datetime is required').regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/, 'Pickup must be a valid datetime'),
  dropoff_datetime: z.string().min(1, 'Drop-off datetime is required').regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/, 'Drop-off must be a valid datetime'),
  availability_type: z.enum(['point_to_point', 'at_disposal']),
  daily_start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:mm format').optional().or(z.literal('')),
  daily_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:mm format').optional().or(z.literal('')),
  driver_name: z.string().max(200, 'Driver name max 200 characters').optional().nullable().or(z.literal('')),
  driver_license: z.string().max(50, 'License number max 50 characters').optional().nullable().or(z.literal('')),
  driver_license_valid_until: z.string().date('License expiry must be a valid date').optional().nullable().or(z.literal('')),
  driver_insurance_type: z.enum(['basic', 'premium']).optional().nullable(),
  itinerary: z.array(
    z.object({
      date: z.string().optional().or(z.literal('')),
      time: z.string().optional().or(z.literal('')),
      location: z.string().max(300).optional().or(z.literal('')),
      notes: z.string().max(500).optional().or(z.literal('')),
    })
  ).optional(),
});

// Union of all item types
export const offlineItemDetailsSchema = z.union(
  [hotelOfflineSchema, flightOfflineSchema, vehicleOfflineSchema]
);

// Passthrough versions so extra form fields don't cause validation failures
const hotelOfflinePassthrough = hotelOfflineSchema.passthrough();
const flightOfflinePassthrough = flightOfflineSchema.passthrough();
const vehicleOfflinePassthrough = vehicleOfflineSchema.passthrough();

// Main create offline booking schema
export const createOfflineBookingSchema = z.object({
  item_type: z.enum(['hotel', 'flight', 'vehicle']),
  client_id: z.string().uuid('Client ID must be a valid UUID'),
  item_details: z.record(z.string(), z.unknown()),
  cost_price: z.number().min(0),
  sell_price: z.number().min(0),
  notes: z.string().max(2000).optional(),
}).superRefine((data, ctx) => {
  const schemaMap = {
    hotel: hotelOfflinePassthrough,
    flight: flightOfflinePassthrough,
    vehicle: vehicleOfflinePassthrough,
  };
  const schema = schemaMap[data.item_type];
  if (!schema) return;

  const merged = { ...data.item_details, item_type: data.item_type, cost_price: data.cost_price, sell_price: data.sell_price };
  const result = schema.safeParse(merged);

  if (!result.success) {
    console.error('Item details validation failed:', { item_type: data.item_type, errors: result.error.flatten(), item_details: data.item_details });
    for (const issue of result.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ['item_details', ...issue.path],
      });
    }
  }
});

// Type exports for form usage
export type OfflineBookingFormData = z.infer<typeof createOfflineBookingSchema>;
export type HotelOfflineItem = z.infer<typeof hotelOfflineSchema>;
export type FlightOfflineItem = z.infer<typeof flightOfflineSchema>;
export type VehicleOfflineItem = z.infer<typeof vehicleOfflineSchema>;
