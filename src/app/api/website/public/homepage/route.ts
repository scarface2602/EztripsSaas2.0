import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('website_homepage_content')
    .select('section, content, sort_order')
    .eq('published', true)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

  // Return as a keyed object: { hero: {...}, testimonials: [...], ... }
  const result: Record<string, unknown> = {};
  for (const row of data || []) {
    result[row.section] = row.content;
  }

  return NextResponse.json(result, { headers: CORS_HEADERS });
}
