import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireApiAdmin } from '@/lib/auth/require-api-admin';

// GET — list all users
export async function GET() {
  const check = await requireApiAdmin();
  if (check instanceof NextResponse) return check;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create a new agent (creates auth user + users row)
export async function POST(request: NextRequest) {
  const check = await requireApiAdmin();
  if (check instanceof NextResponse) return check;

  const body = await request.json();
  const { email, full_name, password, role = 'agent' } = body;

  if (!email || !full_name || !password) {
    return NextResponse.json({ error: 'email, full_name, and password are required' }, { status: 400 });
  }

  if (role !== 'agent' && role !== 'manager' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Create auth user via admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Insert into users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      full_name,
      role,
      default_currency: 'INR',
      margin_threshold_pct: 12,
      rounding_unit: 0,
      tc_version: 1,
    })
    .select()
    .single();

  if (userError) {
    // Cleanup: delete auth user if DB insert fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  return NextResponse.json(user, { status: 201 });
}

// PATCH — update user role or details
export async function PATCH(request: NextRequest) {
  const check = await requireApiAdmin();
  if (check instanceof NextResponse) return check;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Only allow safe fields
  const allowed = ['full_name', 'role', 'agency_name', 'whatsapp_number', 'max_active_leads'];
  const filtered: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key];
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('users')
    .update(filtered)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
