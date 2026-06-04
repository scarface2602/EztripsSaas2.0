import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

const ALLOWED_ORIGINS = [
  'https://eztrips.in',
  'https://www.eztrips.in',
  'http://localhost:3000',
  'http://localhost:3001',
];

function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return origin;
  return null;
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = getAllowedOrigin(request);
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// GET: Public (with ?category=X) or Admin (all items)
export async function GET(request: NextRequest) {
  const origin = getAllowedOrigin(request);
  const headers = corsHeaders(origin);
  const category = request.nextUrl.searchParams.get('category');
  const supabase = createServiceClient();

  if (category) {
    // Public: return active items for a specific category
    const { data, error } = await supabase
      .from('lookup_items')
      .select('value, label, group_name, metadata')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
    return NextResponse.json(data, { headers });
  }

  // Admin: return all items
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });

  const { data, error } = await supabase
    .from('lookup_items')
    .select('*')
    .order('category')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
  return NextResponse.json(data, { headers });
}

// POST: Admin — create item
export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { category, value, label, group_name, sort_order, metadata } = body;

  if (!category || !value || !label) {
    return NextResponse.json({ error: 'category, value, and label are required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('lookup_items')
    .insert({
      category,
      value: value.toLowerCase().replace(/\s+/g, '_'),
      label,
      group_name: group_name || null,
      sort_order: sort_order ?? 0,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This value already exists in this category' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

// PATCH: Admin — update item
export async function PATCH(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('lookup_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: Admin — delete item
export async function DELETE(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('lookup_items')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
