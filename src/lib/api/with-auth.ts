import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { User } from '@/lib/types/database';

export interface AuthResult {
  user: User;
  authUser: { id: string; email: string };
}

/**
 * API route auth wrapper. Returns user info or a NextResponse error.
 * Usage:
 *   const auth = await withAuth(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user, authUser } = auth;
 */
export async function withAuth(
  _request?: unknown,
  options?: {
    requiredRole?: 'agent' | 'super_admin';
    allowedRoles?: Array<User['role']>;
    checkOwnership?: {
      table: string;
      id: string;
    };
  }
): Promise<AuthResult | NextResponse> {
  const authClient = await createClient();
  const { data } = await authClient.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  const user = (dbUser as User) ?? ({
    id: data.user.id,
    email: data.user.email ?? '',
    full_name: data.user.email ?? 'User',
    role: 'agent' as const,
    agency_name: null,
    logo_url: null,
    whatsapp_number: null,
    default_currency: 'INR',
    default_payment_terms: null,
    margin_threshold_pct: 12,
    rounding_unit: 0,
    tc_content: null,
    tc_version: 1,
    created_at: new Date().toISOString(),
  } as User);

  // Role check — allowedRoles takes precedence over requiredRole
  if (options?.allowedRoles) {
    if (!options.allowedRoles.includes(user.role) && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (options?.requiredRole) {
    if (user.role !== options.requiredRole && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Ownership check
  if (options?.checkOwnership) {
    const { table, id } = options.checkOwnership;
    const { data: record } = await supabase
      .from(table)
      .select('created_by')
      .eq('id', id)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (record.created_by !== data.user.id && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return { user, authUser: { id: data.user.id, email: data.user.email! } };
}
