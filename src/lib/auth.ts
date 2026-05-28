/**
 * Hardened local auth for the MVP.
 *
 * - Session cookie is a SIGNED JWT (jose, HS256) carrying { sub: userId, role, exp }.
 *   Knowing a user ID is NOT enough to spoof a session.
 * - Cookie is httpOnly, sameSite=lax, secure in prod, __Host- prefixed in prod.
 * - bcrypt cost factor 12.
 * - Centralised RBAC lives in ./rbac.ts; this module only validates identity.
 *
 * Production swap: set AUTH_PROVIDER=entra and the NextAuth Entra ID provider
 * in src/lib/auth/providers/entra.ts will take over (same SessionUser shape).
 */
import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { env } from './env';
import { logger } from './logger';
import type { Role } from './rbac';

export const BCRYPT_COST = 12;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface JWTPayload {
  sub: string;
  role: Role;
  name: string;
  email: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

function cookieName(): string {
  const base = env().AUTH_COOKIE_NAME;
  return process.env.NODE_ENV === 'production' ? `__Host-${base}` : base;
}

async function signSession(user: SessionUser): Promise<string> {
  const ttlSec = env().AUTH_SESSION_TTL_HOURS * 3600;
  return await new SignJWT({ sub: user.id, role: user.role, name: user.name, email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('alshaya-ai-recruit')
    .setAudience('alshaya-ai-recruit')
    .setExpirationTime(`${ttlSec}s`)
    .sign(secretKey());
}

async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'alshaya-ai-recruit',
      audience: 'alshaya-ai-recruit',
    });
    const p = payload as unknown as JWTPayload;
    if (!p.sub || !p.role) return null;
    return { id: p.sub, email: p.email, name: p.name, role: p.role };
  } catch (err) {
    logger.debug('session token verification failed', { err: String(err) });
    return null;
  }
}

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    // Run bcrypt once anyway to mitigate timing attacks
    await bcrypt.compare(password, '$2a$12$0000000000000000000000.0000000000000000000000000000');
    return null;
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
  };

  const token = await signSession(sessionUser);
  const isProd = process.env.NODE_ENV === 'production';

  cookies().set(cookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: env().AUTH_SESSION_TTL_HOURS * 3600,
  });

  return sessionUser;
}

export async function logout(): Promise<void> {
  cookies().delete(cookieName());
}

/**
 * Returns the current session user, or null. Validated against DB to ensure
 * the user still exists (defence against deleted users with stale cookies).
 */
export async function getSession(): Promise<SessionUser | null> {
  const c = cookies().get(cookieName());
  if (!c?.value) return null;
  const payload = await verifySession(c.value);
  if (!payload) return null;
  // Confirm user still exists & role hasn't changed.
  const fresh = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!fresh) return null;
  return { id: fresh.id, email: fresh.email, name: fresh.name, role: fresh.role as Role };
}

export async function requireAuth(): Promise<SessionUser> {
  const u = await getSession();
  if (!u) throw new AuthError('UNAUTHENTICATED', 'Authentication required');
  return u;
}

export class AuthError extends Error {
  readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';
  readonly status: number;
  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN', message: string) {
    super(message);
    this.code = code;
    this.status = code === 'UNAUTHENTICATED' ? 401 : 403;
  }
}

/** Capture the caller's IP from standard proxy headers; falls back to "unknown". */
export function callerIp(): string {
  const h = headers();
  return (
    h.get('cf-connecting-ip') || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  );
}
