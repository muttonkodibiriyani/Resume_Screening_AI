/**
 * Double-submit CSRF token.
 *
 * - On any GET response, set a `csrf-token` cookie (httpOnly: false so JS can read it).
 * - Browser code copies it into the `X-CSRF-Token` header on mutating requests.
 * - The server verifies the header matches the cookie.
 *
 * Safe across origins because an attacker cannot read the victim's cookie
 * to fill the header (Same-Origin Policy).
 */
import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = 'csrf-token';
export const CSRF_HEADER = 'x-csrf-token';

export function getOrSetCsrfToken(): string {
  const existing = cookies().get(COOKIE)?.value;
  if (existing && existing.length === 64) return existing;
  const fresh = randomBytes(32).toString('hex');
  cookies().set(COOKIE, fresh, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return fresh;
}

export function verifyCsrf(headerValue: string | null): boolean {
  if (!headerValue) return false;
  const cookieValue = cookies().get(COOKIE)?.value;
  if (!cookieValue || cookieValue.length !== headerValue.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(headerValue));
  } catch {
    return false;
  }
}
