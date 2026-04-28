import { z } from 'zod';

export const createClientSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
  email: z.string().email().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateClientSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  phone: z.string().min(1).max(20).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});
