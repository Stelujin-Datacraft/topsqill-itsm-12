# Promotional Transfer — Technical Design

Archer-style **selective** Dev → Prod promotion for TopSkill ITSM configuration.
Not CI/CD, not schema migration, not full DB clone, not file export/import.

## Core business rules

1. Only objects registered as promotable appear in the UI.
2. Only objects explicitly selected by a System Administrator are promoted, plus explicitly required dependencies the admin chooses to include.
3. No approval workflow — System Administrator (`user_profiles.role === 'admin'`) executes directly.
4. Production is protected: no blind overwrite, no unrelated deletes, no credential exposure to the frontend.

---

## 1. Frontend architecture

| Area | Approach |
|------|----------|
| Routes | `/promotional-transfer`, `/promotional-transfer/new`, `/promotional-transfer/:id` under `ProtectedLayout` |
| Access | UI gated on `userProfile.role === 'admin'`; all mutating APIs re-check admin server-side |
| Nav | Admin-only item under Administration: **Promotional Transfer** |
| State | Wizard steps in page state; package persisted via Nest API after each major step |
| API | `src/services/api/promotionApi.ts` → `GET/POST /api/promotion/*` with Bearer token |

Screens: Dashboard → Create (source/target → module → objects) → Contents/Dependencies → Validation → Summary → Execute → Result; plus History/Detail.

## 2. Backend architecture

NestJS module `PromotionModule` mounted at `/api/promotion`:

- `PromotionController` — HTTP surface (admin-guarded)
- `PromotionService` — package lifecycle orchestration
- `PromotableObjectRegistry` — static catalog of supported types
- Handlers per object type (`FormHandler`, `WorkflowHandler`, …) — list / read / version / dependencies / transfer
- Engines: dependency, validation, conflict, transfer, env-value sanitizer
- `PromotionEnvironmentService` — config-driven Dev/Prod Supabase clients (credentials never sent to UI)

## 3. Database model

Tables (service-role access; RLS admin-only):

- `promotion_packages` — logical package / request
- `promotion_package_items` — selected objects + dependency flags + per-item results
- `promotion_validation_results` — ready / warning / conflict findings
- `promotion_audit_events` — append-only audit trail
- `promotion_object_versions` — Dev/Prod version snapshots after successful promote
- `promotion_target_snapshots` — logical Prod state when dual-DB Prod URL is not configured

## 4. Promotable Object Registry

Central TypeScript registry (`promotable-registry.ts`). Each entry:

| Field | Purpose |
|-------|---------|
| `objectType` | Stable key (`form`, `workflow`, `report`, `dashboard`, `email_template`) |
| `displayName` | UI label |
| `module` | Module grouping for Step 3 |
| `promotable` | Must be `true` to appear |
| `supportsRecordSelection` | Individual records selectable |
| `hasDependencies` | Dependency engine applies |
| `promotionStrategy` | `upsert_by_stable_id` |
| `conflictStrategy` | `block` \| `warn_and_update` |
| `versioning` | `content_hash` \| `updated_at` |
| `childTypes` | Non-selectable children transferred with parent (e.g. `form_fields`) |

**Not registered (never selectable):** form_submissions, tickets/incidents, audit logs, workflow_queue, sessions, temp data.

## 5. Promotion Package model

Statuses: `Draft` → `Validating` → `Ready` | `Failed` → `Promoting` → `Completed` | `Failed` | `PartiallyCompleted`.

Fields: id, name, source/target env keys, module, created_by, timestamps, validation summary JSON, execution times, error details.

## 6. Object selection mechanism

1. Admin picks module → API lists only registry types for that module from **Dev**.
2. Admin selects record IDs (stable_id = `reference_id` if present else `id`).
3. Package items stored with `selection_source: explicit | dependency`.
4. Unselected siblings are never transferred.

## 7. Dependency detection

Handlers declare `discoverDependencies(payload)`. Examples:

- Workflow node `config` referencing a form id → dependency on that form
- Report with `dashboard_id` → optional dashboard dependency
- Dashboard layout widgets referencing report ids → report dependencies

UI message: *“Form A requires Workflow A. Workflow A is not currently selected.”* Admin can include.

## 8. Validation engine

Checks: unsupported type, missing deps, Prod existence/diff, duplicate stable ids, broken refs, env-specific values needing strip, unsafe objects.

Severity: `ready` | `warning` | `conflict`. Conflicts block execute unless cleared.

## 9. Dev → Prod transfer engine

1. Load selected + included-dependency items from Dev (source client).
2. Sanitize env-specific fields.
3. For each item in dependency order: upsert into Prod by stable_id.
4. Record per-item success/skip/fail; update package status accordingly.
5. Never download/upload files; never run arbitrary SQL from the UI.

## 10. Conflict detection

Compare portable payload hashes and metadata (name collisions with different stable_id → conflict). Existing identical → skip. Differing same stable_id → update (warn). Name collision different id → conflict.

## 11. Versioning

Version string = content hash of portable JSON (or `updated_at` fallback). Stored on items and in `promotion_object_versions` (dev_version, prod_before, prod_after, promoted_at, promoted_by).

## 12. Environment-specific configuration

`sanitizeForPromotion(objectType, payload, targetCtx)` strips/replaces:

- Secrets, SMTP passwords, API keys in node config
- Absolute Dev URLs → leave Prod values untouched when updating
- `organization_id` / `project_id` remapped via env map
- `created_by` set to promoting admin on insert

Portable fields (labels, layout, rules, node graph structure) transfer.

## 13. Production safety

- Only package items mutate Prod
- No deletes of unselected Prod objects
- Upsert only; transactional per-object where possible; stop-on-hard-fail configurable
- Dual credentials only on server

## 14. Audit logging

Every package lifecycle event → `promotion_audit_events`. Detail view shows selected / promoted / skipped / failed + before/after versions.

## 15. Error handling

Per-item try/catch; package becomes `Failed` or `PartiallyCompleted`. Never report full success if any item failed.

## 16. Recovery / rollback

Preferred: per-object upsert (idempotent retry). Before overwrite, store `prod_before` snapshot on the item for manual recovery. No automatic mass rollback of successful siblings (documented); admin can re-promote corrected Dev objects.

## 17. System Administrator authorization

`assertAdmin(userId)` via `user_profiles.role === 'admin'` on every mutating and listing endpoint. Non-admins: 403. History: admin-only for v1 (same gate).

## 18. API design

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/promotion/dashboard` | Counters + recent |
| GET | `/promotion/environments` | Configured source/target (no secrets) |
| GET | `/promotion/modules` | Modules with promotable types |
| GET | `/promotion/objects` | List Dev objects for module/type |
| GET | `/promotion/packages` | History |
| POST | `/promotion/packages` | Create draft |
| GET | `/promotion/packages/:id` | Detail |
| PUT | `/promotion/packages/:id/selection` | Set selected objects |
| POST | `/promotion/packages/:id/dependencies` | Resolve deps |
| POST | `/promotion/packages/:id/validate` | Run validation |
| POST | `/promotion/packages/:id/execute` | Promote |
| GET | `/promotion/registry` | Registry catalog |

## 19. UI screens and workflow

Dashboard → Create New → Source/Target (fixed Dev→Prod) → Module → Select objects → Review deps → Validate → Summary → Promote → Result / History detail.

## 20. Security considerations

- Admin-only; CSRF via same-origin + Bearer
- No DB credentials in responses
- No arbitrary table/SQL endpoints
- Registry whitelist only
- Throttling via existing Nest throttler
- Audit trail immutable append

---

## Initial promotable types

| Type | Module | Children |
|------|--------|----------|
| `form` | Forms | `form_fields` |
| `workflow` | Workflows | `workflow_nodes`, `workflow_connections` |
| `report` | Reports | — |
| `dashboard` | Reports | — |
| `email_template` | Notifications | — |

## Environment configuration

```
PROMOTION_SOURCE_KEY=TopsqillITSM_Dev
PROMOTION_TARGET_KEY=TopsqillITSM_Prod
PROMOTION_PROD_SUPABASE_URL=...          # optional dual-DB
PROMOTION_PROD_SUPABASE_SERVICE_ROLE_KEY=...
PROMOTION_PROD_ORG_ID=...                # optional remap
PROMOTION_PROD_PROJECT_MAP={"dev-uuid":"prod-uuid"}
```

When Prod URL is unset, transfer writes to `promotion_target_snapshots` (logical Prod) so the module is fully exercisable in single-DB deployments.
