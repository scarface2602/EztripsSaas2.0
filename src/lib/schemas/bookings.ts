import { z } from 'zod';

export const createBookingSchema = z.object({
  proposal_id: z.string().uuid(),
});

export const updateBookingSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  title: z.string().max(300).optional(),
  destination: z.string().max(300).optional(),
  supplier_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional(),
  supplier_ref: z.string().max(200).optional(),
  supplier_amount: z.number().min(0).optional(),
  supplier_currency: z.string().length(3).optional(),
});
