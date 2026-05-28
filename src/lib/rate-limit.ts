/**
 * In-process token-bucket rate limiter.
 *
 * For single-instance deployments (local, Azure App Service single instance)
 * this is sufficient. For multi-instance, swap to @upstash/ratelimit by
 * checking UPSTASH_REDIS_REST_URL - documented in docs/SECURITY.md.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL = 60 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number, ttl: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > ttl) buckets.delete(key);
  }
  lastCleanup = now;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export interface RateLimitOptions {
  /** Unique limiter id, e.g. "login" */
  name: string;
  /** Max tokens in the bucket. */
  capacity: number;
  /** Refill all tokens every `windowMs` ms. */
  windowMs: number;
}

/**
 * Consume one token from the bucket keyed by `identifier` (IP, userId, etc).
 */
export function rateLimit(identifier: string, opts: RateLimitOptions): RateLimitResult {
  const key = `${opts.name}:${identifier}`;
  const now = Date.now();
  cleanup(now, opts.windowMs * 4);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: opts.capacity, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed >= opts.windowMs) {
    bucket.tokens = opts.capacity;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return { allowed: false, remaining: 0, resetMs: opts.windowMs - elapsed };
  }

  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens, resetMs: opts.windowMs - elapsed };
}

export const LIMITS = {
  login: { name: 'login', capacity: 5, windowMs: 60_000 },
  uploadFiles: { name: 'upload', capacity: 20, windowMs: 60 * 60_000 },
  benchmarkCreate: { name: 'benchmark_create', capacity: 10, windowMs: 60 * 60_000 },
  apiGeneral: { name: 'api', capacity: 300, windowMs: 60_000 },
} as const;
