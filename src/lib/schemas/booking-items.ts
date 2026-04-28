import { z } from 'zod';

export const createBookingItemSchema = z.object({
  booking_id: z.string().uuid(),
  type: z.enum(['hotel', 'flight', 'activity', 'transfer', 'visa', 'insurance', 'other']),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  cost_price: z.number().min(0).optional(),
  sell_price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  supplier_id: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateBookingItemSchema = createBookingItemSchema.partial().omit({ booking_id: true });
