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
| Real environment preflight | `npm run test:itam:form-sync:real` | **REAL_ENVIRONMENT_BLOCKED** |
| Phase A network discovery | `npm run test:itam:discovery` | **PASS** (regression) |
| Phases B–D | `npm run test:itam:phases-bd` | **PASS** (regression) |
| Combined | `npm run test:itam:all` | Run before merge |

Mock coverage includes: schema discovery/cache/evolution, mapping preview/approve, dry-run, CREATE/UPDATE/NO_CHANGE, IP change no-dupe, stale mapping block, provenance/history, tenant isolation, secrets hygiene, metrics.

Evidence: `docs/evidence/itam-form-sync.json`, `docs/evidence/itam-form-sync-real.json`

---

## 16. REAL ENVIRONMENT VALIDATION

**Verdict: `REAL_ENVIRONMENT_BLOCKED`**

**Date:** 2026-09-30  
**Environment type:** Cursor cloud agent (Nest platform on `:3001`)  
**Target application version:** unavailable (no Form API configured)  
**Target form:** unavailable  
**Test asset type:** none selected (blocked before asset selection)  
**Execution IDs / target record IDs:** none (no live writes attempted)  
**Measured API/write latency:** n/a  
**Duplicate count before/after:** n/a (no live sync)  
**Fields successfully synchronized (live):** none  

### Pre-flight findings (non-secret)

| Config | Status |
|--------|--------|
| `ITAM_SYNC_REAL=1` | **MISSING** |
| `ITAM_SYNC_BASE_URL` (authorized Form API) | **MISSING** |
| `ITAM_SYNC_CREDENTIAL_REF` (credentialReferenceId) | **MISSING** |
| SecretProvider entry for that ref | **MISSING** (`VIS_SECRET_PROVIDER` unset) |
| `ITAM_SYNC_FORM_ID` | **MISSING** |
| `ITAM_SYNC_ORG_ID` / `ITAM_DEFAULT_ORG_ID` | **MISSING** |
| Local Nest `/api/health` | 200 (platform up) |
| Local Nest `/api/forms` | **404** — Nest is not the existing-application Form API SoR |

Implemented platform sync APIs remain under `/api/itam/sync/*`. Existing-application Form API contract (defaults): `/api/forms`, `/api/forms/{formId}/fields`, `/api/forms/{formId}/records`, `/api/forms/{formId}/records/{recordId}` via `HttpExistingAppTarget` + `InternalApplicationConnector` (bearer + `credentialReferenceId`).

**No live Form API authentication or write was attempted.** Mock evidence was not relabeled as real.

### Status table

| Test | Result |
|---|---|
| Real API authentication | BLOCKED |
| Real form discovery | BLOCKED |
| Real schema retrieval | BLOCKED |
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
| Security | BLOCKED |

### Failures / limitations (this attempt)

1. Authorized existing-application Form API base URL not configured in this environment.
2. No sync `credentialReferenceId` + SecretProvider-backed credential available.
3. No target ITAM form id / org context for a controlled test.
4. Local Nest health is OK but does not expose `/api/forms` — Supabase REST is the platform DB and is **not** used as a Form API write path for this validation (SoR rule).

### Required to unblock

1. `ITAM_SYNC_REAL=1`
2. `ITAM_SYNC_BASE_URL=<authorized Form API base URL>`
3. `ITAM_SYNC_CREDENTIAL_REF=<credentialReferenceId>` with secret stored in SecretProvider
4. `ITAM_SYNC_FORM_ID=<ITAM Asset form id>`
5. `ITAM_SYNC_ORG_ID=<organization UUID>`
6. One authorized test asset in discovery (or `ITAM_SYNC_ASSET_EXTERNAL_ID` after discovery)

Then run: `npm run test:itam:form-sync:real`

---

## 17. Known limitations

1. Real existing-application E2E **BLOCKED** in this environment (missing Form API endpoint + credentials).
2. Software / NIC / cloud-resource entity sync uses the same engine; dedicated multi-form fixtures beyond Asset form are thinner than Asset.
3. Ambiguous-match workflow UI is status-aware; dedicated multi-match resolution UX is minimal.
4. BullMQ dedicated sync worker chain is not a separate queue topology in this phase — sync runs in-process via Nest service/engine (retry/rate-limit patterns available via VIS infra for future wiring).
5. Live reference auto-create policies need per-tenant configuration before production.

---

## 18. Required production configuration

1. Apply migrations: `supabase/migrations/20260930140000_itam_form_sync.sql` (and Nest `sql/itam_form_sync.sql` when using dedicated PG).
2. Configure sync target: Form API base URL + `credentialReferenceId` in SecretProvider.
3. Set `targetFormId` to the real ITAM Asset form (and additional forms as needed).
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
| Real Form API E2E | **REAL_ENVIRONMENT_BLOCKED** |
| Overall | **PARTIALLY VALIDATED** |

### Recommended next step

Provide authorized Form API URL + `credentialReferenceId` (SecretProvider) + target form id + org id + one lab asset, then re-run `npm run test:itam:form-sync:real` to complete the live CREATE → NO_CHANGE → UPDATE chain.
