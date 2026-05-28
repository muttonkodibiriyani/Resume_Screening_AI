# ADR-0006: Streamed NDJSON for upload progress

- **Status**: Accepted (2026-04)
- **Owners**: Platform team, UX

## Context
The old upload UX showed fake `setTimeout` progress. With 50 files and AI
scoring taking ~5 s each, recruiters had no idea what was happening or where a
failure landed.

## Decision
Server returns `Content-Type: application/x-ndjson` and writes one JSON line
per significant event:
- `start` — total count
- `file` — `extracting`, `scoring`, `done`, or `error` per file
- `summary` — `{ succeeded, failed }`

Client uses `fetch` + `body.getReader()` to consume the stream and update the
per-file chips in real time.

## Consequences
- Real progress: a 12 MB PDF that takes 15 s no longer looks "stuck".
- Per-file errors are surfaced individually instead of failing the whole batch.
- Slightly more complex client (~ 30 lines of stream-parsing).
- Reverse proxies (Front Door, NGINX) must not buffer the response — verified
  in Bicep with `WEBSITES_PORT=3000` and AFD's default no-buffer behaviour.
