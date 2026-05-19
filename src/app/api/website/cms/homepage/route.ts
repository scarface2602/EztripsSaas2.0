import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireApiAdmin } from '@/lib/auth/require-api-admin';

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('website_homepage_content')
    .select('*')
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { section, content } = body;

  if (!section) return NextResponse.json({ error: 'Section is required' }, { status: 400 });

  const supabase = createServiceClient();

  // Upsert by section name
  const { data: existing } = await supabase
    .from('website_homepage_content')
    .select('id')
    .eq('section', section)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('website_homepage_content')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from('website_homepage_content')
    .insert({ section, content })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
