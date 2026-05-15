import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const slug = request.nextUrl.searchParams.get('slug');

  if (slug) {
    const { data, error } = await supabase
      .from('website_pages')
      .select('slug, title, content, hero_image, seo_title, seo_description')
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error) return NextResponse.json({ error: 'Page not found' }, { status: 404, headers: CORS_HEADERS });
    return NextResponse.json(data, { headers: CORS_HEADERS });
  }

  const { data, error } = await supabase
    .from('website_pages')
    .select('slug, title, seo_title, sort_order')
    .eq('published', true)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json(data, { headers: CORS_HEADERS });
}
