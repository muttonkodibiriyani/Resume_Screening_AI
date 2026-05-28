# Azure deployment

Step-by-step guide to deploy Alshaya AI Recruit to Azure using the Bicep
template in `infra/azure/main.bicep`.

---

## 1. Prerequisites

- Azure subscription with **Owner** rights on the target resource group (we
  create role assignments).
- Azure CLI ≥ 2.60, logged in (`az login`).
- Docker Desktop or another OCI builder.
- An **Azure Container Registry** (per environment), e.g.
  `alshrecruitprodacr.azurecr.io`.
- GitHub repo + an **OIDC federated app registration** for the CD workflow
  (recommended over a long-lived service principal secret).

---

## 2. One-time bootstrap (per environment)

```sh
# 1. Create the resource group
RG=rg-alshaya-recruit-prod
az group create --name $RG --location uaenorth --tags app=alshaya-ai-recruit env=prod

# 2. Create the ACR (replace name globally)
az acr create --resource-group $RG --name alshrecruitprodacr --sku Basic --admin-enabled false

# 3. Configure the GitHub OIDC federated identity (one app reg per env)
#    Subject: repo:muttonkodibiriyani/Resume_Screening_AI:environment:prod
#    Scope:   /subscriptions/<sub>/resourceGroups/<rg>
#    Roles:   Contributor + Key Vault Secrets Officer
```

Add these GitHub Secrets to the `prod` environment:

| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | App reg client ID |
| `AZURE_TENANT_ID` | tenant ID |
| `AZURE_SUBSCRIPTION_ID` | subscription ID |
| `AZURE_CONTAINER_REGISTRY` | e.g. `alshrecruitprodacr` |
| `POSTGRES_ADMIN_PASSWORD` | strong random password |
| `AUTH_SECRET` | 32-byte hex |
| `GOOGLE_GEMINI_API_KEY` | optional |
| `TAVILY_API_KEY` | optional |
| `AZURE_OPENAI_API_KEY` | optional |
| `AZURE_OPENAI_ENDPOINT` | optional |
| `AZURE_OPENAI_DEPLOYMENT` | optional |
| `DATABASE_URL` | composed Postgres URL for `prisma migrate deploy` |

---

## 3. First deploy

Trigger the `cd.yml` workflow:

```sh
gh workflow run cd.yml -f environment=prod
```

What happens:

1. OIDC login to Azure.
2. `docker buildx` builds the multi-stage image (`infra/Dockerfile`,
   `DATABASE_PROVIDER=postgresql`).
3. Image pushed to ACR with both `v1.0.0` and `prod` tags.
4. `az deployment group create` provisions / updates the resource group:
   - Log Analytics + Application Insights
   - Key Vault (RBAC, with `AUTH-SECRET`, AI keys, PG password)
   - Storage Account + `resumes` Blob container (private)
   - PostgreSQL Flexible Server + `recruit` DB
   - Service Bus namespace + `scoring-jobs` queue
   - App Service Plan (Linux P1v3) + Web App for Containers
   - Front Door Standard + WAF + custom route
   - Role assignments (App Service MI → Blob, Key Vault, Service Bus)
5. `npx prisma migrate deploy` runs against the new Postgres.
6. Smoke test hits `/api/system/status` through Front Door.

---

## 4. Local-equivalent verification

Run the full container locally before promoting:

```sh
cd infra
docker compose --env-file ../.env.docker up --build
# open http://localhost:3000
```

The compose file uses Postgres + the same image; storage stays on a local
volume.

---

## 5. Custom domain + TLS

After the first deploy:

1. In the Front Door Profile → **Domains** add `recruit.alshaya.com`.
2. Create a DNS CNAME pointing to the AFD endpoint.
3. Validate the domain (Azure-managed TLS, free).
4. Attach the validated domain to the default route.

---

## 6. Scaling

| Knob | Where |
|------|-------|
| Web app vCPU/RAM | `plan.sku.name` in Bicep |
| Web app instance count | App Service `Scale-out` blade or `Microsoft.Web/sites/config` autoscaleSettings |
| Postgres tier | `pg.sku` in Bicep |
| Blob throughput | redundancy + premium tier in `stg.sku.name` |
| Service Bus | bump SKU to Premium for VNet integration |

---

## 7. Rollback

The CD workflow tags `:env` per environment. To roll back:

```sh
ENV=prod
RG=rg-alshaya-recruit-$ENV
PREVIOUS_TAG=v0.9.5
az webapp config container set \
  --name alsh-recruit-$ENV-app \
  --resource-group $RG \
  --container-image-name alshrecruit${ENV}acr.azurecr.io/recruit:$PREVIOUS_TAG
az webapp restart -g $RG -n alsh-recruit-$ENV-app
```

For schema rollback, restore Postgres from PITR (point-in-time-restore) up to
14 days back.

---

## 8. Observability

- **App Insights** dashboard auto-created. Look for:
  - Failed dependencies (`gemini`, `azure-openai`).
  - p95 server response time on `/api/resumes/upload`.
- **Log Analytics queries**:

```kusto
AppRequests
| where TimeGenerated > ago(1h)
| summarize avg(DurationMs), percentile(DurationMs, 95) by Name
| order by percentile_DurationMs_95 desc
```

```kusto
AppTraces
| where Properties.action == "AI_CALL_FAILED"
| summarize count() by Properties.provider, Properties.kind, bin(TimeGenerated, 5m)
```

---

## 9. Cost guardrails

- Front Door Standard is ~$35/mo + per-GB egress.
- App Service P1v3 ~$165/mo per instance.
- PostgreSQL Burstable B2s ~$30-60/mo depending on storage.
- Service Bus Standard ~$10/mo + per-million-ops.
- Storage GPv2 LRS ~$0.02/GB/mo (resumes container).
- AI tokens — track via the Insights page → AI cost ledger.

Set an **Azure Cost Management** budget alert at 80 % of the monthly target.
