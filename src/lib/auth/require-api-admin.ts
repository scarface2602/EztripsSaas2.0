import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function requireApiAdmin(): Promise<{ authorized: true } | NextResponse> {
  const authClient = await createClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { authorized: true };
}
