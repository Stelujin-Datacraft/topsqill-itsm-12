# Versatile Integration Studio — Production Readiness Gate

**Date:** 2026-09-29  
**Branch:** `cursor/vis-production-readiness-gate-e654`  
**Final decision:** **READY FOR INTERNAL TESTING**

Evidence artifacts:
- `/opt/cursor/artifacts/vis-readiness-gate.json`
- `docs/evidence/vis-readiness-gate.json` (checked in)

---

## Final decision (why)

| Factor | Result |
|--------|--------|
| Full NL → AI design → approve → execute → HTTP target create | **PASS** (latency 71ms, 1 record, priority Critical→1) |
| Target verified via **HTTP API** (not DB) | **PASS** |
| Update without duplicate | **PASS** (still 1 target) |
| Prisma persistence across restart/hydrate | **PASS** |
| Live TopSqill Form API (Supabase) | **PROBED** — reachable, **0 forms**, **writes blocked by RLS** |
| Live third-party SaaS API (ServiceNow etc.) | **NOT TESTED** — no test-tenant credentials provided |
| Real OIDC IdP (Okta/Azure AD) | **NOT TESTED** (LocalTestIdp only in hardening) |
| Multi-process API/worker HA | **NOT TESTED** in this gate |
| 100k load | Previously measured in hardening; not re-run in this gate |

**Not READY FOR PILOT / PRODUCTION** until a dedicated test tenant exists for both source SaaS and TopSqill forms (with form records writable via API), and SSO/Vault are validated against real systems.

---

## Area readiness table

| Area | Status | Evidence | Remaining Work |
|------|--------|----------|----------------|
| AI Designer | READY (internal) | Readiness gate analyze → REAL_TIME design | Live LLM provider optional |
| API Discovery | READY (contract) | RestConnector list/create against HTTP source | Wire customer OpenAPI URLs |
| Form Discovery | READY (contract) | InternalApplicationConnector discoverForms + fields | Live TopSqill forms empty/RLS |
| Mapping | READY | AI + validated mappings Critical→1 | — |
| Transformation | READY | severity→priority in execution | — |
| Scheduled Execution | NEEDS HARDENING | Phase 2/3 coverage | Cron in multi-instance |
| Real-Time Execution | NEEDS HARDENING | Phase 4 PASS; gate used payload path | Live webhook from SaaS |
| OAuth | NEEDS HARDENING | Hardening single-flight PASS | Live IdP token endpoint |
| Retry | READY (internal) | Phase 3 + failure injection | — |
| Rate Limiting | READY (internal) | 429 / Retry-After tests | Do not stress prod APIs |
| Idempotency | READY | Concurrent dups → 1 target | — |
| Reconciliation | READY | Gate + hardening 100/97 | Live source/target volumes |
| Schema Drift | READY | severity→riskLevel detected; no auto prod change | — |
| Security | NEEDS HARDENING | RBAC 403 matrix; sanitizer | Nest guards on all routes |
| RBAC | READY (service) | activate denied for DEVELOPER | HTTP middleware everywhere |
| SSO | EXPERIMENTAL | OIDC + LocalTestIdp | Real IdP |
| Secrets | NEEDS HARDENING | Local encrypted + Vault client | Live Vault |
| Code Generation | READY | TS/Py/Java/C#/Go build+test (hardening); Python rechecked in gate | — |
| Supabase Persistence | READY (when configured) | Supabase hydrate after restart | Default prod requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| HA | EXPERIMENTAL | Concurrent writer sim only | 2 API + N workers process test |
| Observability | READY (basic) | audit + execution logs + correlationId | Full OTEL exporter |
| Connector SDK | NEEDS HARDENING | Marketplace certify path | External publisher UX |
| Marketplace | NEEDS HARDENING | Install/upgrade/rollback unit | Org UI |
| Self-Healing | READY (allowlist) | Safe exec / dangerous reject | — |

---

## Inventory highlights

| Feature | Implementation | Test Evidence | Status | Risk | Required Action |
|---------|----------------|---------------|--------|------|-----------------|
| VisStore file/memory | Still available for tests | Production throws without Supabase creds | NEEDS HARDENING | Accidental file mode | Ops: set `VIS_PERSISTENCE=supabase` + shared Supabase keys |
| createStoreTargetAdapter | In-memory mockRecords | Unit/phase tests | STUB for prod target | Silent local-only writes | Prefer HTTP adapter when connection bound (**done in this PR**) |
| Vis mocks controller | In-process demo API | Phase 1–4 | Demo | Not customer SoR | Use `/vis/env` PG APIs or live Form API |
| Live FormApiService | Supabase forms/submissions | Probe: read OK, write RLS deny | NOT READY for gate writes | Org RLS | Seed test form in Demo org with service policy |
| Third-party REST | RestConnector | HTTP facade PASS | READY pending creds | Wrong tenant | Provide dedicated test account |

---

## Demonstration scenario (automated)

`backend/test/vis/vis.readiness-gate.test.ts`

1. User NL requirement (realtime vuln sync)  
2. AI analyzes → REAL_TIME  
3. Source HTTP API discovered  
4–6. Target forms + fields discovered (no hardcoded fields)  
7. Mappings validated  
8. Human approve  
9–17. Source create → execution SUCCESS → **target verified by HTTP GET**  
10. Update → still one target  
Audit + recon + drift + RBAC + Prisma restart  

```bash
export SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY   # required — do not embed passwords in docs/source
export VIS_PERSISTENCE=supabase
# Apply reviewable SQL: supabase/migrations/20261010090000_vis_supabase_persistence.sql
cd backend && npx tsx test/vis/vis.readiness-gate.test.ts
```

---

## Secret scan (this gate)

Scanned `backend/src/vis`, `backend/test/vis`, and `docs` for literal secret assignments and common live-key patterns.

| Finding | Classification |
|---------|----------------|
| Test fixtures using `'must-not-leak'` / `'should-redact'` | Intentional — assert redaction |
| Example env placeholders (`CHANGE_ME`) | Local/docs only — not customer secrets |
| Real `sk_live_` / AWS `AKIA…` / committed OAuth client secrets | **None found** |
| Prior `vis_dev_password` literals | Removed from source defaults; VIS uses shared Supabase credentials |

## What was not tested (explicit)

- Creating/updating records in live TopSqill customer forms (RLS / zero forms)
- Calling a real external SaaS (ServiceNow/Jira) with customer credentials
- Production Okta/Azure AD login
- Killing Redis mid-flight in this gate
- 100k load re-run (see prior hardening artifact `vis-load-100k.json`)
