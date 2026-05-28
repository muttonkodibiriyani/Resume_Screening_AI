# Developer guide

This guide is for engineers contributing to the platform.

---

## 1. Prerequisites

- Node.js **20.x** (use `nvm install 20` or `volta`).
- npm **10.x**.
- Git.
- Optional: Docker Desktop (only needed for prod-like Postgres / image tests).
- Optional: a Google AI Studio API key for Gemini (free tier is fine for dev).

---

## 2. First-time setup

```sh
# 1. Clone
git clone https://github.com/muttonkodibiriyani/Resume_Screening_AI.git
cd Resume_Screening_AI

# 2. Install
npm install

# 3. Configure
cp .env.sample .env.local
# Edit .env.local: paste GOOGLE_GEMINI_API_KEY, set AUTH_SECRET to a long random string.

# 4. Initialise the local SQLite DB
npx prisma generate
npx prisma db push

# 5. Seed demo accounts and benchmarks
npm run seed

# 6. Run
npm run dev
# open http://localhost:3000
```

---

## 3. Repo structure

```
.
├── infra/                 # Dockerfile, docker-compose, Bicep, k8s, deploy scripts
├── docs/                  # Documentation (this folder)
├── prisma/
│   ├── schema.prisma            # SQLite (local default)
│   └── schema.postgres.prisma   # Postgres (production)
├── public/
├── sample-resumes/        # Used by the rule-engine golden-file tests
├── scripts/               # One-off scripts (seed, migrate-to-postgres, ...)
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (app)/         # Authenticated pages (route group)
│   │   ├── api/           # Route handlers
│   │   └── login/
│   ├── components/
│   │   └── ui/            # Radix + Tailwind primitives
│   ├── lib/
│   │   ├── ai/            # gemini, azure-openai, errors, json-parse
│   │   ├── benchmarks/    # generator, templates
│   │   ├── extraction/    # pdf/docx/ocr extractor
│   │   ├── queue/         # in-process + Service Bus drivers
│   │   ├── scoring/       # rule-engine, ai-engine, types
│   │   ├── storage/       # local-fs + azure-blob drivers
│   │   ├── validation/    # zod schemas
│   │   ├── api.ts         # route helper + apiHandler wrapper
│   │   ├── api-client.ts  # browser-side fetcher with CSRF
│   │   ├── auth.ts        # cookie JWT + bcrypt
│   │   ├── csrf.ts
│   │   ├── env.ts         # zod-validated env
│   │   ├── logger.ts
│   │   ├── rate-limit.ts
│   │   ├── rbac.ts
│   │   └── telemetry.ts
│   └── middleware.ts      # Edge middleware
├── tests/
│   ├── unit/              # Vitest
│   └── e2e/               # Playwright
├── .github/workflows/     # CI, CD, CodeQL
└── package.json
```

---

## 4. npm scripts

```sh
npm run dev          # next dev (Turbopack)
npm run build        # next build (standalone output)
npm run start        # next start (after build)

npm run lint         # ESLint
npm run lint:fix     # ESLint --fix
npm run format       # Prettier write
npm run format:check # Prettier check
npm run typecheck    # tsc --noEmit

npm run test         # Vitest (CLI)
npm run test:watch   # Vitest watch
npm run test:ui      # Vitest UI
npm run test:e2e     # Playwright

npm run seed         # Seed demo users + benchmarks (local SQLite)
npm run db:migrate:postgres  # Run prisma migrate deploy against Postgres
```

---

## 5. Conventions

- **TypeScript strict**: `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`.
- **No `any`** — use generic helpers (`apiFetch<T>`, `jsonParse<T>`) and Zod
  schemas with `z.infer<typeof Schema>`.
- **Route handlers** wrap their body in `apiHandler(async (req) => ...)` from
  `src/lib/api.ts` so errors are translated to RFC 7807-ish JSON automatically.
- **Mutations** are always POST/PATCH/DELETE and require CSRF + permission.
- **No protected attributes** in any prompt, extractor, or score.
- **Conventional Commits** — `fix(scope): ...`, `feat(scope): ...`,
  `docs(scope): ...`, etc.
- **Branch model** — short-lived feature branches, PR into `main`, squash-merge.

---

## 6. Testing strategy

- **Unit tests** (Vitest) live next to the module under `tests/unit/`. We have
  golden-file tests for `rule-engine` and `extractor`, plus fuzz-style tests for
  `parseAIJson`.
- **Integration**: We run the full upload+score pipeline against SQLite under
  `tests/integration/`.
- **E2E** (Playwright) covers login → benchmark → upload → score → decide →
  report download.
- **CI** runs all three on every PR. Coverage report (Vitest v8) is uploaded
  as an artifact.

---

## 7. Working with Prisma

```sh
npx prisma studio         # GUI for the local SQLite
npx prisma db push        # Sync schema (no migration files)
npx prisma migrate dev    # When you start tracking migrations (postgres)
```

To work with the Postgres schema locally without Docker:

```sh
docker run --name pg-recruit -e POSTGRES_USER=recruit -e POSTGRES_PASSWORD=recruit -e POSTGRES_DB=recruit -p 5432:5432 -d postgres:16-alpine
cp prisma/schema.postgres.prisma prisma/schema.prisma
export DATABASE_PROVIDER=postgresql
export DATABASE_URL='postgresql://recruit:recruit@localhost:5432/recruit?schema=public'
npx prisma migrate dev --name init
```

---

## 8. Adding a new AI provider

1. Implement `callX(prompt: string, opts)` in `src/lib/ai/x.ts`.
2. Wrap all SDK errors with `classifyError('x', err)` from `errors.ts`.
3. Add the env vars to `src/lib/env.ts` (Zod schema).
4. Expose a probe function and surface it in `/api/system/status`.
5. Add a row to `Settings → Provider configuration`.
6. Update [`AI_PROMPTING.md`](./AI_PROMPTING.md) with a model matrix.
