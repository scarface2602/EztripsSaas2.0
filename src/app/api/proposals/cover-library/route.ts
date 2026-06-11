import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/proposals/cover-library — recent cover images across the
// agent's proposals, deduped, for the "choose from library" picker.
// Uses the RLS client so agents only see their own covers.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('proposals')
    .select('cover_image_url, title, destination, updated_at')
    .not('cover_image_url', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const images: { url: string; label: string }[] = [];
  for (const p of data ?? []) {
    const url = p.cover_image_url as string;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push({ url, label: (p.destination || p.title || '') as string });
    if (images.length >= 24) break;
  }
  return NextResponse.json({ images });
}
