import { z } from 'zod';

export const BookingPassengerSchema = z.object({
  id: z.string().uuid().optional(),
  booking_id: z.string().uuid().optional(),
  type: z.enum(['adult', 'child']).default('adult'),
  title: z.string().max(20).optional().nullable(),
  first_name: z.string().min(1).max(200),
  last_name: z.string().max(200).optional().nullable(),
  dob: z.string().max(20).optional().nullable(),
  passport_number: z.string().max(50).optional().nullable(),
  passport_expiry: z.string().max(20).optional().nullable(),
  passport_document_url: z.string().max(1000).optional().nullable(),
});

export type BookingPassenger = z.infer<typeof BookingPassengerSchema>;

// For checkout: only primary traveler name is required
export const CheckoutPassengerSchema = z.object({
  type: z.enum(['adult', 'child']).default('adult'),
  title: z.string().max(20).optional().nullable(),
  first_name: z.string().max(200).optional().default(''),
  last_name: z.string().max(200).optional().nullable(),
  dob: z.string().max(20).optional().nullable(),
  passport_number: z.string().max(50).optional().nullable(),
  passport_expiry: z.string().max(20).optional().nullable(),
});

export type CheckoutPassenger = z.infer<typeof CheckoutPassengerSchema>;
