import { z } from 'zod';

// Source-of-truth schema for a proposal/booking item
export const ProposalItemSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['hotel', 'flight', 'activity', 'transfer', 'visa', 'insurance', 'other']),
  service_name: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  cost_price: z.number().min(0).default(0),
  markup_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  selling_price: z.number().min(0).default(0),
  ops_status: z.enum(['pending', 'confirmed', 'on_hold', 'cancelled']).default('pending'),
  currency: z.string().length(3).default('INR'),
  property_contact_email: z.string().email().optional().nullable(),
  portal_confirmation_id: z.string().max(200).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type ProposalItem = z.infer<typeof ProposalItemSchema>;

// Master proposal schema
export const ProposalSchema = z.object({
  lead_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(300),
  destination: z.string().max(300).optional(),
  travel_start: z.string().max(30).optional(),
  travel_end: z.string().max(30).optional(),
  pax_adults: z.number().int().min(0).max(100).default(2),
  pax_children: z.number().int().min(0).max(100).default(0),
  children_ages: z.array(z.number()).optional(),
  currency: z.string().length(3).default('INR'),
  items: z.array(ProposalItemSchema).default([]),
  special_notes: z.string().max(5000).optional().nullable(),
  dietary_notes: z.string().max(2000).optional().nullable(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

export const updateProposalSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  destination: z.string().max(300).optional(),
  travel_start: z.string().max(30).optional(),
  travel_end: z.string().max(30).optional(),
  pax_adults: z.number().int().min(0).max(100).optional(),
  pax_children: z.number().int().min(0).max(100).optional(),
  children_ages: z.array(z.number()).optional(),
  special_notes: z.string().max(5000).optional(),
  dietary_notes: z.string().max(2000).optional(),
  cover_image_url: z.string().max(1000).optional().nullable(),
  cover_image_source: z.string().max(500).optional().nullable(),
  cover_image_approved_at: z.string().max(50).optional().nullable(),
  gst_enabled: z.boolean().optional(),
  gst_rate: z.number().min(0).max(100).optional(),
  tcs_enabled: z.boolean().optional(),
  tcs_rate: z.number().min(0).max(100).optional(),
  rounding_unit: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
  discount_note: z.string().max(500).optional().nullable(),
  payment_terms: z.unknown().optional(),
  currency: z.string().length(3).optional(),
  quote_type: z.enum(['custom', 'package']).optional(),
  package_cp_per_person: z.number().min(0).optional().nullable(),
  package_sp_per_person: z.number().min(0).optional().nullable(),
  package_cwb_sp: z.number().min(0).optional().nullable(),
  package_cnb_sp: z.number().min(0).optional().nullable(),
  visa_section_enabled: z.boolean().optional(),
  trip_cities: z.unknown().optional(),
  land_cp: z.number().min(0).optional().nullable(),
  land_sp: z.number().min(0).optional().nullable(),
  pricing_display_mode: z.string().max(50).optional(),
  total_sp: z.number().min(0).optional().nullable(),
});
