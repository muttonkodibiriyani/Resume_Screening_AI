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

const COOKIE = 'csrf-token';
export const CSRF_HEADER = 'x-csrf-token';

/** Web-Crypto-only random hex generator (works in both Edge and Node runtimes). */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += arr[i]!.toString(16).padStart(2, '0');
  return out;
}

/** Constant-time string comparison without `node:crypto`. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function getOrSetCsrfToken(): string {
  const existing = cookies().get(COOKIE)?.value;
  if (existing && existing.length === 64) return existing;
  const fresh = randomHex(32);
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
  if (!cookieValue) return false;
  return constantTimeEqual(cookieValue, headerValue);
}
