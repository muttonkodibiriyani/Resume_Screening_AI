# ADR-0005: Bounded concurrency for scoring

- **Status**: Accepted (2026-04)
- **Owners**: Platform team

## Context
A recruiter can drop 50 resumes at once. Calling Gemini for every file in
parallel will trip per-minute quotas and burn money on retries.

## Decision
Use `p-limit(3)` in `src/app/api/resumes/upload/route.ts` to cap concurrent
scoring to 3 simultaneous AI calls. Each file runs in its own
`prisma.$transaction` so partial failure cannot corrupt state.

## Consequences
- p99 throughput is bounded but predictable.
- AI-provider rate-limit errors become rare; when they do happen the local rule
  engine takes over without dropping the file.
- For larger throughput, set `QUEUE_PROVIDER=service-bus` and consume the job
  on a worker (planned v1.2 — same scoring core, different transport).
