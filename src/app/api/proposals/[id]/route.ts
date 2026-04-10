import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Whitelist of allowed fields for PATCH
  const allowedFields = [
    'title', 'destination', 'travel_start', 'travel_end',
    'pax_adults', 'pax_children', 'children_ages', 'special_notes', 'dietary_notes',
    'cover_image_url', 'cover_image_source', 'cover_image_approved_at',
    'gst_enabled', 'gst_rate', 'tcs_enabled', 'tcs_rate',
    'rounding_unit', 'discount_amount', 'discount_note',
    'payment_terms', 'currency', 'quote_type',
    'package_cp_per_person', 'package_sp_per_person',
    'package_cwb_sp', 'package_cnb_sp',
    'visa_section_enabled',
    'trip_cities',
    'land_cp', 'land_sp', 'pricing_display_mode', 'total_sp',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase.from('proposals').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
