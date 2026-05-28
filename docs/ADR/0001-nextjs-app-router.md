# ADR-0001: Use Next.js App Router

- **Status**: Accepted (2026-04)
- **Owners**: Platform team

## Context
We need a full-stack TypeScript framework that supports React Server Components,
streaming responses (for the upload progress), file-based routing, edge
middleware (for auth + CSP), and an SSR / RSC hybrid for fast first paints.

## Decision
Adopt **Next.js 15 App Router** with the `(app)` route group for the
authenticated surface, route handlers under `src/app/api/`, and edge middleware
at `src/middleware.ts`.

## Consequences
- We use React Server Components by default and add `'use client'` only when a
  page needs hooks or interactivity.
- Mutations go through route handlers wrapped with `apiHandler()` for uniform
  error handling.
- Streaming NDJSON works out of the box (the upload route).
- We accept the App Router learning curve and the somewhat noisy migration
  story for any future Next.js majors.
