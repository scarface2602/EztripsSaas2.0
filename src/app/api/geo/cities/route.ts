import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// GET /api/geo/cities?q=ub&country=ID&limit=20 — searchable city lookup.
// Uses the RLS client: geo tables are readable by any signed-in user.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim();
  const country = (params.get('country') ?? '').trim().toUpperCase();
  const limit = Math.min(parseInt(params.get('limit') ?? '20', 10) || 20, 50);
  // Empty query: suggest the country's cities on focus; without a country
  // scope an unfiltered worldwide list is noise, so return nothing.
  if (q.length === 0 && !country) return NextResponse.json({ cities: [] });

  let query = supabase
    .from('geo_cities')
    .select('id, name, state_region, country_code, geo_countries(name)')
    .order('name')
    .limit(limit);
  if (q.length > 0) query = query.ilike('name', `%${q}%`);
  if (country) query = query.eq('country_code', country);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Prefix matches first — ilike alone ranks "Mubud" above "Ubud" for q=ub.
  const ql = q.toLowerCase();
  const cities = (data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      state_region: c.state_region,
      country_code: c.country_code,
      country_name: (c.geo_countries as unknown as { name: string } | null)?.name ?? null,
    }))
    .sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(ql) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(ql) ? 0 : 1;
      return ap - bp || a.name.localeCompare(b.name);
    });

  return NextResponse.json({ cities });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  country_code: z.string().trim().length(2),
});

// POST /api/geo/cities — inline-add a city missing from the directory.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { name, country_code } = parsed.data;
  const code = country_code.toUpperCase();

  // Case-insensitive dedupe (unique constraint is case-sensitive by design).
  const { data: existing } = await supabase
    .from('geo_cities')
    .select('id, name, state_region, country_code')
    .eq('country_code', code)
    .ilike('name', name)
    .limit(1);
  if (existing?.length) return NextResponse.json({ city: existing[0], existed: true });

  const { data: city, error } = await supabase
    .from('geo_cities')
    .insert({ name, country_code: code, source: 'inline', created_by: auth.user.id })
    .select('id, name, state_region, country_code')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ city, existed: false });
}
