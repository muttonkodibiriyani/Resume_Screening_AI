# User Guide (Training Manual)

Welcome to **Alshaya AI Recruit**. This manual walks each persona through what
they will see and do on the platform. Keyboard shortcut **Ctrl/Cmd + K** opens
the Command Palette anywhere in the app.

> The platform is **advisory**. AI never advances or rejects a candidate on its
> own — a human decision is always required.

---

## 1. Common navigation

| Page | URL | What you do here |
|------|-----|-------------------|
| Dashboard | `/dashboard` | KPIs, engine health, recent activity |
| Benchmark library | `/benchmark` | List + create benchmarks |
| Benchmark detail | `/benchmark/:id` | Skills, weights editor, interview pack |
| Upload | `/upload` | Drop CVs, watch live scoring stream |
| Ranking | `/ranking` | Top-3 podium + full sortable table |
| Candidates | `/candidates` | Search all candidates across all benchmarks |
| Candidate detail | `/candidates/:id` | Score radial, evidence, decision form |
| Reports | `/reports` | Per-benchmark CSV / Excel / PDF exports |
| Insights | `/insights` | Bias and engine telemetry |
| Audit | `/audit` | Tamper-evident log |
| Settings | `/settings` | Read-only provider configuration |

Top-right corner: command palette (Ctrl/Cmd + K), light/dark theme toggle, and
user menu (Sign out).

---

## 2. Recruiter (Aisha) — daily flow

### A. Create or pick a benchmark
1. Go to **Benchmark library**.
2. Either click a card to reuse one, or click **Create benchmark** → **AI Research**.
3. Fill the role title, skill family, minimum experience, seniority, hiring
   notes. Hit **Generate**.
4. After ~30 s you land on the benchmark detail page. Spot-check the **Skills**
   and **Expectations** tabs. If a weight feels wrong, open the **Weights** tab
   and drag the sliders — they must total 100.
5. Ask an Admin to approve the benchmark (`approvalStatus = approved`).

### B. Upload resumes
1. Click **Upload** in the sidebar (or use Ctrl/Cmd + K → "upload").
2. Pick the benchmark from the dropdown.
3. Drag up to 50 PDFs / DOCXs / TXTs into the drop zone.
4. Watch the per-file chips: `Uploading → Extracted → Scoring → Scored`.
   Each chip turns green on success or red on failure (with a reason).
5. When the stream completes, click **View ranking**.

### C. Shortlist
1. On **Ranking**, the podium shows the top 3. The table shows everyone.
2. Click a candidate to open detail. Read the radial chart, the matched
   evidence, the red flags, and the interview pack.
3. Click **Shortlist** (or **Hold** / **Reject** — rejecting needs a note).
4. The candidate's row in the ranking table updates immediately.

### D. Share a report
1. Go to **Reports**, pick the benchmark.
2. Choose CSV (for spreadsheet), Excel (for HR Ops), or PDF (cover page +
   ranking + top-3 evidence).

---

## 3. Hiring Manager (Omar)

You don't usually create benchmarks — you review.

1. Open **Ranking** with the link the Recruiter shared.
2. Look at the top-3 podium. Open each one. Read the **AI summary** tab.
3. If you disagree with one, hit **Re-score** to refresh with the latest
   benchmark version, or ask the Recruiter to bump the benchmark version and
   re-run.
4. Record your decision: **Shortlist**, **Hold**, or **Reject** (with a note).
5. Open **Reports** and download a PDF to share in your next interview-loop sync.

---

## 4. Interview Panel (Sara)

You only need three things: the candidate's resume, the score evidence, and the
interview question pack.

1. Open the candidate detail page.
2. Tab **Skills** → see which primary/mandatory skills were matched and the
   one-line evidence per skill.
3. Tab **Interview pack** → the role-specific questions.
4. Tab **AI summary** → the bottom-line recommendation and any red flags to
   probe in the interview.
5. **Download original** to read the raw CV.

You **cannot** record a decision — that lives with the Hiring Manager.

---

## 5. Admin / TA Ops (Khaled)

### A. Approve benchmarks
1. Open the benchmark detail page.
2. Click **Approve** (only available to your role).
3. Once approved, Recruiters can score against it.

### B. Bump versions
- When the role expectations materially change, click **Bump version**. The
  benchmark goes back to **draft** and needs a fresh approval. Existing scores
  retain a snapshot of the older version (`benchmarkVersionAtScore`).

### C. Manage users
- Default demo accounts live in `Settings → Demo accounts`. In production
  (`AUTH_PROVIDER=entra`) users are provisioned from Microsoft Entra ID and
  mapped to roles via group claims.

### D. Audit
- Open `/audit`. Filter by action and user. Failure rows are highlighted red.
- Export to CSV from the page (planned for v1.1).

### E. Insights
- Watch the band distribution and AI engine mix on `/insights`. If `% local
  rule` creeps over 20 %, your AI provider is probably failing — check the
  `Settings → Provider configuration` page.

---

## 6. Viewer / SLT (Layla)

- **Dashboard** → at-a-glance pipeline.
- **Insights** → fairness and cost telemetry.
- You cannot mutate anything.

---

## 7. Keyboard shortcuts

| Shortcut | What it does |
|----------|-------------|
| Ctrl/Cmd + K | Open command palette (jump to any page or benchmark) |
| Ctrl/Cmd + / | Focus the search box on the current page |
| Esc | Close any open dialog or sheet |
| Tab / Shift+Tab | Navigate interactive elements |

---

## 8. Troubleshooting

| Symptom | What to check |
|---------|--------------|
| "Failed to extract" on a PDF | The PDF is image-only — ask Admin to enable Azure Document Intelligence (`AZURE_DOC_INTELLIGENCE_*`). |
| "Local rule" engine on every score | Check `Settings → Active engine`. The Gemini probe may have failed — see the resolved-model card. |
| Login is "Too many attempts" | Wait 60 s; you're rate-limited. |
| Ranking is empty | The benchmark is not approved yet, or no resumes are uploaded. |
| Download button does nothing | Your role lacks `report:download`; ask an Admin. |
