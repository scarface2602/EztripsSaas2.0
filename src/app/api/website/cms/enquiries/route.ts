import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireApiAdmin } from '@/lib/auth/require-api-admin';

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const status = request.nextUrl.searchParams.get('status');

  let query = supabase.from('website_enquiries').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createServiceClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    'status', 'notes', 'assigned_to', 'priority', 'lead_temperature',
    'follow_up_date', 'last_contacted_at', 'converted_at',
  ];
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  const { data, error } = await supabase.from('website_enquiries').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
