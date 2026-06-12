import { z } from 'zod';

// ============================================================
// Offline Booking Schemas
// ============================================================

const commonOfflineItemSchema = z.object({
  cost_price: z.number().min(0, 'Cost price must be 0 or greater'),
  sell_price: z.number().min(0, 'Selling price must be 0 or greater'),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional(),
  supplier_id: z.string().uuid('Supplier ID must be a valid UUID').optional().nullable(),
});

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
  extra_beds: z.number().int().min(0).optional(),
  children_ages: z.array(z.number().int().min(0).max(18)).optional(),
});

export const flightOfflineSchema = commonOfflineItemSchema.extend({
  item_type: z.literal('flight'),
  airline: z.string().min(1, 'Airline is required').max(100),
  flight_number: z.string().min(1, 'Flight number is required').max(20),
  departure_city: z.string().min(1, 'Departure city is required').max(100),
  departure_iata: z.string().length(3).optional().or(z.literal('')),
  arrival_city: z.string().min(1, 'Arrival city is required').max(100),
  arrival_iata: z.string().length(3).optional().or(z.literal('')),
  departure_datetime: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/),
  arrival_datetime: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/),
  passenger_name: z.string().max(200).optional().or(z.literal('')),
  cabin_class: z.enum(['economy', 'business', 'first']).optional().or(z.literal('')),
});

export const vehicleOfflineSchema = commonOfflineItemSchema.extend({
  item_type: z.literal('vehicle'),
  vehicle_type: z.enum(['hatchback', 'sedan', 'premium_sedan', 'muv', 'premium_muv', 'suv', 'van', 'luxury_van', 'coach', 'luxury_coach']),
  vehicle_brand: z.string().max(100).optional().or(z.literal('')),
  pickup_location: z.string().min(1).max(200),
  dropoff_location: z.string().min(1).max(200),
  pickup_datetime: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/),
  dropoff_datetime: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/),
  availability_type: z.enum(['point_to_point', 'at_disposal']),
  daily_start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  daily_end_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  driver_name: z.string().max(200).optional().nullable().or(z.literal('')),
  driver_license: z.string().max(50).optional().nullable().or(z.literal('')),
  driver_license_valid_until: z.string().date().optional().nullable().or(z.literal('')),
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

// Payment schedule schema
const paymentScheduleSchema = z.object({
  mode: z.enum(['full', 'split']),
  deposit_amount: z.number().min(0),
  deposit_due_date: z.string().date(),
  balance_amount: z.number().min(0),
  balance_due_date: z.string().date(),
});

// Passthrough versions
const hotelOfflinePassthrough = hotelOfflineSchema.passthrough();
const flightOfflinePassthrough = flightOfflineSchema.passthrough();
const vehicleOfflinePassthrough = vehicleOfflineSchema.passthrough();

// Main schema
export const createOfflineBookingSchema = z.object({
  item_type: z.enum(['hotel', 'flight', 'vehicle']),
  client_id: z.string().uuid(),
  bill_to_client_id: z.string().uuid().optional(),
  item_details: z.record(z.string(), z.unknown()),
  cost_price: z.number().min(0),
  sell_price: z.number().min(0),
  notes: z.string().max(2000).optional(),
  payment_schedule: paymentScheduleSchema,
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
    for (const issue of result.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ['item_details', ...issue.path],
      });
    }
  }
});

export type OfflineBookingFormData = z.infer<typeof createOfflineBookingSchema>;
export type HotelOfflineItem = z.infer<typeof hotelOfflineSchema>;
export type FlightOfflineItem = z.infer<typeof flightOfflineSchema>;
export type VehicleOfflineItem = z.infer<typeof vehicleOfflineSchema>;
