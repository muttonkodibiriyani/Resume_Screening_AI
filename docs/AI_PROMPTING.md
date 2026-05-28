# AI prompting

This document captures the system-prompt design, model selection rules, the
model probe / auto-fallback, and our cost / latency guardrails.

---

## 1. Providers

| Provider | Library | Default model | Used for |
|----------|--------|---------------|---------|
| Google Gemini | `@google/generative-ai` | `gemini-2.5-flash` | scoring + benchmark generation |
| Azure OpenAI | `openai` SDK against AOAI endpoint | configurable deployment | optional secondary |
| Tavily Search | `axios` direct | n/a | live research grounding |

Only **one** AI provider needs to be configured. The platform tries them in
preference order from the env, and falls back to the deterministic local-rule
engine if all AI providers fail.

---

## 2. Model auto-detection

`src/lib/ai/gemini.ts` calls `GET /v1beta/models?key=...` once per process and
caches the answer for 30 minutes. It then picks the first model from a
preference list whose name we recognise:

```ts
const FLASH_PREFERENCE = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.0-flash',
  'gemini-2.5-pro',
];
```

If the user-supplied `GOOGLE_GEMINI_MODEL` 404s, we **invalidate the cache and
re-probe**. This is what fixed the mid-2026 `gemini-1.5-flash` deprecation
incident: the app self-heals without a code change.

---

## 3. Typed errors

Every AI call raises an `AIError` from `src/lib/ai/errors.ts`:

```ts
type AIErrorKind =
  | 'not_configured' | 'model_not_found' | 'quota_exceeded' | 'rate_limited'
  | 'timeout' | 'invalid_json' | 'auth_failed' | 'network' | 'unknown';

class AIError extends Error {
  kind: AIErrorKind;
  provider: 'gemini' | 'azure-openai' | 'tavily';
  status?: number;
  hint?: string;
}
```

The UI surfaces `hint` directly so users see *why* a fallback happened (e.g.
"Quota exceeded — try again in 10 min", not "AI call failed").

---

## 4. Scoring prompt (excerpt)

```
You are an expert technical recruiter for Alshaya Group. Score this resume
against the ideal-candidate benchmark below and return STRICT JSON ONLY (no
preamble, no markdown fences).

# Benchmark
{benchmarkJson}

# Resume text
{resumeText}

# Rules
- Use only evidence in the resume. Never invent.
- Do not use protected attributes (gender, age, race, religion, marital, nationality).
- Output `breakdown` keys must sum to <= 100. Each value <= its weight in the benchmark.
- `overallScore` MUST equal sum(breakdown).
- Provide `matchedEvidence` with 1-line quotes from the CV for each matched skill.

# JSON shape
{schema}
```

The schema fragment matches `CandidateScore` in
[SCORING_ALGORITHM.md](./SCORING_ALGORITHM.md#2-output-contract).

---

## 5. Benchmark prompt (excerpt)

```
You are designing an "ideal candidate" benchmark for the role below for
Alshaya Group (retail, multi-country). Use only the role, the optional hiring
notes, and (when provided) the cited web research.

# Role
title: {roleTitle}
skill family: {skillFamily}
min experience (yrs): {minExperience}
seniority: {seniority}
domain: {domainContext}

# Hiring notes
{hiringNotes}

# Research (cite by index)
{searchSnippets}

Return STRICT JSON with: primarySkills, mandatorySkills, goodToHaveSkills,
technicalDepth, architectureExp, leadershipExp, deliveryExp, modernizationExp,
redFlags, interviewQuestions, weights (sum to 100), idealSummary, sources.
```

---

## 6. JSON robustness

AI providers occasionally wrap JSON in markdown fences or trailing prose. The
helper `src/lib/ai/json-parse.ts`:

1. Strips ```` ```json ```` fences.
2. Finds the first `{` and matching last `}`.
3. Tries `JSON.parse`, then a forgiving variant that removes trailing commas.
4. Throws `AIError({kind:'invalid_json'})` on hard failure.

---

## 7. Cost & latency ledger

`src/lib/db.ts` writes an `AICall` row for every provider invocation:

| column | meaning |
|-------|---------|
| `provider` | gemini | azure-openai | tavily |
| `modelUsed` | resolved model name |
| `promptVersion` | semver of the prompt template |
| `purpose` | "scoring" | "benchmark_generation" |
| `latencyMs` | round-trip in ms |
| `ok` | success / failure |
| `errorKind` | from `AIError.kind` |
| `costUsd` | provider-reported cost if present |

The Insights page shows the rolling 500-call ledger so we can spot a runaway
benchmark or a misbehaving prompt before it hits the monthly budget.

---

## 8. Prompt versioning

Every prompt has a `PROMPT_VERSION` constant in its own module. When you change
the wording:

1. Bump the version (`v3` → `v4`).
2. Re-score a small sample (5-10 candidates per benchmark family).
3. Compare overall-score variance — flag if &gt; 8 points average drift.
4. Note the change in `CHANGELOG.md`.
