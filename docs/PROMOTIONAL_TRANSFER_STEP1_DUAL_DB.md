# Step 1 — Wire dual-DB Promotional Transfer (Dev → Prod Supabase)

**Goal:** On the **Dev VM**, Nest can upsert selected config into the **Prod Supabase** project (not only logical snapshots).

CI/CD ships app code. This step wires **config promotion** between two Supabase projects.

## What you need

| Item | Where |
|------|--------|
| Dev VM `.env` | `/opt/topsqill/topsqill-itsm-12/.env` with `ENVIRONMENT=development` |
| Prod Supabase URL | Supabase Dashboard → **Prod** project → Settings → API → Project URL |
| Prod `service_role` key | Same page → `service_role` (secret). **Never** put this in `VITE_*` or commit it |
| Prod org UUID | Optional remap: `PROMOTION_PROD_ORG_ID` |
| Project map | Optional JSON: Dev project UUID → Prod project UUID |

## On Dev VM (SSH as `contact`)

```bash
cd /opt/topsqill/topsqill-itsm-12
cp -a .env /tmp/topsqill.env.bak

# Edit .env — add or update (use YOUR real Prod values):
# ENVIRONMENT=development
# PROMOTIONAL_TRANSFER_ENABLED=true
# PROMOTION_SOURCE_KEY=TopsqillITSM_Dev
# PROMOTION_TARGET_KEY=TopsqillITSM_Prod
# PROMOTION_PROD_SUPABASE_URL=https://xxxx.supabase.co
# PROMOTION_PROD_SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
# PROMOTION_PROD_ORG_ID=...                 # optional
# PROMOTION_PROD_PROJECT_MAP={"dev-uuid":"prod-uuid"}   # optional

# Confirm keys present (does not print secrets)
grep -E '^(ENVIRONMENT|PROMOTIONAL_TRANSFER|PROMOTION_PROD_SUPABASE_URL|PROMOTION_PROD_SUPABASE_SERVICE_ROLE_KEY)=' .env \
  | sed -E 's/(SERVICE_ROLE_KEY|URL)=.*/\1=SET/'

# Frontend must bake VITE_ENVIRONMENT=development (from ENVIRONMENT) — rebuild both
docker compose build --no-cache frontend backend
docker compose up -d
```

## Verify

```bash
# From Dev VM or any machine that can reach Nest:
curl -sS http://127.0.0.1:3001/api/promotion/availability | jq .
```

Expected (Dev):

```json
{
  "enabled": true,
  "environment": "development",
  "dualDbConfigured": true,
  "transferMode": "dual_supabase",
  "direction": "Dev → Prod"
}
```

If `dualDbConfigured` is `false`, the Prod URL/key are missing or not reaching the container — fix `.env` and recreate backend:

```bash
docker compose up -d --force-recreate backend
```

## UI check

1. Open Dev app as **admin**
2. Sidebar → **Administration → Promotional Transfer**
3. Create a small package (one form) → validate → execute
4. Confirm the object appears in **Prod** Supabase (not only Dev)

## Prod VM

Do **not** add `PROMOTION_PROD_*` on Prod. Keep `ENVIRONMENT=production` so the feature stays disabled there.

## After Step 1

Proceed to **Step 2**: smoke the wizard on Dev and list any blockers (deps, conflicts, missing types).
