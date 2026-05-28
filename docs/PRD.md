# Alshaya AI Recruit — Product Requirements Document (PRD)

**Version:** 1.0.0 (Overhaul release)
**Owner:** Talent Acquisition Platform Team
**Status:** Approved for production pilot

---

## 1. Vision

Alshaya AI Recruit is the internal AI-assisted resume screening platform for Alshaya
Group. It turns a fuzzy hiring brief into a **structured ideal-candidate benchmark**,
scores every applicant resume against that benchmark **with evidence**, and routes
the top candidates to recruiters and hiring managers with **interview-ready
context** — while keeping every decision human-in-the-loop, fully audited, and
bias-aware.

We win when:

1. Time-to-shortlist drops from days to **minutes** for a 100-resume role.
2. Hiring managers can trust the top-3 list **without rebuilding it manually**.
3. Every advance/reject decision has an audit trail an auditor can defend.
4. The system never advances a candidate on its own — humans always sign off.

---

## 2. Personas

| ID | Persona | Primary goal | Frequency of use |
|----|---------|-------------|------------------|
| P1 | **Recruiter** (Aisha) | Build benchmark, upload CVs, shortlist | Daily |
| P2 | **Hiring Manager** (Omar) | Review top-3, request more, approve shortlist | Weekly |
| P3 | **Interview Panel** (Sara) | Read candidate pack + interview pack before the loop | Per interview |
| P4 | **Admin / TA Ops** (Khaled) | Manage benchmarks, users, audit, integrations | Weekly |
| P5 | **Viewer / SLT** (Layla) | See pipeline health and time-to-hire KPIs, read-only | Monthly |

All five personas are first-class in the navigation, RBAC permission matrix
(`src/lib/rbac.ts`), and login demo seeds.

---

## 3. Goals & non-goals

### Goals
- AI-assisted but **human-decided** screening.
- Transparent scoring (every score traces to a benchmark dimension + evidence).
- Multi-engine: Gemini, Azure OpenAI, deterministic local-rule fallback.
- Mobile responsive, dark mode, keyboard-first (Cmd/Ctrl+K command palette).
- Cloud portable: SQLite local → Postgres on Azure with a single env-var flip.
- Full audit trail: who did what, when, from which IP.

### Non-goals (out of scope for v1.0)
- ATS replacement (we integrate, we do not own requisitions or offers).
- LinkedIn / Naukri / Indeed sourcing (resume ingestion is the boundary).
- Automated rejection emails (must stay human-authored).
- Open-text "free chat" with a benchmark — too risky without an evaluation harness.

---

## 4. User stories & acceptance criteria

### Epic A — Benchmark generation
- **A1.** As a Recruiter I generate an ideal-candidate benchmark from a role title and a few hints, so I don't have to handcraft a job spec.
  - AC1: Generation completes in &lt; 45 s with a Gemini key.
  - AC2: Output includes primary skills, mandatory skills, expectations, red flags, interview pack, weights summing to 100.
  - AC3: When live search (`TAVILY_API_KEY`) is configured, sources are cited in the benchmark detail page.
  - AC4: If no provider is configured, a template-based benchmark is built deterministically and labelled `local-template` for transparency.
- **A2.** As an Admin I approve a benchmark (`approvalStatus = approved`) before any candidate can be scored against it, so we never use draft criteria in production.
- **A3.** As an Admin I bump the version of a benchmark to force re-approval after material changes.

### Epic B — Resume ingestion & scoring
- **B1.** As a Recruiter I drop up to 50 resumes (PDF/DOCX/TXT, ≤ 10 MB each) on the upload page and see **real per-file streamed progress** (extracted, scoring, scored, failed).
- **B2.** Server-side MIME sniffing rejects spoofed extensions before any extraction.
- **B3.** Each file is processed in its own transaction; partial batch failures do not corrupt the dataset.
- **B4.** A Recruiter can re-score a single candidate (re-runs extraction and AI scoring with the same benchmark version snapshot).
- **B5.** AI errors (404, 429, quota, network) surface a **typed `AIError`** to the UI so the Recruiter knows *why* the rule fallback was used.

### Epic C — Ranking & decision
- **C1.** As a Hiring Manager I open `/ranking?benchmarkId=…` and see a **top-3 podium** plus a sortable table.
- **C2.** As an Interview Panel member I open a candidate page and read: radial 8-dimension score, evidence per skill, red flags, interview focus areas, and a question pack — without seeing other candidates' data.
- **C3.** As a Hiring Manager I record a decision (shortlist / hold / reject) with a mandatory note when rejecting.

### Epic D — Governance
- **D1.** Every mutation lands in the Audit log with `user`, `IP`, `action`, and `details`.
- **D2.** An Admin can export CSV/Excel/PDF reports per benchmark with the benchmark snapshot on the cover page.
- **D3.** Protected attributes (gender, age, nationality, race, religion, marital status) are never inspected by either engine.
- **D4.** Insights page shows score-band distribution, AI engine mix, decision funnel, and AI-cost ledger for transparency.

---

## 5. KPIs

| Metric | Target |
|--------|--------|
| Time-to-shortlist (100 CVs) | &lt; 5 min wall-clock |
| Hiring-manager acceptance of top-3 | ≥ 70 % |
| AI score / Recruiter overlap on shortlist | ≥ 60 % |
| Audit log coverage | 100 % of mutations |
| Unattended AI advance | **0** (impossible by design) |
| p95 page load (broadband) | &lt; 1.5 s |
| Lighthouse Accessibility | ≥ 95 |

---

## 6. Roadmap

| Phase | Capability | Status |
|-------|-----------|--------|
| v1.0  | Overhaul: hardened core, redesigned UX, Azure-ready | ✅ this release |
| v1.1  | Microsoft Entra ID SSO (`AUTH_PROVIDER=entra`) | 🛠 scaffold ready |
| v1.2  | Candidate comparison view (2-4 side-by-side) | planned |
| v1.3  | Talent pool re-search across stored CVs | planned |
| v1.4  | Calibration loop: hiring-decision outcomes → benchmark tuning | planned |
| v2.0  | Live job-board ingestion + LinkedIn integration | exploratory |

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| AI hallucinated scores | Rule-engine sanity-clamps each breakdown; AI overall must be within ±10 of clamped sum. |
| Sensitive data leak in audit | `details` text is truncated to 2 KB; PII filter on candidate name only. |
| Vendor lock-in (Gemini) | Multi-engine abstraction (`scoring/ai-engine.ts`) with auto-fallback to Azure OpenAI then local rules. |
| Bias against minority pool | Protected attributes never scored; insights page surfaces band/decision distribution for oversight. |
| Cost runaway | `AICall` table records cost per call; insights page exposes a 500-call ledger. |
