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
  bill_to_client_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional(),
  supplier_ref: z.string().max(200).optional(),
  supplier_amount: z.number().min(0).optional(),
  supplier_currency: z.string().length(3).optional(),
  // Fields saved by the booking details tab — zod strips unknown keys,
  // so anything missing here is silently dropped on save.
  reference_number: z.string().max(200).optional().or(z.literal('')),
  blocking_reference: z.string().max(200).optional().or(z.literal('')),
  blocking_expires_at: z.string().optional().nullable(),
  internal_notes: z.string().max(5000).optional().or(z.literal('')),
  min_confirmation_amount: z.number().min(0).optional().nullable(),
});
