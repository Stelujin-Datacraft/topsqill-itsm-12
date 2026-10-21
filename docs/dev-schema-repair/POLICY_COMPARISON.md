# Repair 02 — RLS policy comparison (Dev deny-all → intended set)

**Migration:** `supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql`  
**Scope tables:** `forms`, `form_fields`, `form_submissions`, `form_audit_logs`  
**Do not apply to Production.**

## How drop-all interacts with Dev deny-all

Dev currently has **deny-all** policies for `authenticated` on these tables. Repair 02:

1. `ENABLE ROW LEVEL SECURITY` (idempotent)
2. **Drops every existing policy** on the four tables (including deny-all)
3. Recreates the **22** intended scoped policies in the **same transaction**

Deny-all cannot block the replacement set: drop and recreate are atomic. Mid-failure rolls back to the prior policy set.

## Intended policy set (22) — sources in repo

| # | Table | Policy name | Cmd | Authoritative source |
|---|-------|-------------|-----|----------------------|
| 1 | forms | `forms_select` | SELECT | `20260520071315` |
| 2 | forms | `forms_insert` | INSERT | `20260218044247` |
| 3 | forms | `forms_update` | UPDATE | `20260218044247` |
| 4 | forms | `forms_delete` | DELETE | `20260218044247` |
| 5 | forms | `Project admins can update forms` | UPDATE | `20260725120000` |
| 6 | forms | `Project admins can delete forms` | DELETE | `20260725120000` |
| 7 | form_fields | `form_fields_select` | SELECT | `20260218042224` |
| 8 | form_fields | `form_fields_insert` | INSERT | `20260218042224` |
| 9 | form_fields | `form_fields_update` | UPDATE | `20260218042224` |
| 10 | form_fields | `form_fields_delete` | DELETE | `20260218042224` |
| 11 | form_submissions | `Scoped view policy for form submissions` | SELECT | `20260610021212` |
| 12 | form_submissions | `Delegates can view delegator submissions` | SELECT | `20260604115652` |
| 13 | form_submissions | `Allow form submissions with user tracking` | INSERT | `20251107063639` |
| 14 | form_submissions | `Delegates can insert delegator submissions` | INSERT | `20260604113932` |
| 15 | form_submissions | `Allow updates for authorized users` | UPDATE | `20251231065328` |
| 16 | form_submissions | `Delegates can update delegator submissions` | UPDATE | `20260604115652` |
| 17 | form_submissions | `Comprehensive delete policy for submissions` | DELETE | `20251107063639` |
| 18 | form_submissions | `Form editors can delete submissions` | DELETE | `20260725120000` |
| 19 | form_audit_logs | `Admins can view all form audit logs` | SELECT | `20260117071733` |
| 20 | form_audit_logs | `Users can view their own form audit logs` | SELECT | `20260117071733` |
| 21 | form_audit_logs | `Users can insert their own form audit logs` | INSERT | `20260117071733` |
| 22 | form_audit_logs | `Admins can delete form audit logs` | DELETE | `20260121081237` |

**No `USING (true)` / `WITH CHECK (true)`.** RLS stays enabled.

## Dev deny-all — intentionally discarded

| What is dropped | Replacement |
|-----------------|-------------|
| Dev deny-all / broken authenticated policies on the four tables | The 22 scoped policies above |

These are **not** Production policies; they are the broken Dev state being repaired. Discarding them without 1:1 rename is **intentional**.

## Intentional differences vs Production / last-writer history

| Difference | Reason |
|------------|--------|
| Drop-all then recreate (vs incremental DROP POLICY IF EXISTS by name) | Dev policy names may not match Prod; deny-all must be cleared completely |
| `form_audit_logs` FK is SET NULL in repair **04** while Prod capture / `20260212` may use CASCADE | **Retention:** keep audit rows with `form_name`; documented in migration 04 — **not** an RLS policy difference |
| Some policies omit `TO authenticated` (apply to PUBLIC) | Matches historical FINAL sources in repo |
| Repair does not invent Prod-only dashboard policies outside these four tables | Out of Forms P0 scope |

## Operator capture checklist (before / after Dev apply)

Run on **Prod** and **Dev** (read-only) via `capture_prod_readonly.sql` section 3:

1. List all policy names on the four tables.
2. Confirm Prod has functional scoped policies (not deny-all).
3. Confirm Dev **before** apply: deny-all / missing helpers.
4. Confirm Dev **after** apply: exactly the 22 names above (or a documented superset if Prod had extras that were also recreated).
5. If Prod has **extra** policies on these four tables not listed above, paste them into the PR before claiming Prod parity — do not silently drop Prod extras when copying this package elsewhere.

## Safety guarantees in repair 02

- Single `BEGIN`/`COMMIT`
- No `DISABLE ROW LEVEL SECURITY`
- No permissive `USING (true)`
- Depends on repair **01** helpers (`can_access_forms_row`, `can_modify_form`, `can_act_for*`, …)
