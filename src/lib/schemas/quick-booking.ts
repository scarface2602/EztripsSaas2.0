import { z } from 'zod';

// Quick register entry — the 30-second version of an offline booking.
// One line in the old query sheet ≈ one of these. Only guest, type,
// description and sell price are mandatory; everything else can be
// filled in later on the booking page.
export const QUICK_ITEM_TYPES = [
  'flight_segment', 'hotel_room', 'vehicle', 'transfer',
  'activity', 'train', 'insurance', 'dmc_package',
] as const;

export const createQuickBookingSchema = z.object({
  client_id: z.string().uuid(),
  bill_to_client_id: z.string().uuid().optional().nullable(),
  item_type: z.enum(QUICK_ITEM_TYPES),
  label: z.string().min(1).max(300),
  destination: z.string().max(200).optional().or(z.literal('')),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
  sell_price: z.number().min(0),
  cost_price: z.number().min(0).optional().nullable(),
  vendor_name: z.string().max(200).optional().or(z.literal('')), // "booked through"
  supplier_reference: z.string().max(200).optional().or(z.literal('')),
  pax_adults: z.number().int().min(1).max(99).optional(),
  pax_children: z.number().int().min(0).max(99).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export type QuickBookingInput = z.infer<typeof createQuickBookingSchema>;
