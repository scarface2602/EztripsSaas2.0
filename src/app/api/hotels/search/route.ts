import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// GET /api/hotels/search?q=alde&city_id=123&limit=20 — hotel directory
// lookup, optionally scoped to a city (the Stays step always passes one).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim();
  const cityId = parseInt(params.get('city_id') ?? '', 10);
  const limit = Math.min(parseInt(params.get('limit') ?? '20', 10) || 20, 50);
  if (q.length < 2 && !cityId) return NextResponse.json({ hotels: [] });

  const country = (params.get('country') ?? '').trim().toUpperCase();

  const base = () =>
    supabase
      .from('hotel_directory')
      .select('id, name, city_name, star_rating, address, chain_brand, source')
      .order('star_rating', { ascending: false, nullsFirst: false })
      .order('name')
      .limit(limit);

  // Area-aware scope: the directory's city granularity can be coarse
  // (Seminyak hotels filed under "Bali"), so a city search also covers
  // its parent destination and its child areas.
  let cityIds: number[] = [];
  let areaName = '';
  if (Number.isFinite(cityId)) {
    const [{ data: cityRow }, { data: children }] = await Promise.all([
      supabase.from('geo_cities').select('id, name, parent_city_id').eq('id', cityId).single(),
      supabase.from('geo_cities').select('id').eq('parent_city_id', cityId),
    ]);
    areaName = cityRow?.name ?? '';
    cityIds = [cityId, cityRow?.parent_city_id, ...(children ?? []).map((c) => c.id)].filter(
      (x): x is number => Number.isFinite(x),
    );
  }

  let query = base();
  if (cityIds.length) query = query.in('city_id', cityIds);
  if (q.length >= 2) query = query.ilike('name', `%${q}%`);

  const first = await query;
  if (first.error) return NextResponse.json({ error: first.error.message }, { status: 500 });
  let data = first.data;

  // Last resort: country-wide name search (inline-added city with no
  // parent link yet).
  if ((data?.length ?? 0) === 0 && cityIds.length && q.length >= 2) {
    let fallback = base().ilike('name', `%${q}%`);
    if (country) fallback = fallback.eq('country_code', country);
    const res = await fallback;
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    data = res.data;
  }

  // Hotels physically in the searched area float up: address or name
  // mentioning "Seminyak" beats a generic "Bali" hotel.
  if (areaName && data?.length) {
    const needle = areaName.toLowerCase();
    data = [...data].sort((a, b) => {
      const hit = (h: typeof a) =>
        `${h.address ?? ''} ${h.name}`.toLowerCase().includes(needle) ? 1 : 0;
      return hit(b) - hit(a);
    });
  }

  return NextResponse.json({ hotels: data ?? [] });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(300),
  city_id: z.number().int().positive().optional(),
  city_name: z.string().trim().max(120).optional(),
  country_code: z.string().trim().length(2).optional(),
  star_rating: z.number().int().min(1).max(5).nullable().optional(),
});

// POST /api/hotels/search — inline-add a hotel missing from the directory.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const input = parsed.data;

  const { data: hotel, error } = await supabase
    .from('hotel_directory')
    .insert({
      name: input.name,
      city_id: input.city_id ?? null,
      city_name: input.city_name ?? null,
      country_code: input.country_code?.toUpperCase() ?? null,
      star_rating: input.star_rating ?? null,
      source: 'inline',
      created_by: auth.user.id,
    })
    .select('id, name, city_name, star_rating, address, chain_brand, source')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ hotel });
}
