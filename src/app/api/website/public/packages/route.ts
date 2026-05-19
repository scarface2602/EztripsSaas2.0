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
  if (['https://eztrips.in', 'https://www.eztrips.in', 'http://localhost:3000'].includes(origin)) return origin;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return origin;
  return origin || null;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(getAllowedOrigin(request)) });
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(getAllowedOrigin(request));
  const supabase = createServiceClient();
  const destinationSlug = request.nextUrl.searchParams.get('destination');
  const slug = request.nextUrl.searchParams.get('slug');

  let query = supabase
    .from('website_packages')
    .select('*')
    .eq('published', true)
    .order('sort_order');

  if (destinationSlug) query = query.eq('destination_slug', destinationSlug);
  if (slug) query = query.eq('slug', slug).limit(1);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });

  if (slug && data?.length) return NextResponse.json(data[0], { headers });
  return NextResponse.json(data, { headers });
}
