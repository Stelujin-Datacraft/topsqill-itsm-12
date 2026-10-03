# Versatile Integration Studio — Pilot Readiness Report

**Date:** 2026-09-29  
**Branch:** `cursor/vis-pilot-enablement-e654`  
**Final classification:** **NOT READY FOR PILOT**

Internal testing capability remains intact. Pilot is blocked on external credentials / writable tenant — not on missing platform lifecycle code.

Evidence:

- `/opt/cursor/artifacts/vis-pilot-enablement.json`
- `docs/evidence/vis-pilot-enablement.json`
- `docs/evidence/topsqill-tenant-diagnostic.json`
- `docs/TOPSQILL_TENANT_DIAGNOSTIC.md`

---

## Third-party

| Item | Value |
|------|-------|
| Provider | Configurable generic REST (`VIS_PILOT_SOURCE_PROVIDER`) — not hardcoded |
| Sandbox | **Not configured** (`VIS_PILOT_SOURCE_BASE_URL` unset) |
| Authentication | Supports API Key / Bearer / Basic / OAuth2 via env + SecretProvider ref |
| API | Contract sandbox used for mechanics (`/sandbox/...` HTTP facade over PG) |
| Status | **BLOCKED** for live SaaS; contract discovery/create/update **PASS** |

## TopSqill

| Item | Value |
|------|-------|
| Tenant | Reachable Supabase project (host redacted in evidence) |
| Environment | `TEST` (`VIS_PILOT_ENV`) — classified **READ_ONLY_TEST** |
| Form | None (0 forms); dedicated VIS Integration Test Form **not created** |
| Permissions | `SUPABASE_SERVICE_ROLE_KEY` JWT role = **`anon`** (misconfigured) |
| Write capability | **BLOCKED** — RLS denies inserts; RLS not bypassed |
| Status | **READ_ONLY_TEST** |

---

## Tests

| Test | Status | Evidence |
|------|--------|----------|
| AI design | PASS | NL → analyze (with clarification answers if needed) → design |
| Schema discovery | PASS | OpenAPI → `schemaCache` in PostgreSQL |
| Form discovery | PASS | InternalApplicationConnector fields (no hardcoded target fields) |
| Mapping | PASS | Validated mappings + matching strategy |
| Create | PASS | `VIS-PILOT-001` created; verified via **HTTP GET** |
| Update | PASS | Still 1 record after update |
| Real-time webhook | NOT_TESTED | No third-party webhook credentials |
| Real-time polling fallback | PASS | Phase 4 + contract path |
| OAuth (third-party) | BLOCKED | No sandbox OAuth config |
| Retry / DLQ / replay | PASS | Phase 3/hardening + failure classification here |
| 429 | PASS | Sandbox `Retry-After` injection (not production rate limits) |
| Reconciliation | PASS | Report generated; destructive repair requires approval |
| OIDC (local protocol) | PASS | LocalTestIdp login + RBAC activate deny/allow |
| OIDC (real IdP) | BLOCKED | Set `VIS_OIDC_ISSUER` + secret ref |
| HA (2 workers) | PASS | Redis/BullMQ when `REDIS_URL` set; kill/recover exercised |
| Worker recovery | PASS | Replacement worker after kill |
| Duplicate protection | PASS | Idempotent create by `externalId` → 1 record |
| Secret scan | PASS | No high-confidence live secrets in Git |
| Live TopSqill writes | BLOCKED | anon key / 0 forms / RLS |
| Live third-party E2E | BLOCKED | No sandbox URL/credentials |

---

## Secret hygiene

- Removed embedded `vis_dev_password` defaults from source/scripts/docs examples.
- Require `VIS_DATABASE_URL` / `VIS_MOCK_PG_BASE` from environment.
- `scripts/security/scan.sh` + `npm run test:vis:secrets` / `test:vis:pilot` secret scan.
- `SupabaseService` warns when JWT role ≠ `service_role` (does not bypass RLS).
- AI sanitizer + queue payload checks assert no secret leakage.

**Note:** The anon key currently stored as `SUPABASE_SERVICE_ROLE_KEY` is a **publishable** key already present in frontend env. It is not a private service credential. Operators must **replace** it with the real `service_role` secret from the dashboard (rotate if this misconfiguration was ever treated as privileged).

---

## What remains blocked (external prerequisites)

1. Real `SUPABASE_SERVICE_ROLE_KEY` (`role=service_role`)
2. Dedicated TEST/UAT **VIS Integration Test Form** + `VIS_PILOT_TOPSQILL_ORG_ID` / `FORM_ID`
3. Third-party sandbox: `VIS_PILOT_SOURCE_BASE_URL` + auth credential ref
4. Optional: real OIDC IdP (`VIS_OIDC_*`)

## Exact commands to re-run

```bash
export VIS_DATABASE_URL   # from secret manager / local env — never commit
export VIS_PERSISTENCE=prisma
export VIS_PILOT_ENV=TEST
export REDIS_URL=redis://127.0.0.1:6379
# After unlocking writable tenant + sandbox:
# export SUPABASE_SERVICE_ROLE_KEY=...   # real service_role JWT
# export VIS_PILOT_TOPSQILL_ORG_ID=...
# export VIS_PILOT_TOPSQILL_FORM_ID=...
# export VIS_PILOT_SOURCE_BASE_URL=https://...
cd backend && npm run test:vis:pilot
```

## Final decision

**NOT READY FOR PILOT**

Reasons (evidence-based):

- Live TopSqill Form API is **READ_ONLY_TEST** (anon JWT mislabeled as service role; 0 forms; RLS blocks writes).
- No live third-party sandbox credentials were provided.
- Contract HTTP E2E (create/update/dup/HA/OIDC-local/secrets) **PASS** — sufficient for continued **internal testing**, insufficient for pilot against real systems of record.
