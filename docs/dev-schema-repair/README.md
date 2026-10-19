# Dev schema repair — Forms RLS / helpers / FK (review package)

**Status:** Reviewed (see `GO_NO_GO.md`). **Verdict: NO-GO for DB apply** until live Dev/Prod capture blockers clear. **Do not apply to Production. Do not apply to Dev until explicitly approved.**

**Scope:** Restore verified missing functions and intended RLS for `forms`, `form_fields`, `form_submissions`, `form_audit_logs`; restore `get_user_project_invitations`; safe form-delete FK behavior.

## Confirmed Dev vs Prod (operator-verified)

| Check | Dev | Production |
|-------|-----|------------|
| Core form tables RLS | Enabled; **deny-all only** for `authenticated` | Functional scoped policies |
| Helpers (`can_modify_form`, `can_access_form`, `can_modify_forms_row`, `can_access_forms_row`, `user_has_form_role_permission`, `can_act_for`, `can_act_for_submission`, …) | **Missing** (query returned no rows) | Present; used by policies |
| `get_user_project_invitations()` | Missing | Present |
| `get_organization_users(uuid)` | Missing | Present |
| Form delete | Blocked by `form_fields_form_id_fkey` | Works (likely CASCADE or empty children) |
| `form_audit_logs` INSERT | RLS deny | Works with scoped insert |

## Inventory of missing functions (repo-verified)

| Function | Signature (final) | Authoritative migration | SECURITY DEFINER | search_path | In repair 01/03? |
|----------|-------------------|-------------------------|------------------|-------------|------------------|
| `can_view_project` | `(uuid, uuid) → bool` | `20260804120000_…` | yes | `public` | yes (dependency) |
| `can_access_form` | `(uuid, uuid) → bool` | `20260218042224_…` | yes | `public` | yes |
| `can_modify_form` | `(uuid, uuid) → bool` | `20260218042224_…` | yes | `public` | yes |
| `can_modify_forms_row` | `(uuid, text, uuid) → bool` | `20260218044247_…` | yes | `public` | yes |
| `user_has_form_role_permission` | `(uuid, uuid, text) → bool` | `20260520071315_…` | yes | `public` | yes |
| `user_has_project_form_role_permissions` | `(uuid, uuid) → bool` | `20260520071315_…` | yes | `public` | yes |
| `can_access_forms_row` | `(uuid, uuid, text, bool, uuid) → bool` | `20260520071315_…` | yes | `public` | yes |
| `can_act_for` | `(uuid, uuid, uuid) → bool` | `20260604113932_…` | yes | `public` | yes |
| `can_act_for_submission` | `(uuid, uuid) → bool` | `20260606041529_…` | yes | `public` | yes |
| `get_user_project_invitations` | `() → TABLE(…)` | `20250625074633-…` | yes | added in repair | yes (03) |
| **`get_organization_users`** | `(org_id uuid)` per types.ts | **NONE in repo** | unknown | unknown | **NO — blocked** |

### Dependencies of helpers

- `can_access_forms_row` → `user_has_project_form_role_permissions` → `user_role_assignments`, `role_permissions`, `forms`
- `can_access_form` / `can_modify_form` → `forms`, `user_profiles`, `project_users`
- `can_act_for` → `record_delegations` (+ `grant_delegator_access` column), `can_access_form`, `can_view_project`
- `can_act_for_submission` → `record_delegations`, `form_submissions`, `can_access_form`
- Policies also assume tables: `asset_permissions`, `form_user_access`, `project_users`, `user_profiles`

### Not inventable from this repo

- `get_organization_users(uuid)` — typed in `src/integrations/supabase/types.ts`; called by `useOrganizationUsers.ts` / `useCopilotEngine.ts`; **no CREATE FUNCTION in any migration**. Capture from Prod with `pg_get_functiondef` — see `PENDING_get_organization_users.md`.
- Other remote-only helpers previously flagged (`is_current_user_admin`, `get_current_user_organization_id`, `can_access_submission`, …) are **out of this Forms P0 package** but remain P0 for whole-app parity.

## Proposed migration files (dependency order)

Apply **only on Dev**, surgically (SQL Editor / `psql -f`), **not** bulk `supabase db push` on Lovable-drifted history:

1. `supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql`
2. `supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql`
3. `supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql`
4. `supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql`
5. *(later)* Prod-captured `get_organization_users` migration — not authored here

After success, optionally insert matching rows into `supabase_migrations.schema_migrations` **only for files actually applied**.

## Policy authorization rationale

| Table | Policy intent |
|-------|----------------|
| `forms` SELECT | Org admin / project admin / project member (unless form role ACL narrows) / creator / public / explicit form role `read` |
| `forms` INSERT | Same-org profile or project member |
| `forms` UPDATE/DELETE | Creator or org admin (`can_modify_forms_row`) **or** project admin |
| `form_fields` * | Access via `can_access_form` / write via `can_modify_form` |
| `form_submissions` | Submitter, creator, org admin, project member, asset ACL, form_user_access, public form; plus delegation policies |
| `form_audit_logs` INSERT | **`auth.uid() = user_id` only** — no cross-user insert; preserves least privilege |

Repair 02 **drops all existing policies** on the four tables then recreates this set, replacing Dev deny-all without `USING (true)`.

## Safe form-deletion strategy

| Child | Proposed ON DELETE | Rationale |
|-------|-------------------|-----------|
| `form_fields` | **CASCADE** | Required; UI always creates Status field; no historical business payload |
| `form_user_access` | **CASCADE** | ACL for deleted form |
| `form_access_requests` | **CASCADE** | Requests for deleted form |
| `form_audit_logs` | **SET NULL** | **Preserve audit history**; `form_name` retained (overrides earlier CASCADE migration intentionally for retention) |
| `form_submissions` | **Unchanged in this package** | Business records — confirm Prod `confdeltype` before any CASCADE; prefer explicit purge or soft-delete |
| Feeds / workflows / SLA / assignments | Already CASCADE/SET NULL in prior migrations | Leave alone |

**App note:** `cleanupChildFieldsForForm` remains unused; CASCADE makes field cleanup unnecessary for delete. Submission purge still requires a product decision.

## Risks

| Risk | Mitigation |
|------|------------|
| Dropping all policies briefly leaves tables with RLS and zero policies (= deny all) until recreate finishes | Run repair 02 in one transaction (file is a single script); apply in maintenance window |
| `record_delegations` missing on Dev | Repair 01 `ALTER … ADD COLUMN` fails if table missing — apply delegation migrations first or skip can_act_* until table exists |
| `get_organization_users` still missing after apply | Expected — capture from Prod before AI/org user UIs work |
| Prod accidentally targeted | Refuse; use Dev-only URI; never paste Prod service role into Dev apply session |
| Form delete cascades fields but submissions remain | Delete may still fail if `form_submissions_form_id_fkey` is NO ACTION — validate with `pg_constraint` after helpers/RLS, before claiming delete fixed |
| Audit INSERT still fails if JWT/`user_id` mismatch | Policy is correct; verify Nest forwards `Authorization`; optionally later force `user_id` from token in Nest |

## Whole-application remediation sequence (after Forms P0)

| Priority | Area | Action |
|----------|------|--------|
| P0 | Forms helpers + RLS + invitations + form_fields FK | This package |
| P0 | Capture Prod-only RPCs/helpers | `get_organization_users`, `is_current_user_admin`, `get_current_user_organization_id`, `*_cached`, `can_access_submission` |
| P1 | `form_submissions` FK ON DELETE | Diff Dev vs Prod; decide CASCADE vs purge workflow |
| P1 | ITAM | Surgical apply `20260930110000`→`140000` per `docs/ITAM_DEV_SCHEMA_APPLY.md` |
| P1 | VIS | `20261010090000`, `20261012062100` |
| P1 | Promotional transfer | `20261006120000` |
| P2 | Connectors / signup OTP / queue RPCs | `20260926103000`, `2026092812*`, `2026072412*` |
| P2 | Storage buckets (8) | Verify dashboard |
| P2 | Nest vs Edge path alignment | Confirm Dev deploy |
| P3 | Regenerate `types.ts` | After Dev schema catch-up |

## Validation

See `VALIDATION.md`.
