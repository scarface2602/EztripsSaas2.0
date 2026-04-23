import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin') || '';
  if (['https://eztrips.in', 'http://localhost:3000'].includes(origin)) return origin;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return origin;
  return origin || null;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(getAllowedOrigin(request)) });
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(getAllowedOrigin(request));
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('website_destinations')
    .select('slug, title, tagline, description, country, region, tags, cover_image, gallery, duration_days, price_from, currency, is_pilgrimage, sort_order')
    .eq('published', true)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
  return NextResponse.json(data, { headers });
}
