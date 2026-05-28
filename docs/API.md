# API reference

All endpoints live under `/api/*` and return JSON unless noted. Mutations require
a CSRF header (`x-csrf-token`) that the browser fetcher attaches automatically
from the `csrf-token` cookie set by middleware. All authenticated routes carry
a signed JWT session cookie.

Standard error envelope:

```json
{ "error": "Human-readable message", "code": "STRING_CODE", "details": { ... } }
```

HTTP status codes follow REST conventions:

| Status | Meaning |
|--------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No content (delete) |
| 400 | Validation / bad input (Zod) |
| 401 | Not authenticated |
| 403 | Authenticated but not permitted (RBAC) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate) |
| 422 | Domain rule violation |
| 429 | Rate-limited |
| 500 | Server error |

---

## Auth

### `POST /api/auth/login`
Body: `{ email: string, password: string }`
Returns: `{ user: { id, name, email, role } }` and sets the session cookie.
Rate-limited: 5 requests / minute / IP. Audited as `LOGIN` (or `LOGIN_FAILED`).

### `POST /api/auth/logout`
Clears the session cookie. Audited as `LOGOUT`.

### `GET /api/auth/me`
Returns the current session user `{ id, name, email, role }` and stamps a
fresh CSRF cookie.

---

## System

### `GET /api/system/status`
Public (used by health probes). Returns:

```json
{
  "ok": true,
  "ai": {
    "preferredEngine": "gemini",
    "preferredEngineForBenchmark": "gemini",
    "geminiConfigured": true,
    "azureOpenAIConfigured": false,
    "searchConfigured": true,
    "ocrConfigured": false,
    "copilotStudioConfigured": false,
    "geminiModel": { "name": "gemini-2.5-flash", "ok": true }
  }
}
```

---

## Benchmarks

### `GET /api/benchmarks`
Permission: `benchmark:read`. Returns `{ benchmarks: Benchmark[] }`.

### `POST /api/benchmarks`
Permission: `benchmark:create`. Rate-limited: 10/hr/user.

Body (Zod `benchmarkCreateSchema`):
```ts
{
  roleTitle: string,        // 3..120 chars
  skillFamily?: string,
  minExperience: number,    // 0..40
  seniority?: string,
  domainContext?: string,
  hiringNotes?: string
}
```
Returns `{ benchmark, engineUsed, source }`. Audited as `BENCHMARK_CREATED`.

### `GET /api/benchmarks/:id`
Permission: `benchmark:read`. Returns the full benchmark with candidate count.

### `PATCH /api/benchmarks/:id`
Permission: `benchmark:update` for general edits; `benchmark:approve` to set
`approvalStatus`; `benchmark:bump_version` to bump.

Body (Zod `benchmarkUpdateSchema`): any subset of mutable fields, plus
`bumpVersion?: boolean`. Audited as `BENCHMARK_UPDATED` / `BENCHMARK_APPROVED`
/ `BENCHMARK_VERSION_BUMPED`.

### `DELETE /api/benchmarks/:id`
Permission: `benchmark:delete`. Cascades to candidates, scores, decisions.

---

## Candidates

### `GET /api/candidates`
Permission: `candidate:read`. Query (Zod `candidatesQuerySchema`):
`benchmarkId?`, `decision?`, `band?`, `take?` (≤ 200), `skip?`.

### `GET /api/candidates/:id`
Permission: `candidate:read`. Returns the candidate with score, decision, and benchmark.

### `DELETE /api/candidates/:id`
Permission: `candidate:delete`.

### `POST /api/candidates/:id/decision`
Permission: `decision:write`. Body (`decisionSchema`):
```ts
{ decision: 'shortlist' | 'hold' | 'reject', notes?: string }
```
`notes` required when `decision === 'reject'`. Audited as `DECISION_RECORDED`.

### `POST /api/candidates/:id/rescore`
Permission: `candidate:rescore`. Re-runs scoring with the current benchmark
version snapshot. Audited as `CANDIDATE_RESCORED`.

### `GET /api/candidates/:id/resume`
Permission: `candidate:read`. Streams the original file via the storage driver
with correct `Content-Type` and `Content-Disposition`.

---

## Resume upload

### `POST /api/resumes/upload`
Permission: `candidate:upload`. Rate-limited: 20/hr/user.

Multipart body:
- `benchmarkId: string` (required, must be approved)
- `files: File[]` (max 50 files, max 10 MB each)

The response is **`Content-Type: application/x-ndjson`** — a stream of
newline-delimited JSON events:

```
{ "type":"start", "total":10 }
{ "type":"file", "fileName":"jdoe.pdf", "status":"extracting" }
{ "type":"file", "fileName":"jdoe.pdf", "status":"scoring" }
{ "type":"file", "fileName":"jdoe.pdf", "status":"done", "id":"clz...", "score":83, "engine":"gemini" }
{ "type":"file", "fileName":"bad.exe", "status":"error", "error":"unsupported MIME" }
{ "type":"summary", "succeeded":9, "failed":1 }
```

Bounded concurrency: `p-limit(3)`. Each file is processed in its own
`prisma.$transaction`.

---

## Reports

### `GET /api/reports/:benchmarkId?format=csv|xlsx|pdf`
Permission: `report:download`. Streams the file with the correct mime type.
Audited as `REPORT_GENERATED`.

---

## Audit

### `GET /api/audit?action=&userId=&from=&to=&take=&skip=`
Permission: `audit:read`. Query is validated against `auditQuerySchema`. Returns
`{ logs: AuditLog[], total: number }`.

---

## CSRF

Every mutating request (`POST`, `PATCH`, `DELETE`) must carry
`x-csrf-token: <value of csrf-token cookie>`. Use `apiFetch()` from
`src/lib/api-client.ts` to do this automatically.

---

## Rate limits

| Endpoint | Limit |
|---------|-------|
| `POST /api/auth/login` | 5/min/IP |
| `POST /api/resumes/upload` | 20/hr/user |
| `POST /api/benchmarks` | 10/hr/user |

Hitting a limit returns 429 with `Retry-After` (seconds).

---

## OpenAPI

A machine-readable spec is generated from the Zod schemas in
`src/lib/validation/schemas.ts` using `zod-to-openapi`. To regenerate locally:

```sh
npm run docs:openapi   # planned in 1.1
```

The OpenAPI file lands at `docs/openapi.yaml`.
