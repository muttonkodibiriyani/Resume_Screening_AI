# ADR-0007: Typed AIError for every AI call

- **Status**: Accepted (2026-04)
- **Owners**: Platform team

## Context
Before this overhaul, every AI failure was swallowed into "AI call failed, fell
back to local rule". Recruiters had no idea whether the key was wrong, the
model was deprecated, or the quota was blown.

## Decision
All AI providers raise a typed `AIError` (`src/lib/ai/errors.ts`) with a
discriminated `kind`:

```ts
type AIErrorKind =
  | 'not_configured' | 'model_not_found' | 'quota_exceeded' | 'rate_limited'
  | 'timeout' | 'invalid_json' | 'auth_failed' | 'network' | 'unknown';
```

`classifyError(provider, err)` normalises any raw provider error into this
shape. The UI surfaces `hint` directly.

## Consequences
- The model-not-found case is what unblocked the `gemini-1.5-flash`
  deprecation incident — the platform self-heals via `resolveModel()` cache
  invalidation.
- Logging is consistent: AICall rows carry `errorKind` so we can dashboard the
  failure modes.
- Adding a new provider is a 30-line job: implement `callX`, wrap with
  `classifyError('x', err)`.
