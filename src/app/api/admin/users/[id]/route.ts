import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Only super admins can modify users
    if (auth.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { role, manager_id } = await request.json();

    // Validation
    const validRoles = ['agent', 'manager', 'accounts', 'operations', 'super_admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Only agents can have a manager
    if (role !== 'agent' && manager_id) {
      return NextResponse.json(
        { error: 'Only agents can have a manager' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .update({
        role,
        manager_id: role === 'agent' ? manager_id : null,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('User update error:', error);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
