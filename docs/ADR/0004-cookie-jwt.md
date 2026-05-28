# ADR-0004: Cookie-based JWT sessions

- **Status**: Accepted (2026-04)
- **Owners**: Platform team, Security

## Context
We need a session mechanism that:
- works equally for browsers and (future) mobile,
- survives serverless / multi-instance App Service scale-out without sticky sessions,
- can be revoked in an outage,
- is CSRF-safe with minimal client glue.

## Decision
Sign session JWTs with `jose` (HS256, 32-byte `AUTH_SECRET`), store them in an
HTTP-only `__Host-session` cookie (prod) / `session` cookie (dev). Pair with a
double-submit CSRF cookie (`csrf-token`) for mutations.

## Consequences
- Zero session storage server-side.
- Token revocation is best-effort: rotate `AUTH_SECRET` (and the planned
  `AUTH_SECRET_PREV` dual-key window) to invalidate all sessions.
- Cookie size is small (~ 400 bytes).
- Mobile clients can read the cookie via `Set-Cookie` and follow the same CSRF
  flow as the browser fetcher.
