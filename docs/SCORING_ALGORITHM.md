# Scoring algorithm

This document is the **deep-dive** on the local rule-based scoring engine
(`src/lib/scoring/rule-engine.ts`). It also explains how the AI engine plugs into
the same output shape so downstream code (UI, reports, audit) does not care which
engine produced a score.

If you only want to use the system, read [USER_GUIDE.md](./USER_GUIDE.md) instead.

---

## 1. Why a rule engine *at all*?

We deliberately built a deterministic rule-based engine for **three** reasons:

1. **Reliability** — when Google deprecates a Gemini model (happened mid-2026)
   the platform must still produce a score. The rule engine runs entirely
   in-process with no network call.
2. **Explainability** — every component of the score traces to a keyword set, a
   formula, and a benchmark weight. No magic.
3. **Audit baseline** — when the AI engine returns a suspicious score we can
   compare to the rule baseline; if they diverge by &gt; 15 we flag the AI output
   for review (`normalizeAIScore`).

---

## 2. Output contract

Both engines return the same shape:

```ts
interface CandidateScore {
  candidateName: string;
  targetRole: string;
  totalExperience: number;      // in years, capped at 40
  relevantExperience: number;
  overallScore: number;         // 0..100
  scoreBand: 'ideal' | 'strong' | 'borderline' | 'reject';
  recommendation: string;       // 1-line human guidance
  risk: 'low' | 'medium' | 'high';
  breakdown: ScoreBreakdown;    // 8 dimensions, each ≤ its weight
  matchedSkills: string[];
  missingSkills: string[];
  partiallyEvidencedSkills: string[];
  matchedEvidence: string[];    // "skill: <sentence from CV>"
  missingOrWeakEvidence: string[];
  redFlagsDetected: string[];
  strengths: string[];
  gaps: string[];
  interviewFocusAreas: string[];
  interviewQuestions: string[];
  finalSummary: string;
}
```

`ScoreBreakdown` has eight dimensions whose weights (from the benchmark) sum to 100:

| Dimension | Default weight | What it measures |
|-----------|----------------|------------------|
| `years` | 10 | Years of relevant experience vs `minExperience`. |
| `primarySkillDepth` | 25 | Fraction of primary/mandatory skills evidenced. |
| `architectureArtifacts` | 20 | HLD / LLD / pattern / governance / blueprint mentions. |
| `projectFootprint` | 15 | Production / go-live / rollout / migration evidence. |
| `leadership` | 10 | Led / managed / mentored / team-of evidence. |
| `modernization` | 10 | Cloud / DevOps / IaC / GenAI keywords. |
| `certifications` | 5 | Vendor certifications mentioned. |
| `communication` | 5 | Anti-signal: vague JD-language reduces this score. |

---

## 3. Step-by-step algorithm

### Step 1 — Estimate years of experience

`estimateYears(text)` runs three strategies in order and stops at the first hit:

1. **Explicit "X years"** — regex `/(\d{1,2})\+?\s*(?:years?|yrs)\b/` over the full
   text. Picks the maximum (capped at 40).
2. **Date-range sum** — regex matches `Jan 2018 - Present`, `2015 – 2020`, etc.
   Sums up the years. Validates `start >= 1970` and `end <= currentYear + 1`.
3. **Year-spread fallback** — collects every 4-digit year in 1990-2039 and
   reports `max - min`.

`relevantYears = max(0, totalYears - 2)` (we discount the first two years as
non-relevant ramp-up).

### Step 2 — Skill matching

For each skill in `primarySkills ∪ mandatorySkills`:

1. Strip text in parentheses (`Postgres (PSQL)` → `postgres`).
2. Tokenize on whitespace and `/` and `,` (drop tokens shorter than 3 chars).
3. **Full match** if every token appears in the CV → `matched[]`.
4. **Any match** otherwise → `partiallyEvidencedSkills[]`.
5. **No match** → `missingSkills[]`.

For matched skills we run `findEvidence()` to pull a 220-char excerpt of the
first sentence that mentions the skill — this drives the *Evidence* column in
the candidate detail page.

### Step 3 — Eight dimension scores

Each dimension is computed as `min(hits / target, 1) * weight`, rounded.

```ts
yearsScore                 = round( min(totalYears, minExp+5) / (minExp+5) * W.years )
primarySkillDepthScore     = round( matched / allSkills * W.primarySkillDepth )
architectureArtifactsScore = round( min(archHits/4, 1) * W.architectureArtifacts )
projectFootprintScore      = round( min(deliveryHits/4, 1) * W.projectFootprint )
leadershipScore            = round( min(leadHits/3, 1) * W.leadership )
modernizationScore         = round( min(modernHits/4, 1) * W.modernization )
certificationsScore        = round( min(certHits/2, 1) * W.certifications )
```

`communicationScore` is unique: it starts at `W.communication` and is **reduced**
by three anti-signals:

- More than 5 vague JD-style phrases ("responsible for", "involved in"…) → ×0.5
- No 4-digit year anywhere → ×0.5
- Resume length under 1,500 chars → ×0.7

Multipliers compound, so a 200-char resume with 6 vague phrases lands at
`5 × 0.5 × 0.5 × 0.7 = 0.875 → 1`.

### Step 4 — Overall score and band

```
overall = clamp( sum(breakdown), 0, 100 )

if overall >= 85 → band = ideal
elif overall >= 70 → band = strong
elif overall >= 55 → band = borderline
else                → band = reject
```

### Step 5 — Red-flag detection

Six rules, each adds a sentence to `redFlagsDetected`:

1. Title says "architect" but `archHits < 2` → title-inflation risk.
2. `totalYears >= 15` and `leadHits < 2` → seniority mismatch.
3. `vagueHits > 6` → resume quality risk.
4. `deliveryHits < 1` → delivery risk.
5. `matched < max(2, 30% of skills)` → skill mismatch.
6. `missing > matched` → skill gap.

### Step 6 — Risk grade

| overall | redFlags | risk |
|---------|----------|------|
| ≥ 85 | any | low |
| 70-84 | ≤ 1 | low |
| 70-84 | ≥ 2 | medium |
| 55-69 | any | medium |
| &lt; 55 | any | high |

### Step 7 — Narrative outputs

`strengths`, `gaps`, `interviewFocusAreas`, and `finalSummary` are deterministic
templates assembled from the numbers above. `interviewQuestions` is passed
through directly from the benchmark.

---

## 4. Worked example — Sample resume #1 ("Senior Azure Integration Architect")

Resume excerpt:
> 12 years experience designing enterprise integration platforms on Azure. Led a team of 8 to deliver a global B2B integration rollout for a multi-country retailer. AZ-204 and AZ-305 certified. Built HLD / LLD blueprints for API Management, Logic Apps, Service Bus, and Event Grid in production.

Benchmark (excerpt):
- `minExperience = 10`
- `primarySkills = ["Azure", "API Management", "Logic Apps", "Service Bus"]`
- weights = defaults

Trace:

| Step | Computation | Result |
|------|-------------|--------|
| `estimateYears` | "12 years" hit on rule 1 | 12 |
| Skill match | All 4 tokens present in text | 4 / 4 → 1.0 |
| `archHits` | architect, hld, lld, blueprint = 4 hits | 4 |
| `deliveryHits` | "production", "global rollout", "delivered" = 3 | 3 |
| `leadHits` | "led", "team of" = 2 | 2 |
| `modernHits` | "azure", "ci/cd" implicit? "azure" = 1 | 1 |
| `certHits` | "az-204", "az-305", "certified" = 3 | 3 → capped to 1.0 |
| `vagueHits` | 0 | 0 |
| `yearsScore` | min(12, 15)/15 * 10 = 8 | 8 |
| `primarySkillDepthScore` | 1.0 * 25 | 25 |
| `archScore` | min(4/4, 1) * 20 | 20 |
| `projectScore` | min(3/4, 1) * 15 = 11 | 11 |
| `leadScore` | min(2/3, 1) * 10 = 7 | 7 |
| `modernScore` | min(1/4, 1) * 10 = 3 | 3 |
| `certScore` | 1.0 * 5 | 5 |
| `commScore` | 5 (no penalties) | 5 |
| **overall** | 8+25+20+11+7+3+5+5 | **84** |
| **band** | 70-84 → strong | strong |
| **risk** | redFlags = 0, band strong | low |

Red flags:
- Title contains "architect", `archHits=4` ≥ 2 → no flag.
- 12 years &lt; 15 → no seniority flag.
- Vague hits 0 → no flag.
- Delivery 3 ≥ 1 → no flag.
- Skills 4/4 matched → no flag.
- Missing 0 → no flag.

Final → 84 / strong / low risk → "Strong candidate - schedule interview".

(Two more worked examples for Sample #2 and #3 follow the same pattern; see
`tests/unit/rule-engine.test.ts` for executable equivalents.)

---

## 5. How the AI engine plugs in

`src/lib/scoring/ai-engine.ts` builds a prompt that asks Gemini (or Azure OpenAI)
to return the exact same JSON shape. Then `normalizeAIScore`:

1. Clamps each `breakdown[dim]` to `[0, weight]`.
2. Recomputes `sum(breakdown)`.
3. If the AI's `overallScore` differs by &gt; 10 from the clamped sum, it is
   **replaced** with the clamped sum and the discrepancy is logged.
4. Ensures `scoreBand` matches the clamped overall.
5. Strips any field that mentions a protected attribute.

On any failure we catch `AIError`, log it, and fall back to `scoreWithRules`.
This means the *output shape never changes*, so the UI, exports, and audit log
never branch on engine.

---

## 6. Anti-bias guardrails

- Protected attributes (gender, age, race, religion, marital status, nationality)
  are never in the rubric.
- We **do not** parse photos, dates of birth, or addresses below the city level.
- The Insights page surfaces distribution by score band and decision, not by any
  protected attribute, so reviewers can spot drift without privacy leakage.
- For deeper fairness audits, export the `Decision` + `ScoreResult` table and
  run an external toolkit (Fairlearn, IBM AIF360).

---

## 7. Tuning playbook

Two healthy ways to tune:

- **Weights** — edit the Weights tab on the benchmark detail page. Must sum to
  100; if a reviewer over-weighs one dimension you'll see a yellow warning bar.
- **Keyword lists** — `ARCH_KEYWORDS`, `LEADERSHIP_KEYWORDS`, etc. are local to
  `rule-engine.ts`. Keep them lowercase, deduplicated, and avoid stop-words.

Always:
1. Bump the benchmark version after a material change (forces re-approval).
2. Re-score affected candidates from the candidate detail page.
3. Spot-check the Insights page for unexpected band shifts.
