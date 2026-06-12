import { z } from 'zod';
import { gstinError, normalizeGstin, gstinStateCode } from '@/lib/utils/gstin';

// Shared billing-entity fields. GSTIN is checksum-validated and the GST
// state code is derived from it server-side, never typed by hand.
const billingFields = {
  client_kind: z.enum(['individual', 'business']).optional(),
  gstin: z
    .string()
    .transform(normalizeGstin)
    .refine((v) => v === '' || gstinError(v) === null, {
      message: 'Invalid GSTIN (format or checksum)',
    })
    .optional(),
  gst_legal_name: z.string().max(300).optional().or(z.literal('')),
  billing_address: z.string().max(1000).optional().or(z.literal('')),
  pan_number: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => v === '' || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), { message: 'Invalid PAN format' })
    .optional(),
  contact_client_id: z.string().uuid().optional().nullable(),
};

export const createClientSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  ...billingFields,
});

export const updateClientSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional().or(z.literal('')).nullable(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  ...billingFields,
});

/** Derive gst_state_code from GSTIN; empty strings become DB nulls. */
export function normalizeClientPayload<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const key of ['phone', 'email', 'gstin', 'gst_legal_name', 'billing_address', 'pan_number']) {
    if (out[key] === '') out[key] = null;
  }
  if (typeof out.gstin === 'string' && out.gstin) {
    out.gst_state_code = gstinStateCode(out.gstin);
  } else if (out.gstin === null) {
    out.gst_state_code = null;
  }
  return out;
}
