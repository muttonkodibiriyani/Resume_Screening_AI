// Vitest global setup. Provides default env so libs can import without process.env munging.
process.env.NODE_ENV ||= 'test';
process.env.DATABASE_URL ||= 'file:./test.db';
process.env.AUTH_SECRET ||= 'test-secret-must-be-at-least-32-chars-long-1234567890';
process.env.AUTH_PROVIDER ||= 'local';
process.env.STORAGE_PROVIDER ||= 'local';
process.env.QUEUE_PROVIDER ||= 'memory';
process.env.DATABASE_PROVIDER ||= 'sqlite';
