import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { gstinError, gstinStateCode, normalizeGstin } from '@/lib/utils/gstin';
import { DEFAULT_TAX_CONFIG, resolveTaxConfig } from '@/lib/tax/engine';

export const dynamic = 'force-dynamic';

// Org-level master tax rules. Every agency on the platform edits its own
// GST identity and rates here — nothing is hardcoded per tenant.

const patchSchema = z.object({
  gstin: z.string().transform(normalizeGstin).refine((v) => v === '' || gstinError(v) === null, {
    message: 'Invalid GSTIN (format or checksum)',
  }).optional(),
  gst_legal_name: z.string().max(300).optional().or(z.literal('')),
  address: z.string().max(1000).optional().or(z.literal('')),
  tax_config: z.object({
    air_agent_method: z.enum(['MARGIN', 'BASIC_FARE']).optional(),
    cab_fuel_included: z.boolean().optional(),
    tour_operator_rate: z.number().min(0).max(100).optional(),
    margin_rate: z.number().min(0).max(100).optional(),
    cab_gross_rate: z.number().min(0).max(100).optional(),
    rule32_domestic_pct: z.number().min(0).max(100).optional(),
    rule32_international_pct: z.number().min(0).max(100).optional(),
    tcs: z.object({
      mode: z.enum(['FLAT', 'SLAB']).optional(),
      flat_rate: z.number().min(0).max(100).optional(),
      threshold: z.number().min(0).optional(),
      rate_below: z.number().min(0).max(100).optional(),
      rate_above: z.number().min(0).max(100).optional(),
    }).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'accounts.manage' });
    if (auth instanceof NextResponse) return auth;
    if (!auth.user.org_id) return NextResponse.json({ error: 'No organisation linked to this user' }, { status: 400 });

    const supabase = createServiceClient();
    const { data: org, error } = await supabase
      .from('organisations')
      .select('id, name, gstin, gst_legal_name, gst_state_code, address, tax_config')
      .eq('id', auth.user.org_id)
      .single();
    if (error || !org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

    return NextResponse.json({
      ...org,
      // resolved = defaults + org overrides, what the engine actually uses
      resolved_tax_config: resolveTaxConfig(org.tax_config || null),
      defaults: DEFAULT_TAX_CONFIG,
    });
  } catch (err) {
    console.error('Tax settings GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'accounts.manage' });
    if (auth instanceof NextResponse) return auth;
    if (!auth.user.org_id) return NextResponse.json({ error: 'No organisation linked to this user' }, { status: 400 });

    const d = patchSchema.parse(await request.json());
    const updates: Record<string, unknown> = {};
    if (d.gstin !== undefined) {
      updates.gstin = d.gstin || null;
      updates.gst_state_code = d.gstin ? gstinStateCode(d.gstin) : null;
    }
    if (d.gst_legal_name !== undefined) updates.gst_legal_name = d.gst_legal_name || null;
    if (d.address !== undefined) updates.address = d.address || null;

    const supabase = createServiceClient();
    if (d.tax_config !== undefined) {
      // Merge over existing overrides so a partial edit doesn't wipe others
      const { data: existing } = await supabase
        .from('organisations').select('tax_config').eq('id', auth.user.org_id).single();
      const current = (existing?.tax_config || {}) as Record<string, unknown>;
      updates.tax_config = {
        ...current,
        ...d.tax_config,
        tcs: { ...(current.tcs as object || {}), ...(d.tax_config.tcs || {}) },
      };
    }

    const { data, error } = await supabase
      .from('organisations')
      .update(updates)
      .eq('id', auth.user.org_id)
      .select('id, name, gstin, gst_legal_name, gst_state_code, address, tax_config')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ...data, resolved_tax_config: resolveTaxConfig(data.tax_config || null) });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }
    console.error('Tax settings PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
