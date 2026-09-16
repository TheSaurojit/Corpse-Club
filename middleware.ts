import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwt } from '@/lib/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Guard all /admin routes
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('corpse_admin_session');

    if (!sessionCookie || !sessionCookie.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Cryptographically verify custom JWT signature & expiration
    const payload = await verifyAdminJwt(sessionCookie.value);

    if (!payload || !payload.email) {
      // Tampered, expired, or invalid JWT -> clear cookie and bounce to /login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('corpse_admin_session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
