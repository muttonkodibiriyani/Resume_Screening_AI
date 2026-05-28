# Runbook (On-call playbook)

This is the operational manual. Each section is a self-contained playbook with
detection, response, and verification steps.

---

## 0. Quick links

- Azure Portal → resource group `rg-alshaya-recruit-prod`
- Application Insights → `alsh-recruit-prod-appi`
- Front Door → `alsh-recruit-prod-fd`
- Key Vault → `alsh-recruit-prod-kv`
- GitHub repo → `muttonkodibiriyani/Resume_Screening_AI`

---

## 1. Detection signals

| Signal | Where | Action |
|--------|-------|--------|
| 5xx spike | App Insights → Failures | See *App is down* (§2) |
| AI failure ratio > 20 % | App Insights query | See *AI provider outage* (§3) |
| Auth login rate-limit triggered | Audit log → `LOGIN_FAILED` cluster | See *Brute-force* (§4) |
| Postgres CPU > 80 % | Postgres metrics | See *DB hot* (§5) |
| Cost spike on a single benchmark | Insights page → AI ledger | See *Cost runaway* (§6) |

---

## 2. App is down

**Symptoms**: Front Door reports unhealthy origin, `/api/system/status` returns 5xx.

1. **Confirm**: `curl -i https://<frontdoor>/api/system/status`.
2. **Look at recent deploy**: `gh run list -L 5`.
3. If a deploy is the cause → roll back:
   ```sh
   az webapp config container set \
     --name alsh-recruit-prod-app \
     --resource-group rg-alshaya-recruit-prod \
     --container-image-name alshrecruitprodacr.azurecr.io/recruit:<previous-tag>
   az webapp restart -g rg-alshaya-recruit-prod -n alsh-recruit-prod-app
   ```
4. If a config / secret is the cause → check Key Vault audit and the App Service
   Configuration blade.
5. Verify with the smoke endpoint and a manual login.

---

## 3. AI provider outage

**Symptoms**: Recruiters see "engine: local-rule" on every score; Insights → AI
mix tilts away from gemini/AOAI.

1. Check **Settings → Active engine → Resolved Gemini model**. If status is
   "Unreachable" follow the error message hint.
2. If Gemini is down → set `AZURE_OPENAI_*` as the active provider:
   - App Service → Configuration → ensure `AZURE_OPENAI_API_KEY` etc are present.
   - Restart.
3. If both are down → no action needed; the local rule engine continues to
   serve. Communicate to recruiters that scores are temporarily deterministic.
4. When AI is restored, **re-score** important candidates from the candidate
   page (or via `POST /api/candidates/:id/rescore` in a loop).

---

## 4. Suspected brute-force on login

**Symptoms**: cluster of `LOGIN_FAILED` rows in the audit log from the same IP.

1. The IP is already rate-limited (5/min). Confirm with:
   ```sql
   SELECT "ipAddress", COUNT(*) FROM "AuditLog"
   WHERE "action" IN ('LOGIN_FAILED','LOGIN')
     AND "createdAt" > now() - interval '15 min'
   GROUP BY 1 ORDER BY 2 DESC;
   ```
2. If the attacker is sophisticated (rotating IPs) → temporarily disable the
   affected account or globally raise `BCRYPT_COST` in `src/lib/auth.ts`.
3. Rotate `AUTH_SECRET` (see §7) if any session was actually compromised.
4. Notify security@alshaya.com.

---

## 5. Postgres hot

**Symptoms**: Postgres CPU > 80 %, p95 query latency > 500 ms.

1. Quick: scale up the SKU (Burstable → General Purpose) — zero downtime.
2. Investigate offending query — App Insights → Dependencies → `prisma`.
3. Add an index in `prisma/schema.postgres.prisma`, ship a migration.

---

## 6. Cost runaway

**Symptoms**: Azure Cost Management alert OR Insights page → AI ledger >
expected.

1. Look at the AI ledger by `purpose` and `benchmarkId`.
2. If a single benchmark is responsible → it likely has runaway re-scores;
   talk to the Recruiter / pause the benchmark.
3. If a single model is responsible → consider switching `GOOGLE_GEMINI_MODEL`
   to the `-lite` variant for short-term relief.
4. Long-term → enable `QUEUE_PROVIDER=service-bus` and move scoring async.

---

## 7. Secret rotation

### `AUTH_SECRET`
1. Generate: `openssl rand -hex 32`.
2. Add to Key Vault as `AUTH-SECRET-NEXT`.
3. Roll out a release that reads both (`AUTH_SECRET` + `AUTH_SECRET_PREV`) and
   verifies tokens against either (planned v1.1).
4. After all live sessions have rotated, retire the old secret.

### `GOOGLE_GEMINI_API_KEY`
1. In Google AI Studio → Revoke the leaked key.
2. Create a new key, store in Key Vault as `GOOGLE-GEMINI-API-KEY`.
3. Restart App Service.

### Postgres admin password
1. `az postgres flexible-server update -n alsh-recruit-prod-pg -g rg-alshaya-recruit-prod --admin-password <new>`
2. Update Key Vault `POSTGRES-ADMIN-PASSWORD`.
3. Restart App Service.

---

## 8. Suspected key leak

1. Treat as confirmed until proven otherwise.
2. Rotate the leaked secret immediately (§7).
3. Audit any AICall rows or AuditLog rows in the suspicious time window.
4. File an incident in the security tracker. Notify security@alshaya.com and
   the data-protection officer if any candidate PII was exposed.

---

## 9. Suspected unauthorized access

1. Pull audit rows for the user: `SELECT * FROM "AuditLog" WHERE "userId" = ?`.
2. Disable the user (set `User.role = 'viewer'` or delete the row).
3. Force a global session invalidation by rotating `AUTH_SECRET` (§7).
4. Notify security and the user's manager.

---

## 10. Disaster recovery drill (quarterly)

1. Pick a non-prod resource group.
2. Restore the latest Postgres backup with PITR to a fresh server.
3. Restore the latest Blob container snapshot.
4. Deploy a fresh image from ACR.
5. Smoke-test login → upload → score → decide.
6. Document the RTO/RPO achieved. Target: RTO &lt; 4h, RPO &lt; 1h.
