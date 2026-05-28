/**
 * Browser-side typed fetcher. Reads the CSRF cookie set by middleware and
 * forwards it on every mutating request.
 */

export interface FetchOptions extends RequestInit {
  /** Auto-attach the CSRF token on POST/PATCH/DELETE. Defaults true. */
  csrf?: boolean;
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    if (code !== undefined) this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export async function apiFetch<T = unknown>(input: string, init: FetchOptions = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (isMutation && init.csrf !== false) {
    const csrf = getCsrfToken();
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const res = await fetch(input, { ...init, headers, credentials: 'same-origin' });
  if (!res.ok) {
    let body: { error?: string; code?: string; details?: unknown } = {};
    try {
      body = await res.json();
    } catch {
      /* non-json */
    }
    throw new ApiError(res.status, body.error || `Request failed (${res.status})`, body.code, body.details);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? ((await res.json()) as T) : ((await res.text()) as unknown as T);
}

export const fetcher = <T>(url: string): Promise<T> => apiFetch<T>(url);
