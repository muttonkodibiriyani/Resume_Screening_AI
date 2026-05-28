/**
 * Edge middleware:
 *   1. Adds security headers to every response.
 *   2. Stamps a CSRF cookie on every GET if missing.
 *   3. Blocks unauthenticated access to /(app)/* and most /api/* routes.
 *
 * Note: Heavy auth (DB lookup, role check) happens inside route handlers via
 * requireAuth/requirePermission. Middleware does the cheap session-cookie
 * presence check only - keeps the edge fast.
 */
import { NextResponse, type NextRequest } from 'next/server';

/** Edge-compatible random hex generator (Web Crypto, not node:crypto). */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += arr[i]!.toString(16).padStart(2, '0');
  return out;
}

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/system/status',
  '/_next',
  '/favicon.ico',
  '/icon.svg',
  '/manifest.json',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith('/api/') && !PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isProtectedApp(pathname: string): boolean {
  if (pathname === '/') return true; // redirects to /dashboard or /login server-side
  // Anything outside login/api/static is a protected app page.
  if (pathname.startsWith('/api/')) return false;
  if (pathname === '/login') return false;
  if (pathname.startsWith('/_next/')) return false;
  return true;
}

function securityHeaders(res: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === 'production';
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (isProd) {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  // Relaxed CSP: app uses inline styles (Tailwind), Google Fonts, and self.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

function ensureCsrfCookie(req: NextRequest, res: NextResponse): void {
  const existing = req.cookies.get('csrf-token')?.value;
  if (existing && existing.length === 64) return;
  const token = randomHex(32);
  res.cookies.set('csrf-token', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Heuristic session presence check (real verification happens in route handlers / RSCs).
  const cookieName = process.env.NODE_ENV === 'production' ? '__Host-alshaya_session' : 'alshaya_session';
  const hasSession = !!req.cookies.get(cookieName)?.value;

  // Block protected app pages: redirect to /login
  if (!hasSession && isProtectedApp(pathname) && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', pathname);
    const res = NextResponse.redirect(url);
    return securityHeaders(res);
  }

  // Block protected API: 401 JSON
  if (!hasSession && isProtectedApi(pathname)) {
    const res = NextResponse.json({ error: 'Authentication required', code: 'UNAUTHENTICATED' }, { status: 401 });
    return securityHeaders(res);
  }

  const res = NextResponse.next();
  if (req.method === 'GET') ensureCsrfCookie(req, res);
  return securityHeaders(res);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
