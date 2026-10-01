# Platform Promotion Readiness

**CURRENT ENVIRONMENT: DEV ONLY**

**FUTURE TARGET:**

```
DEV
 ↓
QA
 ↓
PROD
```

QA and PROD are **NOT** implemented in this phase.  
This document audits the DEV platform and records the foundation required so QA/PROD can be introduced later without redesign.

---

## QA blocker status (this phase)

| Blocker | Status |
|---|---|
| UUID hardcoding (workflows/reports/dashboards/role_permissions) | **PASS** |
| Stable form field keys | **PASS** |
| Connector secret migration (`credentialReferenceId`) | **PASS** |
| Real Supabase/Postgres promotion import | **PASS** |

**Overall: `QA_READY`** (verified against real PostgreSQL `platform_promotion`; remote Supabase must apply migrations `20261001080000` + `20261001120000`).

### How each blocker was resolved

1. **UUID hardcoding** — Packages export `resourceKey` / formKey / reportKeys (logical). Import resolves to target UUIDs via `promotion_key_map`. `role_permissions.resource_logical_key` added; env A UUID ≠ env B UUID for the same key.
2. **Form field keys** — `form_fields.logical_key` + deterministic backfill from `custom_config` / label; ITAM sync prefers `logical_key` when discovering schema.
3. **Connector secrets** — Integrations hub stores connectors in `data_source_connections`. Secrets migrate to `platform_secret_blobs` via SecretProvider; `http_auth_config` retains public metadata only; UI requires `credentialReferenceId`.
4. **Real persistence** — `PROMOTION_DATABASE_URL` + `PromotionPgStore` transactional import; dry-run proven not to mutate snapshots; restart re-verifies rows.

### Remaining limitations (not blockers)

- Remote Supabase DDL must be applied by operators (pooler password not available in this agent for live project DDL).
- Workflow *canvas* JSON in production rows may still contain legacy UUIDs until re-exported; rewriter converts on export/import when id→key map is provided.
- Memory `promotion-test-*` namespaces remain available for unit tests; production path is postgres.
- QA/PROD environments themselves are still **not provisioned**.

### Live dual-write inventory (post-blocker audit)

Promotion packages are logical-key based (`resourceKey` / `formKey` / `reportKeys` + `rewriteUuidRefs`). Some **runtime writers** still persist environment UUIDs for local operation. Classification:

| Finding | Paths (representative) | Class |
|---|---|---|
| `role_permissions.resource_id` UUID + `resource_logical_key` | `useCreateRole.ts` (dual-write), access hooks still match UUID at runtime | **FIXED** (portable key on write) / **EXPECTED** (runtime still resolves local UUID) |
| Report `config.formId` / field UUID slots in `report_components.config` | `useReports.ts`, `ComponentConfigDialog.tsx`, chart/table configs | **EXPECTED** — export must rewrite via id→key map; import restores local UUIDs |
| Dashboard↔report FK `reports.dashboard_id` | `useDashboards.ts` | **EXPECTED** — promote via `reportKeys`, re-link FK on import |
| Workflow node/trigger `*FormId` / `*FieldId` / `source_form_id` | `WorkflowDesigner.tsx`, `useTriggerManagement.ts`, `nodeCompiler.ts` | **EXPECTED** — same rewrite-on-export pattern |
| Form `customConfig.assignRole` / cross-ref form UUIDs | FormBuilder user-picker / cross-ref config | **EXPECTED** |
| Hardcoded KPI form/field UUIDs | `useHierarchyKPI.ts`, KPI `RecordDetailView` panels | **DOCUMENTED EXCEPTION** — replace with logical keys before promoting that KPI pack |
| Docs/examples using sample UUIDs | `ApiDocs.tsx`, `QueryExamplesPopover.tsx` | **TEST-ONLY** / docs — not runtime identity |
| Asset/SEO image UUID paths | `seo.ts`, headers | **EXPECTED** — not config identity |

**Rule:** local UUID identity for runtime queries is fine; **portable packages must not treat those UUIDs as cross-env identity**. Export/import + `resource_logical_key` / field `logical_key` close the promotion path.
## Phase scope

| In scope | Out of scope |
|---|---|
| Full component inventory + API audit | Creating QA or PROD |
| Classification (config / env / transactional / reference / secret) | Full CI/CD multi-env deploy pipeline |
| Logical-key strategy + nullable DB columns | Cloning the DEV database |
| Package manifest + export/import/dry-run foundation | Promoting real users to future PROD |
| DEV-only round-trip into `promotion-test-*` namespaces | Implementing GRC/HRSD product packs |
| Documentation + status matrix | Copying secrets between environments |

---

## Architecture (future-safe)

```
Git (code + migrations + packages)
        ↓
Schema migrations (identical across envs)
        ↓
DEV  ──package──►  QA  ──package──►  PROD   (future)
 ↑
 └── this phase: export/import/dry-run inside DEV only
```

**Never:** copy DEV DB → QA/PROD.  
**Never:** put secrets in packages.  
**Always:** resolve `logical_key` → environment-local UUID at import time.

---

## Existing related capabilities (pre-foundation)

Discovered in-repo; **not** a cross-environment config package:

| Capability | Location | Promotion relevance |
|---|---|---|
| Form UI duplicate | `FormsList.tsx` / `FormContext.duplicateForm` | Same-env clone only; FormsList deep-copies fields, FormContext path is shallower |
| Excel form-schema import | `ExcelFormImporter.tsx` | Schema seed, not package promote |
| Submission import/export | `ImportDialog`, `ExportDropdown`, `exportUtils` | **Transactional data** — do not promote |
| VIS integration promote | `vis/governance` `promote()` | Strips credentials; VIS env labels only — not platform QA/PROD |
| VIS marketplace package scan | `vis/marketplace` | Rejects embedded secret patterns |
| ITAM form sync | `itam/sync/*` | External Form API sync with `credentialReferenceId`; not platform package promote |
| User CSV import | `UserImportDialog` | Can include password column — **not scrubbed**; never use for env promotion |

## Foundation delivered in this phase

| Capability | Location |
|---|---|
| Package types + manifest | `backend/src/promotion/types.ts`, `package.ts` |
| Secret scrubbing | `backend/src/promotion/secrets.ts` |
| Logical key helpers + UUID rewrite | `backend/src/promotion/logical-keys.ts` |
| Export builder | `backend/src/promotion/exporter.ts` |
| Dry-run / import / verify | `backend/src/promotion/importer.ts` |
| Isolated DEV namespaces | `backend/src/promotion/store.ts` (`promotion-test-*` prefix required) |
| Nest API | `GET/POST /api/promotion/*` |
| Logical key migration | `supabase/migrations/20261001080000_platform_logical_keys.sql` |
| Tests | `backend/test/promotion/promotion.foundation.test.ts` |

### Package shape (example)

```yaml
package:
  key: grc
  version: 1.0.0
  sourceEnvironment: DEV
requires:
  platformVersion: ">=1.0.0"
components:
  - project
  - forms
  - form_fields
  - workflows
  - roles
  - notifications
  - integrations
  - reference_data
  - reports
  - dashboards
```

Dry-run actions: `CREATE | UPDATE | NO_CHANGE | CONFLICT | MISSING_DEPENDENCY | INVALID_REFERENCE | BLOCKED`.

---

## Inventory summary

Configurable objects discovered beyond the minimum list:

- Organizations, Projects, Forms, Form Fields, Form Access / Permissions JSON
- Users, Groups, Roles, Role Permissions, User Role Assignments, Project Users
- Workflows (+ execution/queue engines — transactional)
- Reports, Dashboards, Relationship maps
- Email config / Email templates (env + config mix)
- Data Feeds / Data source connections (config + secrets)
- Outbound connectors (integrations; credentials JSON — **secrets**)
- VIS integrations (separate governance promote; in-memory/Prisma VIS store)
- ITAM: discovery scopes, cloud/vmware providers, sync targets/mappings (**config**); discovered assets (**transactional**)
- SLA templates/instances, Audit programs/findings, Knowledge base / policies
- Notifications table (per-user inbox — **transactional**)
- Blog CMS (platform content; not tenant business config)
- LDAP settings, MFA, Sessions, API keys (public-api)

See also:

- `docs/PLATFORM_API_COVERAGE.md`
- `docs/PLATFORM_COMPONENT_DEPENDENCIES.md`
- `docs/PLATFORM_ENVIRONMENT_STRATEGY.md`

---

## Status matrix

Legend: **READY** | **PARTIAL** | **BLOCKED** | **NOT_APPLICABLE**

| Component | API | CRUD | Logical Key | Export Ready | Import Ready | Dependencies | Environment Specific | Promotion Status |
|---|---|---|---|---|---|---|---|---|
| Projects | PARTIAL | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Forms | READY | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Form Fields | READY | READY | READY | READY | READY | READY | PARTIAL | READY |
| Users | PARTIAL | READY | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | READY | READY | NOT_APPLICABLE |
| Groups | PARTIAL | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Roles | PARTIAL | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Permissions | PARTIAL | READY | READY | READY | READY | READY | PARTIAL | READY |
| Notifications (inbox) | PARTIAL | READY | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | READY | READY | NOT_APPLICABLE |
| Notification templates / email templates | PARTIAL | READY | BLOCKED | PARTIAL | PARTIAL | READY | READY | PARTIAL |
| Workflows | READY | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Integrations (outbound connectors) | PARTIAL | READY | READY | READY | READY | READY | READY | READY |
| Mappings (ITAM/VIS/data-feeds) | PARTIAL | READY | BLOCKED | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Transformations | PARTIAL | PARTIAL | BLOCKED | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Reference data (choice options / categories) | PARTIAL | PARTIAL | BLOCKED | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Business rules (form_rules / field_rules) | PARTIAL | READY | BLOCKED | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Schedules (data feeds / connectors / cron) | PARTIAL | PARTIAL | BLOCKED | PARTIAL | PARTIAL | READY | READY | PARTIAL |
| Reports | READY | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Dashboards | PARTIAL | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| ITAM configuration (scopes/targets/mappings) | READY | READY | PARTIAL | PARTIAL | PARTIAL | READY | READY | PARTIAL |
| ITAM assets / discovery results | READY | READY | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | READY | READY | NOT_APPLICABLE |
| Attachments / storage config | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | READY | READY | BLOCKED |
| Audit configuration | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | READY | PARTIAL | BLOCKED |
| Audit / execution history | PARTIAL | READY | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | READY | READY | NOT_APPLICABLE |
| VIS integrations | READY | READY | PARTIAL | PARTIAL | PARTIAL | READY | READY | PARTIAL |
| Organizations | PARTIAL | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Data Feeds | PARTIAL | READY | BLOCKED | PARTIAL | PARTIAL | READY | READY | PARTIAL |
| Promotion package engine (foundation) | READY | READY | READY | READY | READY | READY | PARTIAL | READY |
| Promotion postgres import (QA blockers) | READY | READY | READY | READY | READY | READY | PARTIAL | READY |

### Matrix notes

- **API READY** means a dedicated Nest/public/form API exists for primary operations. **PARTIAL** means CRUD is primarily via Supabase PostgREST (`supabase.from(...)` and/or `/api/database/*`), not a first-class REST resource API.
- **Logical Key READY** for form fields / permissions means schema + import/export resolution paths exist; operators must apply migrations and backfill on each environment.
- **Users / transactional rows** are **NOT_APPLICABLE** for automatic promotion.
- Promotion engine supports **postgres** persistence (`PROMOTION_DATABASE_URL`) and memory unit namespaces.

---

## Critical items before provisioning QA infra

1. Apply migrations `20261001080000_platform_logical_keys.sql` and `20261001120000_promotion_qa_blockers.sql` on the target Supabase project.
2. Run `POST /api/promotion/backfill-field-keys` and `POST /api/promotion/migrate-connector-secrets?dryRun=false` on each env after DDL.
3. Re-export existing workflows/reports so canvas/config JSON uses logical keys (rewriter assists when id maps exist).
4. Bind environment-specific `credentialReferenceId` values in SecretProvider — never copy secret material.
5. QA/PROD tenants themselves are still **not created** in this phase.

---

## Logical key introduction strategy (safe)

1. Add nullable `logical_key` (done in migration) + partial unique indexes on projects, forms, form_fields, workflows, roles, groups, reports, dashboards, organizations, outbound_connectors.
2. Prefer existing `reference_id` (forms/workflows/reports/dashboards/policies); Form API / Public API already resolve forms (and similar) by `reference_id`.
3. Backfill from `reference_id` where present (done in migration).
4. Note: `itam_topology_nodes.logical_key` already existed (UNIQUE per org) before this phase — reuse that pattern.
5. `form_fields` historically had **no** logical key (UUID + label only) — highest-priority gap for report/workflow bindings.
6. UI: allow editors to set logical keys; do not break UUID URLs.
7. New workflow/report bindings should store logical keys; maintain dual-resolve (UUID or key) during transition.
8. Import maps `logical_key` → local UUID; never assume ID equality across environments.

---

## Security checklist

| Rule | Status |
|---|---|
| Secrets never in packages | Enforced by `scrubSecrets` / `assertNoSecrets` |
| Secrets never in Git | Continue existing policy; connectors must move off plaintext JSON |
| Secrets never in export logs | Scrubber strips before package build |
| Credential references only | `credentialReferenceId` / `credential_reference_id` |
| Tenant isolation | Existing RLS retained; promotion APIs require auth |
| Promotion audit model | Defined (`PromotionAuditRecord`); DEV namespace audits retained in-memory |

---

## Audit model (future deployments)

Required fields (implemented in foundation types):

- package key + version
- source environment / target environment
- target namespace
- initiated by / approved by
- timestamp
- result (`DRY_RUN | SUCCESS | PARTIAL | FAILED`)
- component diffs
- failures

No QA/PROD deployment records are created in this phase.

---

## Testing

```bash
npm --prefix backend run test:promotion
npm --prefix backend run test:promotion:qa   # requires PROMOTION_DATABASE_URL (real Postgres)
npm --prefix backend run test:itam:form-sync
npm --prefix backend run test:itam:phases-bd
npm --prefix backend run test:itam:discovery
# optional real env (unchanged):
npm --prefix backend run test:itam:form-sync:real
```

---

## Related docs

- `docs/PLATFORM_API_COVERAGE.md`
- `docs/PLATFORM_COMPONENT_DEPENDENCIES.md`
- `docs/PLATFORM_ENVIRONMENT_STRATEGY.md`
- `docs/ITAM_FORM_SYNC_READINESS.md` (prior ITAM work; must remain green)
