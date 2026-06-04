import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, manager_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Users fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Log to verify full_name is present
    console.log('Users fetched:', data?.map(u => ({ id: u.id, full_name: u.full_name, role: u.role })));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, full_name, role, manager_id } = await request.json();

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Email and full name are required' }, { status: 400 });
    }

    const validRoles = ['agent', 'manager', 'accounts', 'operations', 'super_admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (role !== 'agent' && manager_id) {
      return NextResponse.json(
        { error: 'Only agents can have a manager' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Insert user - let database generate UUID
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email,
        full_name,
        role,
        manager_id: role === 'agent' ? manager_id : null,
        default_currency: 'INR',
        margin_threshold_pct: 12,
        rounding_unit: 0,
      })
      .select('id, email, full_name, role, manager_id, created_at')
      .single();

    if (createError) {
      console.error('User creation error:', createError);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    console.log(`User created: ${email} (${role})`);

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
