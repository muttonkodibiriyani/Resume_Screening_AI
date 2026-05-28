# ADR-0003: Local mock auth, Microsoft Entra ID in production

- **Status**: Accepted (2026-04)
- **Owners**: Platform team, Security

## Context
We need to ship the MVP without standing up enterprise SSO, but production
inside Alshaya must use **Microsoft Entra ID** with conditional access and
group-based role claims.

## Decision
- Default `AUTH_PROVIDER=local` uses a hardened mock backed by bcrypt+JWT cookie.
- `AUTH_PROVIDER=entra` (planned v1.1) uses NextAuth v5 with the Microsoft
  Entra ID provider; group claims map to the RBAC roles in `src/lib/rbac.ts`.

## Consequences
- The route handlers and middleware never call the provider directly — they
  call `getSession()`/`requireAuth()` so swapping the backend is a one-file
  change.
- The cookie format (`__Host-session`) is identical across providers, so the
  CSRF flow is unchanged.
- For local development we keep 5 demo seed users (one per RBAC role).
