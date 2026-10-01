# Platform API Coverage

**CURRENT ENVIRONMENT: DEV ONLY**  
**FUTURE:** DEV → QA → PROD (QA/PROD not implemented)

A **frontend URL is not an API**. This document separates UI routes from real backend/data APIs discovered in the repository.

---

## Access patterns in this codebase

| Pattern | How config is read/written | Notes |
|---|---|---|
| A. Supabase client (PostgREST + RLS) | `supabase.from('<table>')` in frontend | Primary CRUD for most platform config |
| B. Nest database proxy | `POST /api/database/{query,insert,upsert,update,delete,rpc}` | Authenticated generic table access |
| C. Domain Nest controllers | `/api/<module>/...` | Workflows engines, ITAM, VIS, email, users ops, promotion |
| D. Form API (Edge + Nest host) | `/api/form-api/...` and Supabase `functions/v1/form-api` | Forms schema + **records** (transactional) |
| E. Public API (API key) | `/api/public-api/...` and `functions/v1/public-api` | External CRUD for forms/workflows/reports/users |

Do **not** invent endpoints. Only endpoints below were found in source.

---

## Frontend routes (UI only)

| Area | Frontend URL(s) |
|---|---|
| Projects | `/projects`, `/projects/:projectId/overview`, `/projects/:projectId/access` |
| Forms | `/forms`, `/form-builder`, `/form-builder/:id`, `/form-edit/:id`, `/form/:id`, `/form/:id/submit`, `/form/:id/preview`, `/form/:id/access`, `/form-submissions`, `/public/form/:id` |
| Workflows | `/workflows`, `/workflow-designer/:id`, `/workflow-view/:id`, `/workflow/:id/access` |
| Reports / Dashboards | `/reports`, `/report-editor/:id`, `/report-view/:id`, `/report/:id/access`, `/dashboard-view/:id` |
| Users / Roles | `/users`, `/roles-and-access`, `/investigate-access` |
| Integrations | `/integrations`, `/api-integration`, `/api-docs`, `/data-feeds` |
| VIS | `/vis`, `/vis/new`, `/vis/integrations`, `/vis/integrations/:id`, `/vis/connections`, `/vis/executions`, `/vis/enterprise` |
| ITAM | `/it-assets` |
| Notifications / email | `/email-config`, `/email-config/:projectId`, `/email-templates`, `/email-templates/:templateId` |
| Audit | `/audit-logs`, `/form-audit-logs` |
| Org / settings | `/organizations`, `/settings`, `/ldap-settings`, `/manage-sessions`, `/profile` |
| Knowledge / compliance | `/knowledge-base`, `/policies/*`, `/compliance`, `/audit-programs`, `/evidence-locker` |
| SLA | `/sla-management` |
| AI builder | `/build` |

---

## Backend / data APIs by component

### Projects

| Capability | API | Exists? |
|---|---|---|
| List/detail/create/update/delete | Supabase `projects` (+ `project_users`); optional `/api/database/*` | Yes |
| Dedicated Nest REST `/api/projects` | — | **No** |
| Public API | — | **No** |
| Search/filter | Client-side / PostgREST filters | Yes |
| RBAC / tenant | RLS + org membership | Yes |
| Audit | App audit logs (partial) | Partial |

### Forms

| Capability | API | Exists? |
|---|---|---|
| UI CRUD | Supabase `forms` | Yes |
| Form API list/get/fields/schema | `GET /api/form-api/forms`, `/forms/:id`, `/forms/:id/fields`, `/forms/:id/schema` | Yes |
| Form API records (transactional) | `GET/POST/PUT/PATCH/DELETE /api/form-api/forms/:id/records...` | Yes |
| Public API forms CRUD | `/api/public-api/forms` GET/POST/PUT/DELETE | Yes |
| Resolve by `reference_id` | Form API `resolveFormId` | Yes |
| Nest dedicated forms controller | — | **No** (hosted engine) |

### Form fields

| Capability | API | Exists? |
|---|---|---|
| CRUD | Supabase `form_fields`; also embedded in `forms.pages` JSON | Yes |
| Form API fields list | `GET .../forms/:id/fields` | Yes |
| Public API fields | `GET .../forms/:id/fields` | Yes |

### Users

| Capability | API | Exists? |
|---|---|---|
| Profiles / invitations | Supabase `user_profiles` + auth | Yes |
| Nest ops | `POST /api/users/delete`, `admin-change-password`, `send-password-reset` | Yes |
| Public API | `GET /api/public-api/users`, `/users/:id`, `/me` | Yes |
| Promotion | — | **NOT_APPLICABLE** (do not auto-promote users) |

### Groups / Roles / Permissions

| Capability | API | Exists? |
|---|---|---|
| CRUD | Supabase `groups`, `roles`, `role_permissions`, `group_roles`, `user_role_assignments` | Yes |
| Dedicated Nest REST | — | **No** |
| Permission binds | `role_permissions.resource_id` UUID | Yes — **promotion blocker** |

### Workflows

| Capability | API | Exists? |
|---|---|---|
| Definition CRUD | Supabase `workflows` | Yes |
| Public API CRUD + trigger | `/api/public-api/workflows` GET/POST/PUT/DELETE; `POST .../trigger` | Yes |
| Nest execution engines | `POST /api/workflows/enqueue`, `execute`, `process-queue`, `resume-waiting`, `notify-failure` | Yes |
| Execution history | Queue/DB tables | Transactional |

### Notifications

| Capability | API | Exists? |
|---|---|---|
| User inbox `notifications` | Supabase table | Transactional |
| Email templates | Supabase `email_templates` + UI | Config |
| Nest email send | `POST /api/email/test-smtp-connection`, `send-template`, `send-delegation`, `send-kb-notification` | Yes |

### Integrations / mappings / transformations

| Capability | API | Exists? |
|---|---|---|
| Outbound connectors | Supabase `outbound_connectors` (includes `credentials` JSONB) | Yes |
| Data feeds | Supabase + `POST /api/data-feeds/execute`, `discover-fields`, `run-scheduled` | Yes |
| VIS | `/api/vis/*`, `/api/vis/enterprise/*`, `/api/vis/mocks/*`, `/api/vis/env/*` | Yes |
| VIS promote (integration env label) | `POST /api/vis/enterprise/integrations/:id/promote` | Yes (VIS store only; not platform QA/PROD) |
| ITAM sync mappings | `/api/itam/sync/*` | Yes |

### Reports / Dashboards

| Capability | API | Exists? |
|---|---|---|
| Reports CRUD | Supabase `reports`; Public API `/api/public-api/reports` | Yes |
| Dashboards CRUD | Supabase `dashboards` | Yes |
| Dedicated Nest reports controller | — | **No** |

### Reference / business rules / schedules

| Capability | API | Exists? |
|---|---|---|
| Choice options | Often embedded in `form_fields.options` / pages JSON | Partial |
| Form/field rules | `forms.form_rules`, `forms.field_rules` JSON | Via forms CRUD |
| Schedules | `outbound_connectors.schedule_cron`, data-feed schedules, Nest `@nestjs/schedule` cron engines | Partial |

### ITAM configuration vs transactional

| Capability | API | Exists? |
|---|---|---|
| Discovery scopes/jobs/assets | `/api/itam/network-scopes`, `/discovery/*`, `/discovered-assets` | Yes |
| Cloud / VMware / topology | `/api/itam/cloud/*`, `/vmware/*`, `/topology/*`, `/network-intelligence/*` | Yes |
| Form sync targets/mappings/runs | `/api/itam/sync/*` | Yes |
| Agent report | `POST /api/itam/agent-report` | Yes |

Assets/jobs/history = transactional. Targets/mappings/scopes/providers = configuration (env-specific credentials).

### Attachments / audit

| Capability | API | Exists? |
|---|---|---|
| Storage | Supabase storage buckets (frontend) | Partial |
| Audit logs | Supabase `audit_logs` + UI `/audit-logs` | Yes (history = transactional) |

### Promotion foundation (this phase)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/promotion/status` | DEV-only status; states QA/PROD not provisioned |
| GET | `/api/promotion/namespaces` | List isolated `promotion-test-*` namespaces |
| POST | `/api/promotion/namespaces` | Create isolated namespace |
| POST | `/api/promotion/export` | Build versioned package from declarative input |
| POST | `/api/promotion/validate` | Validate package + secret scan |
| POST | `/api/promotion/dry-run` | Plan CREATE/UPDATE/… without writes |
| POST | `/api/promotion/import` | Dry-run (default) or apply into isolated namespace |
| POST | `/api/promotion/round-trip` | Export→validate→import→verify helper |
| POST | `/api/promotion/verify` | Compare package vs namespace |
| GET | `/api/promotion/audits` | In-memory promotion audit records |

Auth: Supabase JWT (global `SupabaseAuthGuard`).

### Generic / infra

| Path | Purpose |
|---|---|
| `GET /api/health` | Health |
| `POST /api/database/*` | Authenticated generic Supabase proxy |
| `/api/auth/*`, `/api/mfa/*`, `/api/sessions/*`, `/api/ldap/*` | Auth/session/LDAP |
| `/api/ai/*` | AI builder engines |
| `/api/blog/*` | Blog CMS |
| `/api/policies/*`, `/api/sla/*`, `/api/performance/*` | Domain modules |

---

## CRUD coverage cheat sheet

| Component | Create | Read | Update | Delete/Archive | Bulk | Notes |
|---|---|---|---|---|---|---|
| Projects | ✓ PostgREST | ✓ | ✓ | ✓ | — | No dedicated Nest resource API |
| Forms | ✓ PostgREST + Public API | ✓ Form/Public API | ✓ | ✓ | — | Duplicate via UI `duplicateForm` |
| Form fields | ✓ | ✓ | ✓ | ✓ | — | Also nested in pages JSON |
| Workflows | ✓ | ✓ | ✓ | ✓ | — | Execution separate |
| Reports | ✓ | ✓ | ✓ | ✓ | — | Public API present |
| Dashboards | ✓ | ✓ | ✓ | ✓ | — | PostgREST only |
| Roles/Groups | ✓ | ✓ | ✓ | ✓ | — | PostgREST only |
| Users | ✓ auth/invite | ✓ | ✓ | ✓ Nest delete | — | Not promotable |
| ITAM sync config | ✓ Nest | ✓ | ✓ mappings approve | Partial | Preview/execute | credentialReferenceId required |
| Promotion packages | ✓ export | ✓ validate | ✓ import apply | Namespace clear | Dry-run | Isolated DEV only |

---

## Validation / RBAC / tenant / audit (cross-cutting)

| Concern | Mechanism |
|---|---|
| Validation | Zod/class-validator on Nest DTOs; form field validation JSON; Form API `validate` |
| RBAC | `roles` / `role_permissions` / project membership / VIS platform roles |
| Tenant isolation | `organization_id` + Supabase RLS helpers (`get_current_user_org_id`, etc.) |
| Audit | `audit_logs`, form audit UI, ITAM sync provenance, VIS change history, promotion `PromotionAuditRecord` |

---

## Gaps relevant to promotion

1. Most config APIs are PostgREST — export must read tables (or Public/Form API), not a single deployment API.
2. Permissions and many JSON configs store **UUIDs**, not logical keys.
3. Outbound connector secrets live in DB JSON — export must scrub (foundation does).
4. No production multi-env deploy API — only DEV promotion foundation + VIS in-store “promote”.
