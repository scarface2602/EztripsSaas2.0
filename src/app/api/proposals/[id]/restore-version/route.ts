import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Scalar proposal fields that travel with a version snapshot. Lifecycle
// fields (status, share_token, version, published_data) stay untouched —
// restoring is "bring that content back as my working copy", not time travel.
const RESTORABLE_FIELDS = [
  'title', 'destination', 'travel_start', 'travel_end',
  'pax_adults', 'pax_children', 'children_ages', 'currency',
  'special_notes', 'dietary_notes',
  'gst_enabled', 'gst_rate', 'tcs_enabled', 'tcs_rate',
  'rounding_unit', 'discount_amount', 'discount_note',
  'cover_image_url', 'cover_image_source', 'payment_terms',
  'visa_section_enabled', 'quote_type', 'pricing_mode', 'pricing_display_mode',
  'package_cp_per_person', 'package_sp_per_person', 'package_cwb_sp', 'package_cnb_sp',
  'land_cp', 'land_sp', 'total_sp', 'trip_cities',
] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { version_id } = await request.json();
  if (!version_id) return NextResponse.json({ error: 'version_id required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: version } = await supabase
    .from('proposal_versions')
    .select('id, proposal_id, version, snapshot')
    .eq('id', version_id)
    .eq('proposal_id', id)
    .single();

  if (!version?.snapshot) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  const snapshot = version.snapshot as {
    proposal?: Record<string, unknown>;
    hotels?: Record<string, unknown>[];
    flights?: Record<string, unknown>[];
    itinerary_days?: Record<string, unknown>[];
    activities?: Record<string, unknown>[];
    line_items?: Record<string, unknown>[];
    content_blocks?: Record<string, unknown>[];
  };

  // Replace current working rows with the snapshot's. Children first
  // (activities reference days), then parents; inserts preserve original ids
  // so intra-snapshot references stay valid.
  await supabase.from('itinerary_activities').delete().eq('proposal_id', id);
  await supabase.from('itinerary_days').delete().eq('proposal_id', id);
  await supabase.from('hotels').delete().eq('proposal_id', id);
  await supabase.from('flights').delete().eq('proposal_id', id);
  await supabase.from('line_items').delete().eq('proposal_id', id);
  await supabase.from('proposal_content_blocks').delete().eq('proposal_id', id);

  const inserts: { table: string; rows: Record<string, unknown>[] }[] = [
    { table: 'hotels', rows: snapshot.hotels || [] },
    { table: 'flights', rows: snapshot.flights || [] },
    { table: 'itinerary_days', rows: snapshot.itinerary_days || [] },
    { table: 'itinerary_activities', rows: snapshot.activities || [] },
    { table: 'line_items', rows: snapshot.line_items || [] },
    { table: 'proposal_content_blocks', rows: snapshot.content_blocks || [] },
  ];

  for (const { table, rows } of inserts) {
    if (rows.length === 0) continue;
    const { error } = await supabase.from(table).insert(rows);
    if (error) {
      return NextResponse.json(
        { error: `Restore failed while writing ${table}`, details: error.message },
        { status: 500 },
      );
    }
  }

  const proposalUpdates: Record<string, unknown> = {
    draft_data: null,
    draft_differs_from_published: true,
  };
  const snapProposal = snapshot.proposal || {};
  for (const field of RESTORABLE_FIELDS) {
    if (field in snapProposal) proposalUpdates[field] = snapProposal[field];
  }

  const { error: updateErr } = await supabase
    .from('proposals')
    .update(proposalUpdates)
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: 'Restore failed', details: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, restored_version: version.version });
}
