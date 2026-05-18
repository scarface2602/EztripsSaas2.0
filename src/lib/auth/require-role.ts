import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { User } from '@/lib/types/database';

export async function requireAuth(): Promise<{ user: User; authUser: { id: string; email: string } }> {
  const authClient = await createClient();

  let authUser;
  try {
    const { data } = await authClient.auth.getUser();
    authUser = data.user;
  } catch (e) {
    console.error('requireAuth: auth check failed', e);
  }

  if (!authUser) {
    redirect('/login');
  }

  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  // If user row is missing, build a fallback so we don't redirect to
  // /login (which creates a loop when middleware sees valid cookies).
  const resolvedUser = (user as User) ?? ({
    id: authUser.id,
    email: authUser.email ?? '',
    full_name: authUser.email ?? 'User',
    role: 'agent' as const,
    agency_name: null,
    logo_url: null,
    whatsapp_number: null,
    default_currency: 'INR',
    default_payment_terms: null,
    margin_threshold_pct: 12,
    rounding_unit: 0,
    max_active_leads: 10,
    tc_content: null,
    tc_version: 1,
    created_at: new Date().toISOString(),
  } as User);

  return { user: resolvedUser, authUser: { id: authUser.id, email: authUser.email! } };
}

export async function requireSuperAdmin(): Promise<{ user: User; authUser: { id: string; email: string } }> {
  const result = await requireAuth();

  if (result.user.role !== 'super_admin') {
    redirect('/');
  }

  return result;
}

export async function requireRole(role: 'agent' | 'manager' | 'super_admin'): Promise<{ user: User; authUser: { id: string; email: string } }> {
  const result = await requireAuth();

  if (result.user.role !== role && result.user.role !== 'super_admin') {
    redirect('/');
  }

  return result;
}

export async function requireManagerOrAdmin(): Promise<{ user: User; authUser: { id: string; email: string } }> {
  const result = await requireAuth();

  if (result.user.role !== 'super_admin' && result.user.role !== 'manager') {
    redirect('/');
  }

  return result;
}
