# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-05-29 — Full overhaul

### Fixed
- **Critical**: Gemini `gemini-1.5-flash` 404 from upstream deprecation. Default
  model is now `gemini-2.5-flash` and the runtime auto-detects the best
  available `flash` model via a probe of `GET /v1beta/models`.
- AI failures are now surfaced as typed `AIError` (`kind`, `provider`, `status`,
  `hint`) instead of being silently swallowed into "local rule".
- `estimateYears` now prioritises explicit "X years" tokens, then date-range
  sums, then year-spread fallback.
- `findTemplateByRole` rewritten as token-overlap match instead of brittle
  `includes` chain.
- `normalizeAIScore` clamps every breakdown component to its weight and
  validates AI `overallScore` against the clamped sum.
- DELETE candidate authorization fix (was missing RBAC).

### Added
- **Security foundation**
  - Edge middleware (`src/middleware.ts`) with CSP, HSTS (prod),
    X-Frame-Options, Referrer-Policy, Permissions-Policy.
  - Signed JWT cookies via `jose`; `__Host-` prefix in prod; bcrypt cost 12.
  - Centralised RBAC matrix (`src/lib/rbac.ts`).
  - Double-submit CSRF (`src/lib/csrf.ts`).
  - In-memory token-bucket rate limiter (`src/lib/rate-limit.ts`) on login,
    upload, and benchmark creation.
  - Server-side MIME sniffing for resume uploads (`file-type`).
  - IP capture in `AuditLog.ipAddress`.
- **Architecture**
  - Storage abstraction (`src/lib/storage/`): local FS + Azure Blob driver.
  - Queue abstraction (`src/lib/queue/`): in-process + Azure Service Bus.
  - Telemetry shim (`src/lib/telemetry.ts`) bridging to Application Insights.
  - Postgres-ready Prisma schema (`prisma/schema.postgres.prisma`) +
    migration script (`scripts/migrate-to-postgres.ts`).
  - Standalone Next.js output for slim Docker images.
- **Upload pipeline**
  - Streamed NDJSON response with bounded concurrency (`p-limit(3)`).
  - Per-file `prisma.$transaction` for atomicity.
  - Real-time per-file UI status.
  - Original-file persistence + secure `/api/candidates/:id/resume` download.
- **Scoring lifecycle**
  - `POST /api/candidates/:id/rescore` action.
  - `bumpVersion` action on benchmarks.
  - Score result snapshots: `modelUsed`, `promptVersion`, `weightsSnapshot`,
    `benchmarkVersionAtScore`.
- **UX redesign**
  - New design system (`globals.css` + `tailwind.config.ts`): HSL tokens,
    elevation, motion curves, Inter Display + JetBrains Mono.
  - Dark mode with system / light / dark toggle, persisted.
  - Framer-motion page transitions and per-toast animations.
  - Radix-based UI primitives (`Dialog`, `Sheet`, `Tabs`, `Tooltip`,
    `DropdownMenu`, `Switch`).
  - Global Command Palette (Cmd/Ctrl + K).
  - Responsive App Shell with collapsible sidebar + mobile Sheet.
  - Redesigned pages: dashboard, upload, ranking (podium), candidate detail
    (3-pane + radial chart), benchmark detail (tabs + weight editor), audit,
    reports, login.
  - New `/insights` bias + cost dashboard.
  - `loading.tsx`, `error.tsx`, and `not-found.tsx` per route group.
- **Tooling**
  - Vitest + Testing Library unit tests for `rule-engine`, `templates`,
    `json-parse`, `normalize-ai-score`, `extractor`.
  - Playwright E2E for the auth flow (extensible).
  - Prettier + `prettier-plugin-tailwindcss`, ESLint flat config, Husky +
    lint-staged.
  - TypeScript `strict: true`, `noUncheckedIndexedAccess: true`,
    `exactOptionalPropertyTypes: true`.
- **Infrastructure & CI/CD**
  - Multi-stage Dockerfile (non-root, tini, healthcheck).
  - `infra/docker-compose.yml` for one-command prod-like local stack.
  - Bicep `infra/azure/main.bicep` provisioning App Service + Postgres + Blob
    + Key Vault + App Insights + Service Bus + Front Door + WAF + Managed
    Identity role assignments.
  - Bash + PowerShell deploy scripts.
  - Kubernetes alternative manifests under `infra/k8s/`.
  - GitHub Actions: `ci.yml`, `cd.yml` (OIDC), `codeql.yml`.
  - Dependabot weekly groups, CODEOWNERS, PR and issue templates.
- **Documentation**
  - PRD, ARCHITECTURE (with mermaid), SECURITY (STRIDE),
    SCORING_ALGORITHM (deep dive), AI_PROMPTING, AI_MODELS, USER_GUIDE
    (5 personas), ADMIN_GUIDE, DEVELOPER, AZURE_DEPLOYMENT, API, RUNBOOK,
    seven ADRs, CONTRIBUTING, CODE_OF_CONDUCT, LICENSE, new README.

### Changed
- All API routes refactored through `apiHandler` wrapper for consistent error
  shape and RBAC enforcement.
- Inputs validated against Zod schemas in `src/lib/validation/`.
- `formatBytes` now reports up to TB.
- AICall row written on every AI invocation for cost / latency telemetry.

### Removed
- `(window as any).__toast` global — replaced by Zustand store in
  `src/components/ui/toast-store.ts`.
- Fake `setTimeout` upload progress on the upload page.
- Dead `as any` `orderBy` clause in the reports route.

---

## [0.x] — pre-overhaul

The pre-overhaul history is preserved in git; see the `pre-overhaul` tag.
