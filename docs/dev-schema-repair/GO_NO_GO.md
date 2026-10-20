# PR #230 — Go / No-Go checklist (review)

**Date:** 2026-10-20  
**Branch:** `cursor/fix-dev-crud-create-delete-e654`  
**Related:** PR #229 (`cursor/dev-forms-rls-repair-e654`) preserved; not modified.  
**Verdict: CONDITIONAL GO for Dev apply** after explicit operator approval — package is complete in-repo. Still **NO-GO for Production**. Live smoke after apply remains required before claiming Dev fixed.

SQL has **not** been applied to Dev or Production from this agent environment.

---

## Checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Inspect full SQL of migrations 01–05 | **PASS** | Bodies reviewed; 05 matches operator Prod capture |
| 2 | Helper functions match authoritative FINAL migrations | **PASS** | See helper matrix below |
| 3 | Migration 01 tables/columns exist on Dev (esp. `record_delegations`, `grant_delegator_access`) | **PASS (preflight)** | Migration **raises** if missing; operator must confirm Dev has tables before apply |
| 4 | Migration 02 policy set vs Prod / deny-all safety | **PASS (documented)** | 22 policies; drop-all clears Dev deny-all in one txn; see `POLICY_COMPARISON.md`. Paste live Prod policy list into PR if extras exist |
| 5 | `form_submissions` FK Dev vs Prod | **PASS (capture + repair)** | Capture: Prod **CASCADE**, Dev **NO ACTION**. Migration 04 now rebinds submissions → **CASCADE** to match Prod; post-check enforces `confdeltype = c` |
| 6 | Migration 04 safe/repeatable; required FKs verified | **PASS** | Required: fields/submissions/audit; optional: access tables; audit SET NULL (intentional vs Prod CASCADE); transactional + post-checks |
| 7 | `get_organization_users` from Prod capture | **PASS (repo)** | Migration 05 exact body; grants PUBLIC/anon/authenticated/service_role/postgres; no `search_path` |
| 8 | Static tests + Nest build | **PASS** | `npm run test:database` + `npm run build` |
| 9 | Live Dev apply + smoke | **PENDING** | Not run from this agent — blocks “Dev is fixed” claim |

---

## Helper verification matrix

| Function | FINAL source | Body match | SECURITY DEFINER | search_path | GRANT in repair |
|----------|--------------|------------|------------------|-------------|-----------------|
| `can_view_project` | `20260804120000` | OK | OK | OK | Added (intentional) |
| `can_access_form` | `20260218042224` | OK | OK | OK | Added |
| `can_modify_form` | `20260218042224` | OK | OK | OK | Added |
| `can_modify_forms_row` | `20260218044247` | OK | OK | OK | Added |
| `user_has_form_role_permission` | `20260520071315` | OK | OK | OK | Added |
| `user_has_project_form_role_permissions` | `20260520071315` | OK | OK | OK | Added |
| `can_access_forms_row` | `20260520071315` | OK | OK | OK | Added |
| `can_act_for` | `20260604113932` | OK | OK | OK | Added |
| `can_act_for_submission` | `20260606041529` | OK | OK | OK | Added |
| `get_user_project_invitations` | `20250625074633` | OK | OK | **Added** (hardening) | Added |
| `get_organization_users` | **Prod capture** | OK | OK | **None** (matches Prod) | PUBLIC, anon, authenticated, service_role, postgres |

---

## FK matrix (repair 04)

| Child FK | Target ON DELETE | Notes |
|----------|------------------|-------|
| `form_fields_form_id_fkey` | CASCADE | Required |
| `form_user_access_form_id_fkey` | CASCADE | Optional table (NOTICE skip) |
| `form_access_requests_form_id_fkey` | CASCADE | Optional table (NOTICE skip) |
| `form_submissions_form_id_fkey` | CASCADE | **Required — match Production capture** |
| `form_audit_logs_form_id_fkey` | SET NULL | Intentional retention vs Prod CASCADE |

---

## Policy drop-all analysis

See `POLICY_COMPARISON.md`. Repair 02 drops all policies on the four tables then recreates **22** policies. Dev deny-all is intentionally discarded. Relative to the repo last-writer set: **zero legitimate policies lost**.

---

## Sequence integrity (01→05)

| Step | File | Depends on | Destructive? | Rerunnable? |
|------|------|------------|--------------|-------------|
| 01 | `…20000_dev_repair_01_form_access_helpers.sql` | Core tables + `record_delegations` | REPLACE functions; ADD COLUMN IF NOT EXISTS | Yes |
| 02 | `…20100_dev_repair_02_form_table_rls.sql` | 01 helpers | Drop-all policies on 4 tables then recreate | Yes (txn) |
| 03 | `…20200_dev_repair_03_invitations_rpc.sql` | `project_invitations` | REPLACE function | Yes |
| 04 | `…20300_dev_repair_04_form_fk_delete.sql` | forms + children | Drop/recreate FKs | Yes (txn + post-check) |
| 05 | `…20400_dev_repair_05_get_organization_users.sql` | `user_profiles.status` | REPLACE function + GRANT | Yes |

---

## Remaining before claiming Dev fixed

1. Explicit approval to apply **01–05 on Dev only** (surgical `psql -f`, not `supabase db push` to Prod).
2. Post-flight SQL in `VALIDATION.md` (helpers, grants, FK `confdeltype`, 22 policies, no `USING(true)`).
3. UI/API smoke including **delete form with submissions** (should succeed after CASCADE) and `get_organization_users`.
4. Optional: paste full Prod policy name list into PR if any extras beyond the 22.

---

## Recommendation

| Scope | Decision |
|-------|----------|
| Merge / keep PR as ready-to-apply package | OK after CI green |
| Apply 01–05 on **Dev** | **CONDITIONAL GO** — approve then apply surgically; smoke required |
| Apply anything on **Production** | **NO-GO** |
| Claim “Dev is fixed” before live apply + smoke | **NO-GO** |
