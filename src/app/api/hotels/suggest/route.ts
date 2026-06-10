import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export interface HotelSuggestion {
  name: string;
  city: string | null;
  star_rating: number | null;
  room_type: string | null;
  meal_plan: string | null;
  last_cp_per_night: number | null;
}

/**
 * Hotel autocomplete fed by quoting history — every hotel ever placed on a
 * proposal becomes a suggestion, no separate master data to maintain.
 * Most recently used first; optional ?city= narrows to that city.
 */
export async function GET(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const city = (req.nextUrl.searchParams.get('city') || '').trim();

  const supabase = createServiceClient();
  let query = supabase
    .from('hotels')
    .select('name, city, star_rating, room_type, meal_plan, cp_per_night, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (q.length >= 1) query = query.ilike('name', `%${q}%`);
  if (city) query = query.ilike('city', `%${city}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Dedupe by name+city keeping the most recent row (already sorted desc).
  const seen = new Set<string>();
  const suggestions: HotelSuggestion[] = [];
  for (const h of data || []) {
    const key = `${(h.name || '').toLowerCase()}|${(h.city || '').toLowerCase()}`;
    if (!h.name || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      name: h.name,
      city: h.city,
      star_rating: h.star_rating,
      room_type: h.room_type,
      meal_plan: h.meal_plan,
      last_cp_per_night: h.cp_per_night != null ? Number(h.cp_per_night) : null,
    });
    if (suggestions.length >= 12) break;
  }

  return NextResponse.json({ suggestions });
}
