# Architecture

This document covers system context, container view, component view, key sequences,
and the local-vs-Azure deployment topology. All diagrams are inline mermaid so they
render in GitHub.

---

## 1. System context

```mermaid
flowchart LR
    user[User<br/>Recruiter / HM / Panel / Admin / SLT] -->|HTTPS| edge[Front Door + WAF]
    edge --> app[Alshaya AI Recruit<br/>Next.js App]
    app --> db[(Postgres /<br/>SQLite)]
    app --> blob[(Azure Blob /<br/>Local FS)]
    app --> kv[[Key Vault]]
    app --> appi[[Application<br/>Insights]]
    app --> gem[Google<br/>Gemini API]
    app --> aoi[Azure<br/>OpenAI]
    app --> tav[Tavily<br/>Search API]
    app --> docint[Azure<br/>Doc Intelligence]
    app -.-> sb[(Service Bus<br/>scoring-jobs)]
```

---

## 2. Container view

```mermaid
flowchart TB
    subgraph Browser
        ui[Next.js UI<br/>React + Tailwind + Radix]
    end

    subgraph Edge
        mw[Edge middleware<br/>CSP / CSRF / Auth gate]
    end

    subgraph App["Next.js Runtime (App Service / AKS)"]
        rsc[Server Components<br/>RSC + Suspense]
        api[Route Handlers<br/>/api/*]
        scoring[Scoring engine<br/>rule + AI]
        bench[Benchmark engine<br/>template + AI]
        extract[Extraction<br/>pdf-parse / mammoth / OCR]
        storage[Storage driver<br/>local / azure-blob]
        queue[Queue driver<br/>memory / service-bus]
        rbac[RBAC + Auth<br/>JWT cookies]
        telem[Telemetry<br/>OTel / App Insights]
    end

    subgraph Data
        prisma[(Prisma ORM)]
        sqlite[(SQLite — local)]
        pg[(Postgres — prod)]
        files[(Original files)]
    end

    ui --> mw --> rsc
    ui --> mw --> api
    rsc --> prisma
    api --> rbac
    api --> scoring
    api --> bench
    api --> extract
    api --> storage
    scoring --> queue
    bench --> queue
    storage --> files
    prisma --> sqlite
    prisma --> pg
    api --> telem
```

---

## 3. Component view (scoring path)

```mermaid
flowchart LR
    upload[POST /api/resumes/upload<br/>NDJSON stream] --> validate[MIME sniff +<br/>size + rate limit]
    validate --> persist[storage.save<br/>writes original]
    persist --> txn[(prisma.$transaction)]
    txn --> extract[extractor.ts<br/>pdf-parse / mammoth / OCR]
    extract --> scoringEngine{Engine?}
    scoringEngine -->|Gemini or AOAI configured| ai[scoreCandidate<br/>ai-engine.ts]
    scoringEngine -->|None or AI fails| rules[scoreWithRules<br/>rule-engine.ts]
    ai --> normalize[normalizeAIScore<br/>clamp to weights]
    normalize --> persistScore[(ScoreResult row<br/>+ snapshots)]
    rules --> persistScore
    persistScore --> audit[(AuditLog + AICall)]
```

---

## 4. Sequence: upload → score → decide

```mermaid
sequenceDiagram
    participant U as Recruiter
    participant B as Browser
    participant M as Edge Middleware
    participant API as /api/resumes/upload
    participant S as Storage
    participant E as Extractor
    participant SC as Scoring
    participant DB as Prisma DB
    participant AI as Gemini/AOAI

    U->>B: drop 25 PDFs
    B->>M: POST (multipart)
    M->>M: verify JWT + CSRF
    M->>API: forward
    API->>API: rate-limit + MIME sniff
    loop p-limit(3)
        API->>S: save original
        API->>E: extract text
        E-->>API: text + status
        API->>AI: prompt(text, benchmark)
        AI-->>API: ai json | throw AIError
        alt AI ok
            API->>SC: normalize + clamp
        else AI fail
            API->>SC: scoreWithRules (fallback)
        end
        API->>DB: $transaction(Candidate + ScoreResult + AuditLog)
        API-->>B: NDJSON event { id, status, score }
    end
    B-->>U: per-file chips, podium refreshed
    U->>B: open candidate
    B->>API: POST /api/candidates/:id/decision
    API->>DB: Decision + AuditLog
```

---

## 5. Local deployment

```mermaid
flowchart LR
    dev[Developer laptop<br/>Windows 11] --> next[next dev]
    next --> sqlite[(SQLite file<br/>./prisma/dev.db)]
    next --> fs[(./uploads<br/>local files)]
    next --> gem[Gemini API<br/>plaintext key in .env.local]
```

---

## 6. Azure deployment

```mermaid
flowchart TB
    users[Users] --> fd[Front Door<br/>Standard + WAF]
    fd --> app[App Service Plan P1v3<br/>Web App for Containers<br/>Managed Identity]
    app --> acr[(Azure Container Registry)]
    app --> pg[(PostgreSQL Flexible Server)]
    app --> blob[(Storage Account<br/>resumes container)]
    app --> kv[[Key Vault<br/>AUTH_SECRET, Gemini, AOAI...]]
    app --> sb[(Service Bus<br/>scoring-jobs)]
    app --> appi[[Application Insights]]
    appi --> logs[[Log Analytics]]
```

---

## 7. Key architectural decisions

ADRs live under [`docs/ADR/`](./ADR/). Headline decisions:

- **ADR-0001 Next.js App Router** — server components for read paths, route handlers for mutations.
- **ADR-0002 SQLite-then-Postgres** — `provider = env("DATABASE_PROVIDER")` flip.
- **ADR-0003 Mock-then-Entra auth** — local cookie JWT now, NextAuth+Entra scaffold for cloud.
- **ADR-0004 Cookie JWT** — signed with `jose`, 7-day rotation, `__Host-` cookie in prod.
- **ADR-0005 Bounded concurrency scoring** — `p-limit(3)` to protect AI rate limits.
- **ADR-0006 Streamed upload** — NDJSON over a single HTTP connection.
- **ADR-0007 Typed `AIError`** — every failure carries `kind`, `provider`, `status`, `hint`.

---

## 8. Reliability budget

| Component | SLO | Failure mode | Mitigation |
|----------|-----|--------------|-----------|
| AI provider | 99 % | 429 / 5xx / 404 | Auto-fallback to local rule engine; logged as `AICall.ok = false`. |
| Postgres | 99.95 % | Connection storm | Prisma pool size capped; readiness probe returns 503. |
| Storage | 99.9 % | Blob throttling | Single retry + audit row marked `ipAddress`. |
| AuthN | 99.99 % | JWT key rotation | Dual-key rollover via `AUTH_SECRET_PREV` (planned). |
