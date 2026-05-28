// Vitest global setup. Provides default env so libs can import without process.env munging.
// `NODE_ENV` is typed as a readonly literal on `process.env`; cast to a mutable record to set it for tests.
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV ??= 'test';
env.DATABASE_URL ??= 'file:./test.db';
env.AUTH_SECRET ??= 'test-secret-must-be-at-least-32-chars-long-1234567890';
env.AUTH_PROVIDER ??= 'local';
env.STORAGE_PROVIDER ??= 'local';
env.QUEUE_PROVIDER ??= 'memory';
env.DATABASE_PROVIDER ??= 'sqlite';
