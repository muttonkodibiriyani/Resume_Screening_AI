/**
 * Typed AI errors. Surfaces the *real* reason an AI call failed so the UI can
 * show "model not found", "quota exceeded", "timeout" instead of swallowing
 * everything to a generic "local-rule" fallback.
 */

export type AIErrorKind =
  | 'not_configured'
  | 'model_not_found'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'timeout'
  | 'invalid_json'
  | 'auth_failed'
  | 'network'
  | 'unknown';

export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly provider: 'gemini' | 'azure-openai' | 'copilot-studio' | 'unknown';
  readonly status?: number;
  readonly hint?: string;

  constructor(opts: {
    kind: AIErrorKind;
    provider: AIError['provider'];
    message: string;
    status?: number;
    hint?: string;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = 'AIError';
    this.kind = opts.kind;
    this.provider = opts.provider;
    if (opts.status !== undefined) this.status = opts.status;
    if (opts.hint !== undefined) this.hint = opts.hint;
  }

  toJSON() {
    return {
      name: this.name,
      kind: this.kind,
      provider: this.provider,
      status: this.status,
      message: this.message,
      hint: this.hint,
    };
  }
}

export function classifyError(provider: AIError['provider'], err: unknown): AIError {
  if (err instanceof AIError) return err;
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('404') || lower.includes('not found') || lower.includes('is not found for api')) {
    return new AIError({
      kind: 'model_not_found',
      provider,
      message: raw,
      status: 404,
      hint: 'The configured model name is invalid or deprecated. Try gemini-2.5-flash or check GET /v1beta/models.',
      cause: err,
    });
  }
  if (lower.includes('429') || lower.includes('rate') || lower.includes('quota')) {
    return new AIError({
      kind: lower.includes('quota') ? 'quota_exceeded' : 'rate_limited',
      provider,
      message: raw,
      status: 429,
      hint: 'Slow down requests or upgrade the API plan.',
      cause: err,
    });
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('api key') || lower.includes('permission')) {
    return new AIError({
      kind: 'auth_failed',
      provider,
      message: raw,
      status: lower.includes('403') ? 403 : 401,
      hint: 'Check the API key is correct and has access to the requested model.',
      cause: err,
    });
  }
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('aborted')) {
    return new AIError({
      kind: 'timeout',
      provider,
      message: raw,
      hint: 'AI provider took too long. Try a smaller/faster model.',
      cause: err,
    });
  }
  if (lower.includes('fetch') || lower.includes('econnreset') || lower.includes('enotfound')) {
    return new AIError({
      kind: 'network',
      provider,
      message: raw,
      hint: 'Network error reaching the AI provider.',
      cause: err,
    });
  }
  return new AIError({ kind: 'unknown', provider, message: raw, cause: err });
}
