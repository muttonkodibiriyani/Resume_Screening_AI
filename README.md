# Alshaya AI Recruit

> AI-assisted resume screening for Alshaya Group — compare every applicant
> against an ideal-candidate benchmark, score with evidence, decide with
> humans in the loop.

[![CI](https://github.com/muttonkodibiriyani/Resume_Screening_AI/actions/workflows/ci.yml/badge.svg)](https://github.com/muttonkodibiriyani/Resume_Screening_AI/actions/workflows/ci.yml)
[![CodeQL](https://github.com/muttonkodibiriyani/Resume_Screening_AI/actions/workflows/codeql.yml/badge.svg)](https://github.com/muttonkodibiriyani/Resume_Screening_AI/actions/workflows/codeql.yml)
[![License](https://img.shields.io/badge/license-Proprietary-7F1D1D.svg)](./LICENSE)

---

## What it does

1. Turn a role brief into an **AI-generated ideal-candidate benchmark**
   (skills, expectations, red flags, interview pack, weights).
2. Drop up to **50 resumes** (PDF / DOCX / TXT) and watch real-time streamed
   scoring per file.
3. Get a **top-3 podium** + sortable ranking, every score traceable to evidence.
4. Hiring Manager / Recruiter records a **human decision** with a note. AI
   never advances or rejects on its own.
5. Audit trail and bias / cost insights are always one click away.

Multi-engine: **Google Gemini**, **Azure OpenAI**, and a deterministic
local-rule fallback so the platform is _never_ offline.

---

## Quickstart (Windows / macOS / Linux)

```sh
git clone https://github.com/muttonkodibiriyani/Resume_Screening_AI.git
cd Resume_Screening_AI/alshaya-ai-recruit
npm install
cp .env.sample .env.local
# Open .env.local and paste your GOOGLE_GEMINI_API_KEY + set AUTH_SECRET
npx prisma generate
npx prisma db push
npm run seed       # seeds the 5 demo accounts + sample benchmarks
npm run dev
# open http://localhost:3000  - sign in with admin@alshaya.com / password123
```

---

## Demo accounts (local)

| Email                   | Role            | What you can do               |
| ----------------------- | --------------- | ----------------------------- |
| `admin@alshaya.com`     | Admin           | Everything                    |
| `hiring@alshaya.com`    | Hiring Manager  | Approve, decide, report       |
| `recruiter@alshaya.com` | Recruiter       | Benchmarks, upload, decisions |
| `panel@alshaya.com`     | Interview Panel | Read-only candidate pack      |
| `viewer@alshaya.com`    | Viewer / SLT    | Read-only dashboard           |

Password for all: `password123`. Local-only — never use in production.

---

## Architecture in one diagram

```mermaid
flowchart LR
  ui[Next.js UI<br/>RSC + Radix + Tailwind] --> mw[Edge middleware<br/>CSP + CSRF + JWT]
  mw --> api[Route handlers]
  api --> rbac[RBAC + Rate-limit]
  api --> extract[Extractor<br/>pdf/docx/ocr]
  api --> score[Scoring engine<br/>rule + AI]
  api --> store[Storage<br/>local | Azure Blob]
  api --> db[(Postgres / SQLite)]
  score -.-> gem[Gemini]
  score -.-> aoi[Azure OpenAI]
```

Full deep-dive: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Documentation map

| Audience                             | Start here                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Product / business                   | [`docs/PRD.md`](./docs/PRD.md)                                                                |
| Recruiter / HM / Panel / Admin / SLT | [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md)                                                  |
| TA Ops Admin                         | [`docs/ADMIN_GUIDE.md`](./docs/ADMIN_GUIDE.md)                                                |
| Engineer                             | [`docs/DEVELOPER.md`](./docs/DEVELOPER.md)                                                    |
| Architect                            | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) + [`docs/ADR/`](./docs/ADR/)                 |
| Security                             | [`docs/SECURITY.md`](./docs/SECURITY.md)                                                      |
| Scoring deep dive                    | [`docs/SCORING_ALGORITHM.md`](./docs/SCORING_ALGORITHM.md)                                    |
| AI prompting                         | [`docs/AI_PROMPTING.md`](./docs/AI_PROMPTING.md) + [`docs/AI_MODELS.md`](./docs/AI_MODELS.md) |
| API consumer                         | [`docs/API.md`](./docs/API.md)                                                                |
| Azure deploy                         | [`docs/AZURE_DEPLOYMENT.md`](./docs/AZURE_DEPLOYMENT.md)                                      |
| On-call                              | [`docs/RUNBOOK.md`](./docs/RUNBOOK.md)                                                        |
| Release notes                        | [`CHANGELOG.md`](./CHANGELOG.md)                                                              |

---

## Tech stack

| Layer          | Choice                                                             |
| -------------- | ------------------------------------------------------------------ |
| Framework      | Next.js 15 (App Router, RSC) on Node.js 20                         |
| Language       | TypeScript (strict mode)                                           |
| UI             | React 18, Tailwind CSS, Radix UI, Framer Motion, cmdk              |
| Charts         | recharts                                                           |
| State (client) | Zustand, SWR                                                       |
| DB             | Prisma + SQLite (local) / PostgreSQL (prod)                        |
| Auth           | Signed JWT cookies (`jose`) + bcrypt; NextAuth + Entra ID scaffold |
| Storage        | Local FS or Azure Blob (drivers in `src/lib/storage/`)             |
| Queue          | In-process or Azure Service Bus                                    |
| AI             | Google Gemini SDK, Azure OpenAI, Tavily (research)                 |
| Observability  | App Insights (prod), structured logger (dev)                       |
| Tests          | Vitest + Playwright + Testing Library                              |
| Infra          | Docker, Bicep (App Service / PG / Blob / KV / SB / AFD), AKS alt   |
| CI/CD          | GitHub Actions (CI, CD with OIDC, CodeQL), Dependabot              |

---

## Running prod-like locally (Postgres + container)

```sh
cd infra
docker compose --env-file ../.env.docker up --build
# open http://localhost:3000
```

---

## Deploying to Azure

```sh
gh workflow run cd.yml -f environment=prod
```

See [`docs/AZURE_DEPLOYMENT.md`](./docs/AZURE_DEPLOYMENT.md) for the full bootstrap.

---

## Security

- Edge middleware: CSP, HSTS (prod), X-Frame-Options DENY, Referrer-Policy.
- Signed JWT cookies; `__Host-` prefix in prod; CSRF double-submit.
- RBAC central matrix in `src/lib/rbac.ts`.
- File MIME sniffed server-side; 10 MB / 50 files / request caps.
- Rate limits on login (5/min), upload (20/h), benchmark create (10/h).
- Protected attributes never scored.
- Full audit log with IP capture.

Found a vulnerability? Email **security@alshaya.com** — do not open a public issue.

---

## License

[Proprietary](./LICENSE) — Alshaya Group internal use only.
