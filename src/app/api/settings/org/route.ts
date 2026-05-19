import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: userData } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('id', authUser.id)
    .single();

  if (!userData?.org_id) {
    return NextResponse.json({ org: null, role: userData?.role || 'agent' });
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', userData.org_id)
    .single();

  return NextResponse.json({ org, role: userData.role });
}

export async function PATCH(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: userData } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('id', authUser.id)
    .single();

  if (userData?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const orgData: Record<string, unknown> = {
    name: body.name,
    logo_url: body.logo_url || null,
    phone: body.phone || null,
    address: body.address || null,
    email: body.email || null,
    website: body.website || null,
    terms_and_conditions: body.terms_and_conditions || null,
  };

  // Auto-assignment settings (optional fields)
  if (body.auto_assign_enabled !== undefined) {
    orgData.auto_assign_enabled = !!body.auto_assign_enabled;
  }
  if (body.auto_assign_strategy) {
    orgData.auto_assign_strategy = body.auto_assign_strategy;
  }

  if (userData.org_id) {
    // Update existing
    const { data, error } = await supabase
      .from('organisations')
      .update(orgData)
      .eq('id', userData.org_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ org: data });
  } else {
    // Create new org and link user
    const { data: newOrg, error: createError } = await supabase
      .from('organisations')
      .insert(orgData)
      .select()
      .single();
    if (createError || !newOrg) {
      return NextResponse.json({ error: createError?.message || 'Failed to create org' }, { status: 500 });
    }
    await supabase.from('users').update({ org_id: newOrg.id }).eq('id', authUser.id);
    return NextResponse.json({ org: newOrg });
  }
}
