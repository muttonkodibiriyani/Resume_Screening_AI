/**
 * Centralised, typed environment access. Single source of truth.
 * Throws fast at startup if required values are missing.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Alshaya AI Recruit'),

  DATABASE_PROVIDER: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  DATABASE_URL: z.string().min(1),

  AUTH_PROVIDER: z.enum(['local', 'entra']).default('local'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
  AUTH_COOKIE_NAME: z.string().default('alshaya_session'),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),

  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_CLIENT_SECRET: z.string().optional(),

  STORAGE_PROVIDER: z.enum(['local', 'azure-blob']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./uploads'),
  AZURE_BLOB_CONNECTION_STRING: z.string().optional(),
  AZURE_BLOB_CONTAINER: z.string().default('resumes'),

  QUEUE_PROVIDER: z.enum(['memory', 'service-bus']).default('memory'),
  AZURE_SERVICE_BUS_CONNECTION_STRING: z.string().optional(),
  AZURE_SERVICE_BUS_QUEUE: z.string().default('scoring-jobs'),

  GOOGLE_GEMINI_API_KEY: z.string().optional().transform((v) => v || undefined),
  GOOGLE_GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  AZURE_OPENAI_API_KEY: z.string().optional().transform((v) => v || undefined),
  AZURE_OPENAI_ENDPOINT: z.string().optional().transform((v) => v || undefined),
  AZURE_OPENAI_DEPLOYMENT: z.string().default('gpt-4o-mini'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-08-01-preview'),
  TAVILY_API_KEY: z.string().optional().transform((v) => v || undefined),
  AZURE_DOC_INTELLIGENCE_ENDPOINT: z.string().optional().transform((v) => v || undefined),
  AZURE_DOC_INTELLIGENCE_KEY: z.string().optional().transform((v) => v || undefined),
  COPILOT_STUDIO_WEBHOOK_URL: z.string().optional().transform((v) => v || undefined),
  COPILOT_STUDIO_API_KEY: z.string().optional().transform((v) => v || undefined),

  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\n\nCheck .env.local against .env.sample.`);
  }
  cached = parsed.data;
  return cached;
}

// Resets the cache in tests
export function _resetEnvCache(): void {
  cached = null;
}
