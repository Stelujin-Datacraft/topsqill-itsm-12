# ITAM Form Sync Readiness

**Branch:** `cursor/itam-form-sync-e654`  
**Date:** 2026-09-30  
**Overall: PARTIALLY VALIDATED**

Evidence: `docs/evidence/itam-form-sync.json`

> Existing application Form API is the **system of record**.  
> This platform stores sync metadata, mappings, provenance, and history only.  
> **Vulnerability Management is intentionally excluded** from this phase.

---

## 1. Architecture

```
AWS / Azure / GCP / VMware / Network / Agent
                ↓
           Discovery (A–D)
                ↓
            Normalize
                ↓
            Correlate
                ↓
   Existing Application Form Schema (API)
                ↓
         Field Mapping (+ approval)
                ↓
       Reference Resolution
                ↓
           Validation
                ↓
            Dry Run  ──(no writes)──► WOULD_* / BLOCKED / …
                ↓ Approve
       Existing Application API  (CREATE / UPDATE)
                ↓
          Existing ITAM Record
                ↓
      Provenance + Audit + Sync History
```

**Critical rules enforced:**

- No second ITAM SoR inside VIS/discovery store
- No direct writes to existing application PostgreSQL
- Writes only via Form API connector (`HttpExistingAppTarget` / mock for tests)
- Secrets only as `credentialReferenceId` (resolved via SecretProvider)

Reuses: Internal Application connector patterns, VIS mapping/transform helpers, discovery correlation, DiscoveryStore + PG write-through, Nest `/api/itam` RBAC, audit/metrics patterns.

---

## 2. Existing Application API contract

Configured per sync target (not hardcoded field IDs):

| Operation | Default path pattern |
|-----------|----------------------|
| List forms | `GET {formsPath}` → `/api/forms` |
| Form fields | `GET {formFieldsPath}` → `/api/forms/{formId}/fields` |
| Search/list records | `GET {recordsPath}` / optional `searchPath` |
| Get record | `GET {recordByIdPath}` |
| Create | `POST {recordsPath}` |
| Update | `PUT/PATCH {recordByIdPath}` |

Live HTTP target: `HttpExistingAppTarget` in `backend/src/itam/sync/target.ts`.  
Lab/mock: `MockExistingAppTarget` (`mock://existing-app` or `ITAM_SYNC_USE_MOCK=1`).

---

## 3. Form schema discovery

| Capability | Status |
|------------|--------|
| Dynamic form/field discovery via API | **PASS** (mock) |
| Schema cache + version/hash | **PASS** |
| Schema refresh on change | **PASS** |
| Hardcoded field IDs | **Not used** |
| Missing form → BLOCKED / CONFIGURATION_REQUIRED | Supported in engine statuses |

Schema snapshot includes: formId, formName, field name/label/type, required/nullable/readOnly/editable, allowedValues, maxLength, reference hints, version/hash.

---

## 4. Mapping architecture

| Capability | Status |
|------------|--------|
| Deterministic schema-aware propose | **PASS** |
| Exact-name match before fuzzy | **PASS** |
| Versioned mappings (v1 → v2 on schema rename) | **PASS** |
| DRAFT → APPROVED gate before execute | **PASS** |
| AI proposed mapping path | Reuses VIS suggest patterns; AI never writes records |
| Stale mapping after schema change | **PASS** (blocked until re-approve) |

---

## 5. Correlation strategy

Before CREATE, correlate against existing application records using stable identifiers (machine GUID, serial, bios UUID, cloud resource ID, MAC, hostname+context). IP alone is weak evidence and does not create a new permanent identity.

Verified in mock suite:

- First discovery → **CREATE**
- Repeat → **NO_CHANGE** (single record)
- Field change → **UPDATE**
- IP change → same record updated (no duplicate)

---

## 6. Reference resolution

Engine supports reference/lookup resolution flow (normalize → search → match → optional create if allowed). Full live reference catalogs (manufacturer/location/owner) against real forms: **NOT TESTED** (requires real environment).

---

## 7. Create / update behavior

| Outcome | Mock result |
|---------|-------------|
| CREATE | **PASS** — record `cb29cb59-…` |
| NO_CHANGE | **PASS** — idempotent re-run |
| UPDATE | **PASS** — e.g. manufacturer change |
| WOULD_* (dry-run) | **PASS** — zero writes |
| AMBIGUOUS_MATCH | Status supported; dedicated fixture **PARTIALLY VALIDATED** |

---

## 8. Idempotency

Key shape: `tenant + targetForm + normalizedExternalIdentity + mappingVersion`

Repeated discovery of the same asset → one target ITAM record (**PASS** mock).

---

## 9. Dry-run behavior

Dry-run performs normalize, correlate, schema, map, validate; **must not** write.

Guard: mock `dryRunGuard` + write-count assertion → **PASS** (`writes: 0`).

---

## 10. Provenance

Field-level provenance stored (source field, discovery source, mapping version, target field/value, sync time). Credentials never stored.

Evidence: 36 provenance rows in mock run — **PASS**.

---

## 11. Sync history

Per asset: operation, status, target record ID, changed fields, mapping/schema version, execution ID, timestamp.

Evidence: 5 history rows for test asset — **PASS**.

---

## 12. Security

| Control | Status |
|---------|--------|
| credentialReferenceId only | **PASS** |
| Reject embedded secrets in target create | **PASS** |
| No secrets in queue/audit/history payloads | **PASS** (hygiene test) |
| Tenant isolation (org A ≠ org B) | **PASS** |
| Admin RBAC on mutate/preview/execute | Enforced (`ITAM_ADMIN` / org admin roles) |

---

## 13. RBAC

Mutating endpoints require ITAM administrator roles unless `ITAM_DISCOVERY_REQUIRE_ADMIN=0` (lab). Reads scoped by `organizationId` from request context.

---

## 14. Tenant isolation

Sync targets, mappings, runs, history, and provenance filtered by organization. Cross-tenant sync rejected — **PASS** mock.

---

## 15. Test results

| Suite | Command | Result |
|-------|---------|--------|
| Form sync (mock E2E pipeline) | `npm run test:itam:form-sync` | **PASS** — PARTIALLY VALIDATED |
| Real environment validation | `npm run test:itam:form-sync:real` | **REAL_ENVIRONMENT_PARTIAL** (auth/schema PASS; writes BLOCKED — no ITAM form) |
| Phase A network discovery | `npm run test:itam:discovery` | **PASS** (regression) |
| Phases B–D | `npm run test:itam:phases-bd` | **PASS** (regression) |
| Combined | `npm run test:itam:all` | Run before merge |

Mock coverage includes: schema discovery/cache/evolution, mapping preview/approve, dry-run, CREATE/UPDATE/NO_CHANGE, IP change no-dupe, stale mapping block, provenance/history, tenant isolation, secrets hygiene, metrics.

Evidence: `docs/evidence/itam-form-sync.json`, `docs/evidence/itam-form-sync-real.json`

---

## 16. REAL ENVIRONMENT VALIDATION

**Verdict: `REAL_ENVIRONMENT_PARTIAL`**

**Date:** 2026-09-30 (configuration attempt)  
**Environment type:** Cursor cloud agent → live TopSqill Supabase Edge Form API  
**Evidence:** `docs/evidence/itam-form-sync-real.json`

### Discovered API contract (actual)

| Item | Value |
|------|-------|
| API base URL (redacted host kept) | `https://fnmkczsvwpzpxyklztkt.supabase.co/functions/v1/form-api` |
| Form list | `GET /forms` |
| Form get | `GET /forms/{formId}` |
| Fields | `GET /forms/{formId}/fields` |
| Schema | `GET /forms/{formId}/schema` |
| Records list/search | `GET /forms/{formId}/records` |
| Record get | `GET /forms/{formId}/records/{recordId}` |
| Record create | `POST /forms/{formId}/records` |
| Record update | `PUT/PATCH /forms/{formId}/records/{recordId}` |
| Auth method | Bearer token via `credentialReferenceId` → SecretProvider (`BEARER_TOKEN`) |
| Nest alternate | `GET /api/form-api/forms` exists but requires **user JWT** (global `SupabaseAuthGuard`) → 401 with anon key |
| Incorrect default | `GET /api/forms` on Nest → **404** (must not assume this path) |

Response envelope: `{ success: true, data: ... }` (HttpExistingAppTarget unwraps this).

### Connectivity

| Check | Result |
|-------|--------|
| API_CONNECTIVITY | **PASS** |
| FORM_API_CONNECTIVITY | **PASS** |
| Real API authentication | **PASS** |
| Real form discovery | **PASS** (5 forms) |
| Real schema retrieval | **PASS** (Demo Form, 5 fields, ~1174 ms) |

### Forms discovered (names only)

Employee Onboarding Form, GRC, Report Test Form, Demo Form, Comprehensive Employee Onboarding & Personal Record.

**ITAM Asset form count: 0**

Configured probe form for schema only: **Demo Form** (`04418ba4-0f24-429f-8f43-8c58953e7e9b`).  
Writes against non-ITAM forms are **refused** unless `ITAM_SYNC_ALLOW_NON_ITAM_WRITE=1` (not set).

### Status table

| Test | Result |
|---|---|
| Real API authentication | PASS |
| Real form discovery | PASS |
| Real schema retrieval | PASS |
| Real discovery | BLOCKED |
| Real correlation | BLOCKED |
| Real mapping | BLOCKED |
| Real reference resolution | BLOCKED |
| Real dry run | BLOCKED |
| Real CREATE | BLOCKED |
| Real UPDATE | BLOCKED |
| Duplicate prevention | BLOCKED |
| IP change | BLOCKED |
| Software synchronization | BLOCKED |
| Provenance | BLOCKED |
| Audit | BLOCKED |
| Failure handling | BLOCKED |
| Security | PASS |

### Write / full-chain status

**REAL_WRITE_TEST = BLOCKED** — no authorized ITAM Asset form in the tenant; no CREATE/UPDATE executed; mock evidence not relabeled as real write success.

### Required to complete full chain

1. Create a dedicated TEST/UAT **ITAM Asset** form in TopSqill (hostname/IP/serial/OS/external_id fields as needed).
2. Set `ITAM_SYNC_FORM_ID` to that form’s UUID.
3. Store a gateway/user bearer in SecretProvider under `ITAM_SYNC_CREDENTIAL_REF` (do not commit secrets). Prefer real `service_role` for Nest FormApiService paths if using Nest; edge Form API accepts gateway bearer for reads.
4. Discover one authorized lab asset (`ITAM_SYNC_ASSET_EXTERNAL_ID`).
5. Re-run: `npm run test:itam:form-sync:real`

### Configuration used this run (non-secret)

```bash
ITAM_SYNC_REAL=1
ITAM_SYNC_BASE_URL=https://<project>.supabase.co/functions/v1/form-api
ITAM_SYNC_CREDENTIAL_REF=itam-sync-form-api-bearer
ITAM_SYNC_FORM_ID=<Demo Form UUID — schema probe only>
ITAM_SYNC_ORG_ID=<Demo_Organization UUID>
ITAM_SYNC_FORMS_PATH=/forms
ITAM_SYNC_FORM_FIELDS_PATH=/forms/{formId}/fields
ITAM_SYNC_RECORDS_PATH=/forms/{formId}/records
ITAM_SYNC_RECORD_BY_ID_PATH=/forms/{formId}/records/{recordId}
ITAM_SYNC_BOOTSTRAP_ANON_GATEWAY=1   # lab: maps publishable anon key into ref — not a privilege elevation
```

See also `backend/.env.vis.example`.

---

## 17. Known limitations

1. Real Form API auth + schema **PASS**; full CREATE/UPDATE/idempotent chain **BLOCKED** until an ITAM Asset form + lab asset exist.
2. Local `SUPABASE_SERVICE_ROLE_KEY` JWT role remains **`anon`** (known misconfig from pilot diagnostic) — Nest FormApiService writes would still be RLS-limited if used with that key.
3. Software / NIC / cloud-resource entity sync uses the same engine; dedicated multi-form fixtures beyond Asset form are thinner than Asset.
4. Ambiguous-match workflow UI is status-aware; dedicated multi-match resolution UX is minimal.
5. BullMQ dedicated sync worker chain is not a separate queue topology in this phase — sync runs in-process via Nest service/engine.
6. Live reference auto-create policies need per-tenant configuration before production.

---

## 18. Required production configuration

1. Apply migrations: `supabase/migrations/20260930140000_itam_form_sync.sql` (and Nest `sql/itam_form_sync.sql` when using dedicated PG).
2. Configure sync target: Form API base URL `…/functions/v1/form-api` + path overrides `/forms…` + `credentialReferenceId` in SecretProvider.
3. Set `targetFormId` / `ITAM_SYNC_FORM_ID` to a real **ITAM Asset** form (not HR/demo forms).
4. Discover schema → propose mappings → **approve** under RBAC.
5. Dry-run until WOULD_* outcomes match expectations.
6. Execute against an authorized lab form/record set first.
7. Enable `ITAM_DISCOVERY_PERSISTENCE=postgres` for durable sync metadata.
8. Monitor `/api/itam/sync/metrics` and audit trails.
9. Re-run `npm run test:itam:form-sync:real` until classification is `REAL_ENVIRONMENT_VALIDATED`.

---

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/itam/sync/targets` | List targets |
| POST | `/api/itam/sync/targets` | Create target |
| GET | `/api/itam/sync/targets/:id/forms` | Discover forms |
| GET | `/api/itam/sync/schema/:form` | Schema (header `x-sync-target-id`) |
| GET | `/api/itam/sync/mappings` | List mappings |
| POST | `/api/itam/sync/mappings/preview` | Propose mappings |
| POST | `/api/itam/sync/mappings/:id/approve` | Approve |
| POST | `/api/itam/sync/preview` | Dry-run |
| POST | `/api/itam/sync/execute` | Execute |
| GET | `/api/itam/sync/runs` | List runs |
| GET | `/api/itam/sync/runs/:id` | Run detail |
| GET | `/api/itam/sync/history/:assetId` | History |
| GET | `/api/itam/sync/provenance/:assetId` | Provenance |
| GET | `/api/itam/sync/metrics` | Counters |

UI: **IT Assets → Form Sync** (`FormSyncPanel`).

---

## Classification summary

| Area | Classification |
|------|----------------|
| Mock pipeline (schema → map → dry-run → create/update/idempotent) | **PASS** |
| Schema evolution without hardcoded IDs | **PASS** |
| Security / tenant isolation (mock) | **PASS** |
| Real Form API connectivity + auth + schema | **PASS** |
| Real ITAM CREATE / UPDATE / duplicate chain | **BLOCKED** (no ITAM form) |
| Overall | **PARTIALLY VALIDATED** (`REAL_ENVIRONMENT_PARTIAL`) |

### Recommended next step

Create an authorized TEST **ITAM Asset** form in TopSqill, set `ITAM_SYNC_FORM_ID`, provision one lab discovery asset, then re-run `npm run test:itam:form-sync:real` for the full dry-run → CREATE → NO_CHANGE → UPDATE chain.
