# ITAM Form Sync Readiness

**Branch:** `cursor/itam-form-sync-e654`  
**Date:** 2026-09-30  
**Overall: REAL_ENVIRONMENT_VALIDATED**

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
| List forms | `GET {formsPath}` → TopSqill: `/forms` under `…/functions/v1/form-api` (not Nest `/api/forms`) |
| Form fields | `GET {formFieldsPath}` → `/forms/{formId}/fields` |
| Search/list records | `GET {recordsPath}` / optional `searchPath` |
| Get record | `GET {recordByIdPath}` |
| Create | `POST {recordsPath}` |
| Update | `PUT/PATCH {recordByIdPath}` |

Live HTTP target: `HttpExistingAppTarget` in `backend/src/itam/sync/target.ts` (unwraps `{success,data}` envelopes; resolves `credentialReferenceId` → Bearer).  
Lab/mock: `MockExistingAppTarget` (`mock://existing-app` or `ITAM_SYNC_USE_MOCK=1`).

Configure path overrides via sync target / `ITAM_SYNC_*_PATH` env vars — do not assume `/api/forms`.

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
| Real environment validation | `npm run test:itam:form-sync:real` | **REAL_ENVIRONMENT_VALIDATED** (manual ITAM form CREATE/UPDATE/NO_CHANGE) |
| Phase A network discovery | `npm run test:itam:discovery` | **PASS** (regression) |
| Phases B–D | `npm run test:itam:phases-bd` | **PASS** (regression) |
| Combined | `npm run test:itam:all` | Run before merge |

Mock coverage includes: schema discovery/cache/evolution, mapping preview/approve, dry-run, CREATE/UPDATE/NO_CHANGE, IP change no-dupe, stale mapping block, provenance/history, tenant isolation, secrets hygiene, metrics.

Evidence: `docs/evidence/itam-form-sync.json`, `docs/evidence/itam-form-sync-real.json`

---

## 16. REAL ENVIRONMENT VALIDATION

**Verdict: `REAL_ENVIRONMENT_VALIDATED`**

**Date:** 2026-09-30  
**Environment type:** Cursor cloud agent → live TopSqill Edge Form API  
**Evidence:** `docs/evidence/itam-form-sync-real.json`

### REAL ITAM FORM VALIDATION

| Test | Result |
|---|---|
| Real API authentication | PASS |
| Manual ITAM form discovery | PASS |
| Live schema retrieval | PASS |
| Real discovery | PASS |
| Real correlation | PASS |
| Real mapping | PASS |
| Reference resolution | NOT_APPLICABLE |
| Dry run | PASS |
| Real CREATE | PASS |
| Real UPDATE | PASS |
| Duplicate prevention | PASS |
| Same record verification | PASS |
| Provenance | PASS |
| Audit | PASS |
| Security | PASS |

### Discovered API contract

| Item | Value |
|------|-------|
| API base URL | `https://fnmkczsvwpzpxyklztkt.supabase.co/functions/v1/form-api` |
| Form routes | `/forms`, `/forms/{id}/fields`, `/forms/{id}/schema`, `/forms/{id}/records` |
| Auth | Bearer via `credentialReferenceId` → SecretProvider |
| Nest `/api/forms` | 404 (not used) |

### Manually created ITAM form

| Item | Value |
|------|-------|
| Form ID | `d45d078e-9a83-4308-84fe-d2c8799670f9` |
| Form name | Enterprise IT Asset Lifecycle & Inventory Management |
| Reference | `EIA29873548` |
| Organization ID | `29accb8d-682f-4b2f-908a-b5a655c45375` |
| Field count | 43 |
| Existing records before test | 0 |

Demo Form / HR forms were **not** used for writes.

### Test asset (lab)

| Field | Value |
|-------|-------|
| Hostname | `lab-itam-sync-01` |
| Serial | `ITAM-LAB-SERIAL-001` |
| Machine GUID | `GUID-ITAM-LAB-001` |
| IP | `10.60.0.11` |
| MAC | `aa:bb:cc:60:00:11` |
| Source | NETWORK_DISCOVERY (discovery asset shape) |

### Sync results

| Step | Result |
|------|--------|
| Dry-run | WOULD_CREATE · write count unchanged · **PASS** |
| CREATE | target record `e897a6f8-12e2-4d46-82a6-269e61da6084` · ~6540 ms |
| Second run | **NO_CHANGE** · before=1 after=1 · same record ID |
| UPDATE | manufacturer `Dell` → `Dell Inc` · same record ID · ~8683 ms |
| Field verification | All mapped fields **MATCH** after CREATE |

### Mapped vs unmapped (summary)

Discovery-mapped: hostname, IP, MAC, serial, manufacturer, model, asset type.  
Lab constants (required non-discovery form fields): status, department, country, purchase date, audit timestamp, signature attestation.

### Execution IDs

- Dry-run: `dc6b8f1e-4a37-4423-b3a5-b1f39c1e24c7`
- CREATE: `f083666f-54c9-41bf-8fe9-ce6000b45b06`
- Second run: `14e03fe7-cacf-4d4a-9b01-f59b30305fe2`
- UPDATE: `f717a5af-3b81-47db-96b9-2595f66e5521`

### Security

- Writes only via Form API (`HttpExistingAppTarget`) — no direct DB/SQL
- `credentialReferenceId` only; secrets not logged
- Demo/HR forms refused by validator

### Remaining limitations

1. Required form fields without discovery counterparts use **explicit lab constants** (not invented as discovery facts).
2. Software synchronization not exercised in this Asset-form run.
3. Review mapping approvals before production (avoid over-matching toggles/headers).

---

## 17. Known limitations

1. Full real CREATE/UPDATE/idempotent chain **PASS** against manually created ITAM form (see §16).
2. Lab constants required for form-mandated non-discovery fields.
3. Software / NIC entity sync not validated in this Asset-form run.
4. BullMQ dedicated sync worker chain still in-process via Nest service/engine.

---

## 18. Required production configuration

1. Apply migrations: `supabase/migrations/20260930140000_itam_form_sync.sql`.
2. `ITAM_SYNC_BASE_URL=https://<project>.supabase.co/functions/v1/form-api`
3. Path overrides: `/forms`, `/forms/{formId}/fields`, `/forms/{formId}/records`, …
4. `ITAM_SYNC_FORM_ID=<ITAM Asset form UUID>`
5. `ITAM_SYNC_ORG_ID=<organization UUID>`
6. `ITAM_SYNC_CREDENTIAL_REF` + SecretProvider entry
7. Approve mappings under RBAC; dry-run before execute
8. Re-run: `npm run test:itam:form-sync:real`

See `backend/.env.vis.example`.

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
| Mock pipeline | **PASS** |
| Real Form API connectivity + auth + schema | **PASS** |
| Real ITAM CREATE / UPDATE / duplicate / same-record | **PASS** |
| Overall | **REAL_ENVIRONMENT_VALIDATED** |

### Recommended next step

Productionize mapping approvals (review lab constants), wire BullMQ sync stages, and optionally validate software-form sync as a follow-on.
