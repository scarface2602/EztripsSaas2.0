import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { hasPermission, pathPermission } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/permissions';

const PUBLIC_PATHS = [
  '/p/',
  '/api/auth/',
  '/api/webhooks/',
  '/api/website/',
  '/invite/',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  // Allow auth pages
  if (pathname.startsWith('/login')) {
    // If the dashboard redirected here via ?auth_error, let the user
    // see the login page even if cookies still look valid — this
    // prevents an infinite redirect loop.
    if (request.nextUrl.searchParams.has('auth_error')) {
      const { supabaseResponse } = await updateSession(request);
      return supabaseResponse;
    }
    const { user, supabaseResponse } = await updateSession(request);
    if (user) {
      return NextResponse.redirect(new URL('/leads', request.url));
    }
    return supabaseResponse;
  }

  // Protected routes
  const { user, supabase, supabaseResponse } = await updateSession(request);

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role gating — only pages whose prefix is in PATH_PERMISSIONS cost a
  // role lookup; everything else passes straight through. API routes
  // enforce their own permissions via withAuth.
  const required = pathname.startsWith('/api') ? null : pathPermission(pathname);
  if (required) {
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!hasPermission((dbUser?.role as Role) || 'agent', required)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
