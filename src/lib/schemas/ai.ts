import { z } from 'zod';

export const contentBlocksSchema = z.object({
  type: z.string().max(100).optional(),
  destination: z.string().max(200).optional(),
});

export const hotelDescriptionSchema = z.object({
  hotel_name: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  country: z.string().max(100).optional(),
});

export const itinerarySchema = z.object({
  day_number: z.number().int().min(1).max(365),
  destination: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  hotel: z.string().max(200).optional(),
  activities: z.array(z.unknown()).optional(),
  raw_description: z.string().max(5000).optional(),
  existing_heading: z.string().max(500).optional(),
  day_type: z.enum(['arrival', 'departure', 'transfer', 'flight', 'tour']).optional(),
});

export const parsePolicySchema = z.object({
  text: z.string().min(1, 'No text provided').max(10000),
});
