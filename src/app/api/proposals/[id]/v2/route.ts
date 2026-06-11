import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';

// GET/PUT the full Builder v2 payload (proposal core + destinations +
// price groups + items). The client generates UUIDs for new rows, so a
// save is a straight replace-sync: upsert everything sent, delete
// anything no longer present.

const destinationSchema = z.object({
  id: z.string().uuid(),
  city_id: z.number().int().nullable(),
  city_name: z.string().trim().min(1).max(120),
  country_code: z.string().trim().length(2).nullable(),
  nights: z.number().int().min(0).max(60),
  sort_order: z.number().int(),
});

const groupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  supplier_id: z.string().uuid().nullable(),
  supplier_name: z.string().trim().max(200).nullable(),
  cost_amount: z.number().min(0),
  markup_type: z.enum(['percent', 'flat']),
  markup_value: z.number().min(0),
  sell_amount: z.number().min(0),
  sort_order: z.number().int(),
});

const itemSchema = z.object({
  id: z.string().uuid(),
  destination_id: z.string().uuid().nullable(),
  price_group_id: z.string().uuid().nullable(),
  item_type: z.enum(['hotel', 'flight', 'transfer', 'activity', 'visa', 'other']),
  title: z.string().trim().min(1).max(300),
  details: z.record(z.string(), z.unknown()).default({}),
  hotel_directory_id: z.number().int().nullable(),
  check_in: z.string().nullable(),
  check_out: z.string().nullable(),
  nights: z.number().int().nullable(),
  source: z.enum(['manual', 'directory', 'api']),
  provider: z.string().nullable(),
  provider_ref: z.string().nullable(),
  cost_amount: z.number().nullable(),
  sell_amount: z.number().nullable(),
  sort_order: z.number().int(),
});

const itineraryDaySchema = z.object({
  id: z.string().uuid(),
  day_number: z.number().int().min(1),
  date: z.string().nullable(),
  city: z.string().nullable(),
  heading: z.string().nullable(),
  description: z.string().nullable(),
  day_type: z.enum(['arrival', 'tour', 'transfer', 'departure', 'flight']).nullable(),
  transfer_mode: z.enum(['SIC', 'PVT', 'NONE']).nullable(),
});

const saveSchema = z.object({
  proposal: z.object({
    title: z.string().trim().max(200).nullable(),
    client_id: z.string().uuid().nullable(),
    destination: z.string().trim().max(300).nullable(),
    travel_start: z.string().nullable(),
    travel_end: z.string().nullable(),
    pax_adults: z.number().int().min(0).max(99),
    pax_children: z.number().int().min(0).max(99),
    currency: z.string().trim().length(3),
    gst_enabled: z.boolean(),
    gst_rate: z.number().min(0).max(100),
    tcs_enabled: z.boolean(),
    tcs_rate: z.number().min(0).max(100),
    special_notes: z.string().nullable(),
  }),
  destinations: z.array(destinationSchema),
  groups: z.array(groupSchema),
  items: z.array(itemSchema),
  itinerary: z.array(itineraryDaySchema).default([]),
});

async function checkOwnership(proposalId: string, request: NextRequest) {
  return withAuth(request, { checkOwnership: { table: 'proposals', id: proposalId } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkOwnership(id, request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const [proposalRes, destRes, groupRes, itemRes, dayRes] = await Promise.all([
    supabase.from('proposals').select('*').eq('id', id).single(),
    supabase.from('proposal_destinations').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('proposal_price_groups').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('proposal_items').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('proposal_id', id).order('day_number'),
  ]);
  if (proposalRes.error) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    proposal: proposalRes.data,
    destinations: destRes.data ?? [],
    groups: groupRes.data ?? [],
    items: itemRes.data ?? [],
    itinerary: dayRes.data ?? [],
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkOwnership(id, request);
  if (auth instanceof NextResponse) return auth;

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const { proposal, destinations, groups, items, itinerary } = parsed.data;
  const supabase = createServiceClient();

  // Confirmed proposals are locked — quoted baselines must not move.
  const { data: current } = await supabase.from('proposals').select('status').eq('id', id).single();
  if (current?.status === 'confirmed' || current?.status === 'cancelled') {
    return NextResponse.json({ error: `Proposal is ${current.status} and read-only` }, { status: 409 });
  }

  const totalSell =
    groups.reduce((s, g) => s + g.sell_amount, 0) +
    items.reduce((s, i) => s + (i.price_group_id ? 0 : (i.sell_amount ?? 0)), 0);

  const { error: pErr } = await supabase
    .from('proposals')
    .update({ ...proposal, total_sp: totalSell, builder_version: 2 })
    .eq('id', id);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Replace-sync children. Order matters: parents (destinations, groups)
  // upsert before items that reference them; deletes go items-first.
  const tag = (rows: object[]) => rows.map((r) => ({ ...r, proposal_id: id }));

  const keepIds = (arr: { id: string }[]) => arr.map((r) => r.id);
  const del = async (table: string, keep: string[]) => {
    let q = supabase.from(table).delete().eq('proposal_id', id);
    if (keep.length) q = q.not('id', 'in', `(${keep.join(',')})`);
    const { error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
  };
  const upsert = async (table: string, rows: object[]) => {
    if (!rows.length) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  try {
    await del('proposal_items', keepIds(items));
    await del('proposal_price_groups', keepIds(groups));
    await del('proposal_destinations', keepIds(destinations));
    await del('itinerary_days', keepIds(itinerary));
    await upsert('proposal_destinations', tag(destinations));
    await upsert('proposal_price_groups', tag(groups));
    await upsert(
      'proposal_items',
      tag(items.map((i) => ({ ...i, updated_at: new Date().toISOString() }))),
    );
    await upsert('itinerary_days', tag(itinerary));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, total_sp: totalSell });
}
