# ADR-0002: SQLite for local, Postgres for production

- **Status**: Accepted (2026-04)
- **Owners**: Platform team

## Context
Engineers must be able to run the platform on a laptop with zero infra. Production
needs concurrency, native JSON, indexes, PITR backups, and Azure-native
operations.

## Decision
Maintain two Prisma schemas:
- `prisma/schema.prisma` — SQLite, default for local development.
- `prisma/schema.postgres.prisma` — PostgreSQL with `Json` columns, used in CI
  and prod.

`src/lib/db.ts` reads `DATABASE_PROVIDER` (`sqlite`|`postgresql`). The Dockerfile
overlays the Postgres schema during the production build.

## Consequences
- One-line developer onboarding.
- A small migration script (`scripts/migrate-to-postgres.ts`) drains data on
  first cloud cutover.
- We pay a tiny tax: keep the two schemas in sync via PR template checklist.
- We accept that SQLite cannot validate Postgres-only constraints
  (`@db.JsonB`, partial indexes); CI runs Prisma validate against both schemas.
