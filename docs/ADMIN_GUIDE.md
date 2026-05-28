# Admin Guide

This guide is for **TA Ops / Admin** users who operate the platform — provider
configuration, RBAC, audit export, OCR, retention.

> For the day-to-day flow (creating benchmarks, scoring, deciding) see
> [USER_GUIDE.md](./USER_GUIDE.md).

---

## 1. Provider configuration

Everything is driven by `.env.local` (or App Service Settings in Azure). The
`Settings` page in the app reflects the current configuration but **never
writes** to the env — that's intentional.

| Capability | Required env | Notes |
|-----------|--------------|-------|
| Gemini scoring | `GOOGLE_GEMINI_API_KEY` | Optional model override via `GOOGLE_GEMINI_MODEL`. |
| Azure OpenAI scoring | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_DEPLOYMENT` | Used as a secondary if Gemini unavailable. |
| Online research | `TAVILY_API_KEY` | Enables source-cited benchmarks. |
| OCR (image-only PDFs) | `AZURE_DOC_INTELLIGENCE_ENDPOINT` + `AZURE_DOC_INTELLIGENCE_KEY` | Otherwise marked `ocr_required`. |
| Azure Blob storage | `STORAGE_PROVIDER=azure-blob` + `AZURE_BLOB_CONTAINER` + connection or Managed Identity | Local FS by default. |
| Service Bus queue | `QUEUE_PROVIDER=service-bus` + `AZURE_SERVICE_BUS_CONNECTION_STRING` + `AZURE_SERVICE_BUS_QUEUE` | In-process queue by default. |
| Entra ID SSO | `AUTH_PROVIDER=entra` + `ENTRA_*` | Local cookie auth by default. |
| Telemetry | `APPLICATIONINSIGHTS_CONNECTION_STRING` | Falls back to console logger. |

After any env change, restart the Next.js server (`npm run dev` or App Service
`Restart`).

---

## 2. RBAC matrix

Edit `src/lib/rbac.ts` for the master matrix. v1.0 ships with:

| Action | admin | hiring_manager | recruiter | interview_panel | viewer |
|--------|:-----:|:--------------:|:---------:|:---------------:|:------:|
| `benchmark:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `benchmark:create` | ✅ | - | ✅ | - | - |
| `benchmark:update` | ✅ | - | ✅ | - | - |
| `benchmark:approve` | ✅ | ✅ | - | - | - |
| `benchmark:bump_version` | ✅ | - | ✅ | - | - |
| `benchmark:delete` | ✅ | - | - | - | - |
| `candidate:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `candidate:upload` | ✅ | - | ✅ | - | - |
| `candidate:rescore` | ✅ | - | ✅ | - | - |
| `candidate:delete` | ✅ | - | - | - | - |
| `decision:write` | ✅ | ✅ | - | - | - |
| `report:download` | ✅ | ✅ | ✅ | - | ✅ |
| `audit:read` | ✅ | - | - | - | ✅ |
| `audit:export` | ✅ | - | - | - | - |

---

## 3. OCR setup

1. Create an **Azure AI Services - Document Intelligence** resource (former Form
   Recognizer).
2. Copy the endpoint and key.
3. Add to `.env.local`:

```
AZURE_DOC_INTELLIGENCE_ENDPOINT=https://<region>.api.cognitive.microsoft.com/
AZURE_DOC_INTELLIGENCE_KEY=<key>
AZURE_DOC_INTELLIGENCE_MODEL=prebuilt-read
```

4. Restart. The Settings page should flip the OCR row to **Configured**.
5. Upload a scanned PDF — the candidate row will show `OCR succeeded` in the
   extraction column.

---

## 4. Audit export

Today: open `/audit`, copy-paste rows or use the PDF reports.
v1.1 will add an Admin-only **Export CSV** button.

For programmatic export against Postgres:

```sql
COPY (SELECT * FROM "AuditLog" WHERE "createdAt" > now() - interval '30 days')
TO '/tmp/audit_last_30d.csv' WITH CSV HEADER;
```

---

## 5. Data retention

- **Candidates & scores**: keep for the duration of the role + 12 months.
- **Audit log**: keep 7 years (compliance baseline).
- **Original resume files (Blob)**: lifecycle policy in the Storage Account —
  move to Cool after 90 days, delete after 24 months.

The simplest retention job (run weekly):

```sql
DELETE FROM "Candidate" WHERE "uploadedAt" < now() - interval '24 months';
-- AuditLog rows referencing those candidates remain (entityType + entityId
-- still tell the auditor what happened, just not the original PII).
```

Wrap this in a `pg_cron` job or a GitHub Actions cron workflow.

---

## 6. Backups

- **Postgres Flexible Server** has automated backups: 14-day PITR by default in
  our Bicep template.
- **Blob Storage** soft-delete is enabled for 30 days.
- **Key Vault** soft-delete is enabled for 90 days.

Restore drill should be run quarterly — see
[RUNBOOK.md](./RUNBOOK.md#disaster-recovery).
