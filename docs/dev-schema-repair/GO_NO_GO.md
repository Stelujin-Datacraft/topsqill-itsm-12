# PR #229 — Go / No-Go checklist (review)

**Date:** 2026-10-19  
**Branch:** `cursor/dev-forms-rls-repair-e654`  
**Verdict: NO-GO for database apply** until blockers below are cleared.

SQL has **not** been applied to Dev or Production from this agent environment.

---

## Checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Inspect full SQL of migrations 01–04 | **PASS** | Bodies reviewed line-by-line |
| 2 | Helper functions match authoritative FINAL migrations | **PASS** | See helper matrix below |
| 3 | Migration 01 tables/columns exist on Dev (esp. `record_delegations`, `grant_delegator_access`) | **BLOCKED** | No Dev DB credentials in Cursor; preflight now **raises** if table missing |
| 4 | Migration 02 policy set vs intended Prod inventory; drop-all loss analysis | **PASS (repo)** | 22/22 intended policies recreated; no legitimate repo survivors lost. Live Prod policy dump still not verified |
| 5 | `form_submissions` FK `confdeltype` on Dev **and** Prod (read-only) | **BLOCKED** | No DB access; migration 04 correctly leaves submissions untouched |
| 6 | Migration 04 safe/repeatable; audit + submissions preserved | **PASS (with caveats)** | Audit → SET NULL; submissions unchanged; nullability guard + transaction added |
| 7 | Capture `get_organization_users` from Prod; prepare Dev migration | **BLOCKED** | No Prod access; cannot invent body; capture script ready |
| 8 | Tests for authz / create / field / submit / audit / invitations / delete | **PARTIAL** | Static repair regression tests added; live RLS integration tests still require Dev |

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

---

## Policy drop-all analysis (repo)

Repair 02 drops all policies on the four tables then recreates **22** policies. Relative to the repo last-writer set: **zero legitimate policies lost**.

Live Production may still have extra dashboard-only policies not in git — run `docs/dev-schema-repair/capture_prod_readonly.sql` before apply.

---

## Corrections applied on this branch (post-review)

1. **01** — Preflight `RAISE EXCEPTION` if required tables missing (including `record_delegations`); always `ADD COLUMN grant_delegator_access` when table exists; wrapped in `BEGIN/COMMIT`.
2. **02 / 03 / 04** — Wrapped in transactions so mid-failure cannot leave deny-all / half-rebound FKs.
3. **04** — Refuse `SET NULL` if `form_audit_logs.form_id` is `NOT NULL`; always drop temp helper on error.
4. Static test: `backend/test/database/dev-forms-rls-repair.test.ts`.
5. Operator scripts: `capture_prod_readonly.sql`, updated PENDING + VALIDATION.

---

## Blockers before GO

1. **Provide Dev read-only connection** (or paste results of preflight + FK queries in `VALIDATION.md`).
2. **Provide Prod read-only** results for:
   - `form_submissions` → `forms` FK `confdeltype`
   - Full policy inventory on the four tables
   - `pg_get_functiondef` for `get_organization_users`
3. **Author `get_organization_users` migration** from that Prod dump (separate file / follow-up commit).
4. After Dev apply approval: run smoke in `VALIDATION.md` (authorized + unauthorized users).

---

## Recommendation

| Scope | Decision |
|-------|----------|
| Merge PR as **review artifact / ready-to-apply package** | Conditionally OK after CI static tests pass |
| Apply 01–04 on **Dev** | **NO-GO** until blockers 1–2 cleared and explicit approval |
| Apply anything on **Production** | **NO-GO** |
| Claim Dev↔Prod parity | **NO-GO** |
