import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('id', authUser.id)
    .single();

  if (userData?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const orgData = {
    name: body.name,
    logo_url: body.logo_url || null,
    phone: body.phone || null,
    address: body.address || null,
    email: body.email || null,
    website: body.website || null,
  };

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
