import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/geo/countries — full list (~137 rows), cached client-side.
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('geo_countries')
    .select('code, name')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ countries: data ?? [] });
}
