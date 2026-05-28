/**
 * Lightweight API route helpers.
 *
 * - `apiHandler(handler)` - catches AuthError, ZodError, generic errors and
 *   returns a JSON shape every page understands.
 * - `parseJson(req, schema)` - typed body parsing.
 * - `parseQuery(req, schema)` - typed search-params parsing.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { AuthError } from './auth';
import { AIError } from './ai/errors';
import { CSRF_HEADER, verifyCsrf } from './csrf';
import { logger } from './logger';

/** HTTP methods that mutate server state and must carry a valid CSRF token. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Bypass list for the CSRF guard:
 * - /api/auth/login: the user has no session/cookie yet, so the double-submit
 *   pattern can't apply. Brute-force is bounded by rate-limit + bcrypt cost.
 * The middleware sets the CSRF cookie on the GET to /login, so any subsequent
 * mutating request from the SPA already has the token to echo.
 */
const CSRF_BYPASS = ['/api/auth/login'];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_BYPASS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export type ApiHandler = (
  req: NextRequest,
  ctx: { params: Record<string, string> },
) => Promise<NextResponse> | NextResponse;

export function apiHandler(handler: ApiHandler): ApiHandler {
  return async (req, ctx) => {
    try {
      // Double-submit CSRF check for mutating requests. Cookie is set by the
      // edge middleware on every GET; the SPA echoes it in `x-csrf-token`.
      if (MUTATING_METHODS.has(req.method)) {
        const { pathname } = new URL(req.url);
        if (!isCsrfExempt(pathname)) {
          const header = req.headers.get(CSRF_HEADER);
          if (!verifyCsrf(header)) {
            return NextResponse.json<ApiError>(
              { error: 'Missing or invalid CSRF token', code: 'CSRF_FAILED' },
              { status: 403 },
            );
          }
        }
      }
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json<ApiError>({ error: err.message, code: err.code }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json<ApiError>(
          { error: 'Validation failed', code: 'VALIDATION_ERROR', details: err.flatten() },
          { status: 400 },
        );
      }
      if (err instanceof AIError) {
        return NextResponse.json<ApiError>(
          {
            error: err.message,
            code: `AI_${err.kind.toUpperCase()}`,
            details: { provider: err.provider, hint: err.hint },
          },
          { status: err.status ?? 502 },
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error('unhandled api error', { url: req.url, message });
      return NextResponse.json<ApiError>({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
  };
}

export async function parseJson<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ZodError([{ code: 'custom', path: [], message: 'Body is not valid JSON' }]);
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: NextRequest, schema: ZodSchema<T>): T {
  const obj: Record<string, string> = {};
  const url = new URL(req.url);
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return schema.parse(obj);
}
