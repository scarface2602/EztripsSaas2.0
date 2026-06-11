import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// GET /api/activities/library?q=nusa&city_id=12 — searchable, org-shared
// library of tours/transfers/activities with full descriptions.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim();
  const cityId = parseInt(params.get('city_id') ?? '', 10);

  // Empty query (focus): recently used/refined entries.
  let query = supabase
    .from('activity_library')
    .select('id, name, type, city_id, city_name, description, default_transfer_mode')
    .limit(15);
  query = q.length > 0 ? query.ilike('name', `%${q}%`).order('name') : query.order('updated_at', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Name match is primary; the destination's own city floats to the top.
  const results = [...(data ?? [])].sort((a, b) => {
    if (!Number.isFinite(cityId)) return 0;
    return (b.city_id === cityId ? 1 : 0) - (a.city_id === cityId ? 1 : 0);
  });
  return NextResponse.json({ activities: results });
}

const upsertSchema = z.object({
  id: z.number().int().optional(), // present = refine existing entry
  name: z.string().trim().min(2).max(300),
  type: z.enum(['transfer', 'sightseeing', 'meal', 'activity', 'free_time', 'flight', 'other']).default('activity'),
  city_id: z.number().int().nullable().optional(),
  city_name: z.string().trim().max(120).nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  default_transfer_mode: z.enum(['SIC', 'PVT']).nullable().optional(),
});

// POST /api/activities/library — add a new entry, or update (refine the
// description of) an existing one from the itinerary builder.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const { id, ...input } = parsed.data;

  if (id) {
    const { data: activity, error } = await supabase
      .from('activity_library')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, type, city_name, description, default_transfer_mode')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ activity });
  }

  const { data: activity, error } = await supabase
    .from('activity_library')
    .insert({ ...input, created_by: auth.user.id })
    .select('id, name, type, city_name, description, default_transfer_mode')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity });
}
