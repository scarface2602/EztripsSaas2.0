import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

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
      return NextResponse.redirect(new URL('/', request.url));
    }
    return supabaseResponse;
  }

  // Protected routes
  const { user, supabaseResponse } = await updateSession(request);

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Admin routes — check role via user metadata or DB
  if (pathname.startsWith('/admin')) {
    // Role check happens at page level via requireSuperAdmin()
    // Middleware just ensures authentication
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
