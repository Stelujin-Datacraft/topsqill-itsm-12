# Production VIS + ITAM schema repair — audit report (review only)

**Status:** Manual review package. No Production SQL has been executed by this workstream.  
**Branch package:** `docs/prod-schema-repair/`  
**Repo tip basis:** `main` (includes merged PR #226 migrations)  
**Production schema snapshot in repo:** **Not available** — every “Prod verified?” cell below is **UNVERIFIED** until `01_preflight_read_only.sql` is run in the Production Supabase SQL Editor.

## A. Required objects inventory

### A1. VIS (Nest `SupabaseVisStore` / secret provider)

| Object | Kind | Defining migration | Dependencies | Required by Nest? | Prod verified? |
|---|---|---|---|---|---|
| `public.vis_documents` | table | `20261010090000_vis_supabase_persistence.sql` | none (shared public schema) | **Yes** | UNVERIFIED |
| `vis_documents.logical_id` | column NOT NULL | `20261012062100_vis_documents_logical_id.sql` | `vis_documents` | **Yes** (upsert on `collection,logical_id`) | UNVERIFIED |
| `vis_documents_collection_idx` | index | `20261010090000_…` | `vis_documents` | useful | UNVERIFIED |
| `vis_documents_collection_created_idx` | index | `20261010090000_…` | `vis_documents` | useful | UNVERIFIED |
| `vis_documents_collection_logical_id_uidx` | unique index | `20261012062100_…` | `logical_id` backfill | **Yes** | UNVERIFIED |
| `vis_documents_logical_id_idx` | index | `20261012062100_…` | `logical_id` | useful | UNVERIFIED |
| `vis_documents_logical_id_conflicts` | view | `20261012062100_…` | `vis_documents` | ops/debug | UNVERIFIED |
| `public.vis_secret_blobs` | table | `20261010090000_…` | none | **Yes** | UNVERIFIED |
| `vis_secret_blobs.ref_id` UNIQUE | constraint | `20261010090000_…` | table | **Yes** (`onConflict: ref_id`) | UNVERIFIED |
| REVOKE anon/authenticated; GRANT service_role | privileges | `20261017130500_vis_revoke_client_table_grants.sql` | tables exist | **Yes** (security) | UNVERIFIED |
| `vis_user_refs`, `vis_credential_references`, `vis_connections`, `vis_integrations`, `vis_integration_versions` | tables | `20261010090000_…` | internal FKs among typed tables | **No** (unused by current store; included for migration fidelity) | UNVERIFIED |

**Not required / not invented:** separate VIS Prisma database, Prisma migration SQL under `backend/src/vis/prisma/`.

### A2. ITAM Phase A (Nest `REQUIRED_DISCOVERY_RELATIONS`)

| Object | Kind | Defining migration | Dependencies | Required by Nest? | Prod verified? |
|---|---|---|---|---|---|
| `get_current_user_org_id()`, `is_org_admin_of(uuid)`, `is_current_org_admin()` | functions | `20260930110000_get_current_user_org_id.sql` (also older defs exist) | `user_profiles`, preferably `user_organizations`, `auth.uid()` | RLS policies | UNVERIFIED |
| Enums: `discovery_job_status`, `discovery_mode`, `network_scope_auth_status`, `discovered_asset_status`, `discovery_confidence`, `inventory_source` | types | `20260930120000_itam_network_discovery.sql` | none | **Yes** (column types) | UNVERIFIED |
| `it_assets` discovery columns + indexes | alter/index | `20260930120000_…` | **`it_assets` must already exist** | soft (extend SoR) | UNVERIFIED |
| `asset_software` inventory columns + `idx_asset_software_name_ver` | alter/index | `20260930120000_…` | **`asset_software` must already exist** | soft | UNVERIFIED |
| `uq_asset_software_asset_name_ver` | unique index | `20261017140000_itam_unique_indexes_preflight.sql` (NULL-safe preflight) | `asset_software` | **Yes** (Nest `ON CONFLICT`) | UNVERIFIED |
| `itam_network_scopes` | table + idx | `20260930120000_…` | **`organizations`** | **Yes** | UNVERIFIED |
| `uq_itam_network_scopes_org_cidr_kind` | unique index | `20261017140000_…` | scopes table | **Yes** | UNVERIFIED |
| `itam_discovery_jobs` | table + idx | `20260930120000_…` | `organizations` | **Yes** | UNVERIFIED |
| `itam_discovery_runs` | table | `20260930120000_…` | jobs, `organizations` | **Yes** | UNVERIFIED |
| `itam_discovered_hosts` | table + idx | `20260930120000_…` | orgs, jobs, runs, **`it_assets`** | **Yes** | UNVERIFIED |
| `itam_asset_identities` | table + idx | `20260930120000_…` | orgs, `it_assets` | **Yes** | UNVERIFIED |
| `itam_software_catalog` | table | `20260930120000_…` | orgs (nullable org) | **Yes** | UNVERIFIED |
| `itam_software_aliases` | table | `20260930120000_…` | catalog | **Yes** | UNVERIFIED |
| `itam_discovery_diffs` | table | `20260930120000_…` | orgs, runs, `it_assets` | **Yes** | UNVERIFIED |
| `itam_discovery_audit` | table + idx | `20260930120000_…` | orgs | **Yes** | UNVERIFIED |
| `itam_asset_services` | table | `20260930120000_…` | orgs, `it_assets` | **Yes** | UNVERIFIED |
| `itam_field_provenance` | table | `20260930120000_…` | orgs, `it_assets` | **Yes** | UNVERIFIED |
| Phase A RLS + grants | policies/grants | `20261017141000_itam_phase_a_rls_forward.sql` | helpers + tables | **Yes** (PostgREST safety; Nest `pg` Pool typically bypasses RLS) | UNVERIFIED |

### A3. Explicitly deferred (not in Nest discovery boot list)

| Area | Migrations | Why deferred |
|---|---|---|
| ITAM Phase B–D | `20260930130000_…`, `20261017142000_…` | Not in `REQUIRED_DISCOVERY_RELATIONS` |
| ITAM form sync | `20260930140000_…`, `20261017143000_…` | Not required for discovery SoR boot |

See `sql/OPTIONAL_itam_phases_b_d_and_form_sync.txt`.

## B. Proposed SQL scripts (manual review)

| File | Role |
|---|---|
| `sql/01_preflight_read_only.sql` | **C** — inventory / conflicts before changes |
| `sql/02_vis_apply.sql` | **B** — VIS apply (verbatim sources: `100900` → `120621` → `171305`) |
| `sql/03_itam_phase_a_apply.sql` | **B** — ITAM Phase A (`110000` → `120000` DDL w/ uniques deferred → `171400` → `171410`) |
| `sql/04_postcheck_verification.sql` | **D** — readiness verification |

Authoritative source filenames are embedded as `SOURCE:` banners inside each apply script.

## C. Preflight (must run first in Prod SQL Editor)

`01_preflight_read_only.sql` checks:

- `supabase_migrations.schema_migrations` rows for VIS/ITAM versions vs table presence (**history≠reality** detector)
- Dependency tables: `organizations`, `user_profiles`, `user_organizations`, `it_assets`, `asset_software`
- VIS / ITAM relation presence, `logical_id` column, enums, helpers, indexes
- True `asset_software` duplicates (`version IS NOT NULL` only) and scopes duplicates
- VIS grants and ITAM RLS/policies

## D. Post-application verification

`04_postcheck_verification.sql` confirms Nest-critical objects, VIS privilege lockdown, Phase A tables, unique indexes, helpers, RLS enablement, and append-only audit policy shape.

## E. Risks / do-not-create-until-inspected

1. **No Production schema snapshot in repo** — do not apply `02`/`03` until preflight results are pasted into the approval thread.
2. **Migration history conflict** — if `20260930120000` / `20261010090000` are recorded but objects are missing, **do not** auto-repair history; apply surgical SQL from this package, then decide history updates manually after postcheck.
3. **Missing dependencies** — if `organizations`, `it_assets`, or `asset_software` are missing, ITAM Phase A FKs cannot be created safely.
4. **`asset_software` / scopes duplicates** — `171400` will `RAISE` and stop; resolve manually (no auto-delete in script).
5. **`vis_documents` logical_id** — if non-empty unexpected rows exist in Prod, backfill/disambiguation **updates** `logical_id` / `payload.id` for non-keepers (no deletes). Inspect row counts before apply.
6. **`CREATE OR REPLACE` helpers** — replaces `get_current_user_org_id` / `is_org_admin_of` bodies (adds `search_path` / NULL guard). Confirm no custom Prod overrides rely on older definitions.
7. **Enum `CREATE TYPE`** — safe on duplicate; unsafe to assume identical enum labels if a divergent type already exists under the same name.
8. **Idempotency** — many statements use `IF NOT EXISTS` / `DROP POLICY IF EXISTS`, but **not every statement is proven idempotent** (e.g. `ALTER COLUMN … SET NOT NULL`, privilege revoke/grant sequencing). Re-runs need review of intermediate failures.
9. **Phase B–D / form-sync omitted** — creating them without product need expands attack surface; keep deferred.
10. **Nest `ITAM_DISCOVERY_APPLY_SCHEMA`** must remain `0` on Production boots — Nest must not DDL-migrate Prod.
11. **No Dev→Prod data copy** in this package.
12. **Do not** `DROP TABLE`, disable RLS, or bulk `db push`.

## Intended migration order (repository)

```
20260930110000_get_current_user_org_id.sql
20260930120000_itam_network_discovery.sql      # Phase A DDL (+ RLS in file; Prod repair uses forward RLS)
20260930130000_itam_phases_b_d.sql             # deferred for this repair
20260930140000_itam_form_sync.sql             # deferred
20261010090000_vis_supabase_persistence.sql
20261012062100_vis_documents_logical_id.sql
20261017130500_vis_revoke_client_table_grants.sql
20261017140000_itam_unique_indexes_preflight.sql
20261017141000_itam_phase_a_rls_forward.sql
20261017142000_itam_phases_b_d_rls_forward.sql  # deferred
20261017143000_itam_form_sync_rls_forward.sql   # deferred
```

**Important:** A version recorded in `schema_migrations` does **not** prove objects exist.

## Checks that must pass before approving Production schema changes

1. Preflight **B**: `organizations`, `it_assets`, `asset_software`, `user_profiles` = PRESENT.  
2. Preflight **N**: document any history-vs-reality mismatches; agree surgical apply (no auto repair).  
3. Preflight **I/J**: zero true unique collisions (or written remediation plan).  
4. Preflight **C/E**: confirm which VIS/ITAM objects are actually MISSING (scope the apply).  
5. Confirm Nest Prod env: `ITAM_DISCOVERY_APPLY_SCHEMA=0`; VIS uses service_role against this Supabase project.  
6. Human sign-off on `02_vis_apply.sql` and `03_itam_phase_a_apply.sql` contents (SOURCE banners match repo).  
7. After apply: `04_postcheck` shows all Nest-required objects PRESENT; VIS anon/authenticated grants empty; Phase A RLS enabled; unique indexes present.  
8. Application smoke (separate from this SQL package): Nest VIS store probe + ITAM discovery schema guard without memory fallback.

## Safety checklist (package guarantees)

- [x] No `DROP TABLE` / `TRUNCATE` / Dev data copy  
- [x] No RLS disable  
- [x] No automatic `schema_migrations` repair  
- [x] VIS and ITAM separated (`02` vs `03`)  
- [x] Definitions sourced from authoritative migrations (not invented replacements)  
- [x] Unique-index preflight uses NULL-safe `asset_software` semantics  
- [ ] Idempotency of full apply **not** claimed as verified end-to-end on Production
