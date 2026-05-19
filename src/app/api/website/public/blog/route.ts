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
  const slug = request.nextUrl.searchParams.get('slug');

  if (slug) {
    const { data, error } = await supabase
      .from('website_blog_posts')
      .select('slug, title, excerpt, content, hero_image, tags, author, published_at, seo_title, seo_description')
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error) return NextResponse.json(null, { status: 404, headers });
    return NextResponse.json(data, { headers });
  }

  const { data, error } = await supabase
    .from('website_blog_posts')
    .select('slug, title, excerpt, hero_image, tags, author, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
  return NextResponse.json(data, { headers });
}
