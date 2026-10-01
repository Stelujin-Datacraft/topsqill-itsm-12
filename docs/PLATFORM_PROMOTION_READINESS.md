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
| Form Fields | READY | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Users | PARTIAL | READY | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | READY | READY | NOT_APPLICABLE |
| Groups | PARTIAL | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Roles | PARTIAL | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Permissions | PARTIAL | READY | BLOCKED | PARTIAL | PARTIAL | READY | PARTIAL | BLOCKED |
| Notifications (inbox) | PARTIAL | READY | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | READY | READY | NOT_APPLICABLE |
| Notification templates / email templates | PARTIAL | READY | BLOCKED | PARTIAL | PARTIAL | READY | READY | PARTIAL |
| Workflows | READY | READY | PARTIAL | PARTIAL | PARTIAL | READY | PARTIAL | PARTIAL |
| Integrations (outbound connectors) | PARTIAL | READY | PARTIAL | PARTIAL | PARTIAL | READY | READY | PARTIAL |
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

### Matrix notes

- **API READY** means a dedicated Nest/public/form API exists for primary operations. **PARTIAL** means CRUD is primarily via Supabase PostgREST (`supabase.from(...)` and/or `/api/database/*`), not a first-class REST resource API.
- **Logical Key PARTIAL** means `reference_id` and/or newly added nullable `logical_key` exist but are not universally populated or enforced in UI/workflows.
- **Permissions BLOCKED** for promotion: `role_permissions.resource_id` is a UUID FK to forms/workflows/reports/projects — must move to logical `resource_key` before safe cross-env promotion.
- **Users / transactional rows** are **NOT_APPLICABLE** for automatic promotion.
- Foundation engine **READY** for DEV isolated namespaces only — not yet wired to write live Supabase tables.

---

## Critical blockers before QA exists

1. **Hardcoded UUIDs** inside workflow graphs, report configs, dashboard layouts, form pages, cross-refs, and `role_permissions.resource_id`.
2. **Form fields** historically lack stable keys (labels only / UUID ids in `pages` JSON).
3. **Outbound connector `credentials` JSONB** must never be packaged; use `credential_reference_id` only (column added; UI/API migration incomplete).
4. **No live Supabase import writer** yet — foundation imports into in-memory `promotion-test-*` namespaces.
5. **Environment config model** documented but QA/PROD not provisioned (by design).
6. **Group membership / user assignments** must stay environment-specific.
7. **Attachment/storage bucket** names and signed URL patterns are environment-specific; config promotion incomplete.

---

## Logical key introduction strategy (safe)

1. Add nullable `logical_key` (done in migration) + partial unique indexes.
2. Prefer existing `reference_id` (forms/workflows/reports/dashboards); Form API already resolves forms by `reference_id`.
3. Backfill from `reference_id` where present (done in migration).
4. UI: allow editors to set logical keys; do not break UUID URLs.
5. New workflow/report bindings should store logical keys; maintain dual-resolve (UUID or key) during transition.
6. Import maps `logical_key` → local UUID; never assume ID equality across environments.

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
npm --prefix backend run test:itam:form-sync
npm --prefix backend run test:itam:phases-bd
# optional real env (unchanged):
npm --prefix backend run test:itam:form-sync:real
```

---

## Related docs

- `docs/PLATFORM_API_COVERAGE.md`
- `docs/PLATFORM_COMPONENT_DEPENDENCIES.md`
- `docs/PLATFORM_ENVIRONMENT_STRATEGY.md`
- `docs/ITAM_FORM_SYNC_READINESS.md` (prior ITAM work; must remain green)
