# Platform Component Dependencies

**CURRENT ENVIRONMENT: DEV ONLY**  
**FUTURE:** DEV → QA → PROD (QA/PROD not implemented)

Dependencies below are derived from schema FKs, JSON references, and runtime code — not aspirational.

---

## High-level graph

```
Organization
  ├── Project
  │     ├── Form
  │     │     ├── Form Field
  │     │     ├── Form rules / field rules (JSON)
  │     │     ├── Reference / choice options (often embedded)
  │     │     └── Form submissions / records  [TRANSACTIONAL — do not promote]
  │     ├── Workflow ──► Form(s), Role(s), Notification template(s), Integration(s)
  │     ├── Report ──► Form / Field (often by UUID today)
  │     ├── Dashboard ──► Report(s)
  │     ├── Data Feed ──► Form + Data source connection [ENV/SECRETS]
  │     ├── Outbound connector / Integration [ENV/SECRETS]
  │     ├── Email templates (project-scoped)
  │     └── ITAM sync target/mapping ──► Form (external or local) [ENV credentials]
  ├── Role ──► role_permissions.resource_id → Project|Form|Workflow|Report (UUID)
  ├── Group ──► Role (optional) ; membership → Users [ENV-SPECIFIC]
  └── Users / assignments  [NOT auto-promoted]
```

---

## Dependency table

| Component | Depends on | Dependency type | Required? | Resolution strategy |
|---|---|---|---|---|
| Organization | — | root | — | `logical_key` (new); create-or-map per env |
| Project | Organization | FK `organization_id` | Required | Resolve org logical key → local org UUID |
| Form | Project | FK `project_id` | Required | Project logical key; form `logical_key`/`reference_id` |
| Form Field | Form | FK `form_id` | Required | Form key + field `logical_key` |
| Form rules | Form, Field | JSON refs (often UUID) | Optional | Rewrite UUIDs→keys on export; resolve on import |
| Workflow | Project, Form(s), Role(s), Notification template(s), Integration(s) | FK + node JSON | Forms often required | Export node refs as logical keys; fail dry-run on unresolved |
| Role | Organization | FK | Required | `logical_key` (e.g. `grc.manager`) |
| Permission | Role, Resource (project/form/workflow/report) | `role_permissions.resource_id` UUID | Required when scoped | **BLOCKED** until `resource_key` logical refs |
| Group | Organization, Role | FK | Role optional | Promote definition; **not** membership |
| Group membership | Group, User | assignment | — | Environment-specific mapping by role |
| User | Organization | profile | — | **Do not promote**; map roles→local groups |
| Report | Project, Form, Field | FK/JSON | Form usually required | Replace `formId` UUID with form logical key |
| Dashboard | Project, Report | FK/JSON layout | Reports optional | Report logical keys in layout |
| Notification inbox | User | row | — | Transactional — exclude |
| Email / notification template | Project/Org | table | Optional | Promote template body; env-specific destinations |
| Integration / outbound connector | Project/Org | table | Optional | Promote connector type/mappings; bind `credential_reference_id` per env |
| Mapping (ITAM/VIS/feed) | Integration or Form schema | JSON | Required for sync | Promote mapping defs; re-resolve field keys |
| Transformation | Mapping | embedded | Optional | Promote by name/kind string |
| Reference data | Project/Form domain | options JSON / seed tables | Optional | Promote by item `key` |
| Business rules | Form/Field | JSON | Optional | Same as form rules |
| Schedule | Integration / Data feed / cron | cron string + env | Optional | Promote cron expression; endpoints remain env config |
| Data feed | Form, connection | FKs + mappings JSON | Required | Connection secrets env-specific |
| ITAM sync target | Org + credential ref + base URL | config | Required | Env configuration; never copy secrets |
| ITAM discovered asset | Discovery job | transactional | — | **Do not promote** |
| Attachment binary | Storage bucket | blob | — | Not promoted; config bucket names are env-specific |
| Audit log row | Actor/resource | transactional | — | **Do not promote**; promote only audit *config* when defined |
| VIS integration | VIS store + env label | separate subsystem | Optional | VIS `promote` strips credentials; not platform QA/PROD |
| Promotion package | Listed components | manifest | — | Validate + topological apply by dependsOn |

---

## Circular dependencies

| Cycle | Severity | Handling |
|---|---|---|
| Form A ↔ Form B cross-reference fields | Medium | Export both; import with two-phase (create stubs → link) |
| Workflow ↔ Form (trigger form vs action form) | Low | Forms first, then workflows |
| Dashboard ↔ Report default flags | Low | Reports first, then dashboards |
| Role permissions ↔ resources | Medium | Create resources, then permissions using logical keys |

No hard DB-level circular FKs found among core config tables; cycles appear in **JSON references**.

---

## Recommended import order (future QA/PROD)

1. Organization (map)
2. Project
3. Roles (definitions only)
4. Groups (definitions only)
5. Forms (stub)
6. Form fields
7. Form rules / business rules / reference options
8. Workflows
9. Notification templates
10. Integrations (sans secrets) + mappings/transforms
11. Reports
12. Dashboards
13. Schedules / data feeds (bind env connections)
14. ITAM config (scopes/targets/mappings)
15. Role permissions (after resources exist)
16. Environment binding: credentials, URLs, user/group assignments

---

## Classification quick map

| Classification | Examples |
|---|---|
| PLATFORM_CONFIGURATION | projects, forms, fields, roles, workflows, reports, dashboards, templates, ITAM mappings, policies (`reference_id`) |
| ENVIRONMENT_CONFIGURATION | DB/Redis/API URLs, SMTP, connector base URLs, bucket names, cron targets |
| TRANSACTIONAL_DATA | submissions (`submission_ref_id` is per-env record id), ITAM assets, workflow runs, notifications inbox, audit rows |
| REFERENCE_DATA | status/severity lists, `asset_categories`, compliance controls (`control_id_ref`), `itam_software_catalog` |
| SECRET | passwords, API keys, OAuth tokens, connector `credentials` JSON values |

### Tables that do **not** exist as first-class entities

| Concept | Actual storage |
|---|---|
| schedules | `data_feeds.schedule`, `outbound_connectors.schedule_cron`, ITAM job cron, `workflow_triggers.trigger_type='schedule'` |
| business_rules | `forms.form_rules` / `forms.field_rules` JSON |
| integrations (generic) | `outbound_connectors`, `data_source_connections`, LDAP, VIS integrations, API keys |
| reference_data | Embedded field options + categories/compliance/ITAM catalogs |

---

## Resolution strategy standard

For every cross-component pointer:

1. **Export:** rewrite environment UUIDs → logical keys (`rewriteUuidRefs`).
2. **Dry-run:** ensure dependency keys exist in package or target (`MISSING_DEPENDENCY` / `INVALID_REFERENCE`).
3. **Import:** map logical key → target UUID; write local FKs.
4. **Never** assume `DEV.id == QA.id`.
