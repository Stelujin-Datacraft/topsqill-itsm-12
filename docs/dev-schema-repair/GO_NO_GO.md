# PR #230 — Go / No-Go checklist (review)

**Date:** 2026-10-20  
**Branch:** `cursor/fix-dev-crud-create-delete-e654`  
**Related:** PR #229 (`cursor/dev-forms-rls-repair-e654`) preserved; not modified.  
**Verdict: NO-GO for database apply** until live Dev/Prod capture blockers below are cleared.

SQL has **not** been applied to Dev or Production from this agent environment.

---

## Checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Inspect full SQL of migrations 01–05 | **PASS** | Bodies reviewed; 05 matches operator Prod capture |
| 2 | Helper functions match authoritative FINAL migrations | **PASS** | See helper matrix below |
| 3 | Migration 01 tables/columns exist on Dev (esp. `record_delegations`, `grant_delegator_access`) | **BLOCKED** | No Dev DB credentials in Cursor; preflight now **raises** if table missing |
| 4 | Migration 02 policy set vs intended Prod inventory; drop-all loss analysis | **PASS (repo)** | 22/22 intended policies recreated; no legitimate repo survivors lost. Live Prod policy dump still not verified |
| 5 | `form_submissions` FK `confdeltype` on Dev **and** Prod (read-only) | **BLOCKED** | No DB access; migration 04 correctly leaves submissions untouched |
| 6 | Migration 04 safe/repeatable; audit + submissions preserved | **PASS (with caveats)** | Audit → SET NULL; submissions unchanged; nullability guard + transaction added |
| 7 | Capture `get_organization_users` from Prod; author Dev migration 05 | **PASS (repo)** | Migration `20261019120400_dev_repair_05_…` uses exact Prod body; grants PUBLIC/anon/authenticated/service_role/postgres; **no** `SET search_path` (matches capture). Live Dev apply still blocked |
| 8 | Tests for authz / create / field / submit / audit / invitations / delete / org users | **PARTIAL** | Static repair regression tests cover 01–05; live RLS integration tests still require Dev |

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
| `get_organization_users` | **Prod capture** | OK | OK | **None** (matches Prod; do not add without approval) | PUBLIC, anon, authenticated, service_role, postgres |

---

## Policy drop-all analysis (repo)

Repair 02 drops all policies on the four tables then recreates **22** policies. Relative to the repo last-writer set: **zero legitimate policies lost**.

Live Production may still have extra dashboard-only policies not in git — run `docs/dev-schema-repair/capture_prod_readonly.sql` before apply.

---

## Corrections applied on this branch (post-review)

1. **01** — Preflight `RAISE EXCEPTION` if required tables missing (including `record_delegations`); always `ADD COLUMN grant_delegator_access` when table exists; wrapped in `BEGIN/COMMIT`.
2. **02 / 03 / 04 / 05** — Wrapped in transactions so mid-failure cannot leave deny-all / half-rebound FKs / half-created RPCs.
3. **04** — Refuse `SET NULL` if `form_audit_logs.form_id` is `NOT NULL`; always drop temp helper on error.
4. **05** — Prod-captured `get_organization_users`; preserves Prod grants; omits `search_path` to avoid silent behavior change.
5. Static test: `backend/test/database/dev-forms-rls-repair.test.ts` (covers 01–05).
6. Operator scripts: `capture_prod_readonly.sql`, updated PENDING + VALIDATION.

---

## Blockers before GO

1. **Provide Dev read-only connection** (or paste results of preflight + FK queries in `VALIDATION.md`).
2. **Provide Prod read-only** results for:
   - `form_submissions` → `forms` FK `confdeltype`
   - Full policy inventory on the four tables
   - Confirm Dev post-apply `get_organization_users` def + grants match capture (see `VALIDATION.md`)
3. After Dev apply approval: run smoke in `VALIDATION.md` (authorized + unauthorized users), including org-users RPC.
4. Confirm `user_profiles.status` exists and uses `'active'` on Dev (05 preflight checks column presence only).

---

## Recommendation

| Scope | Decision |
|-------|----------|
| Merge PR as **review artifact / ready-to-apply package** | Conditionally OK after CI static tests pass |
| Apply 01–05 on **Dev** | **NO-GO** until blockers 1–2 cleared and explicit approval |
| Apply anything on **Production** | **NO-GO** |
| Claim Dev↔Prod parity | **NO-GO** (submissions FK + live policy dump still unverified) |
