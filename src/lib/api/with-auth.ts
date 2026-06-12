import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { User } from '@/lib/types/database';
import { hasPermission, type Permission } from '@/lib/auth/permissions';

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
/**
 * Drop-in for getUser()-style routes: resolves the auth user only when
 * the caller's role grants the permission (always resolves when no
 * permission is given). Returns null on any failure, like getUser did.
 */
export async function getAuthUser(permission?: Permission): Promise<{ id: string; email: string } | null> {
  const auth = await withAuth(undefined, permission ? { permission } : undefined);
  return auth instanceof NextResponse ? null : auth.authUser;
}

export async function withAuth(
  _request?: unknown,
  options?: {
    requiredRole?: 'agent' | 'super_admin';
    allowedRoles?: Array<User['role']>;
    /** Capability check against ROLE_PERMISSIONS — preferred over role lists. */
    permission?: Permission;
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

  // Permission check — the role → capability map in lib/auth/permissions
  if (options?.permission && !hasPermission(user.role, options.permission)) {
    return NextResponse.json(
      { error: `Forbidden — requires ${options.permission}` },
      { status: 403 },
    );
  }

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
