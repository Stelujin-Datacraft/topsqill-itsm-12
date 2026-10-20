# PR #230 — Go / No-Go checklist (review)

**Date:** 2026-10-20  
**Branch:** `cursor/fix-dev-crud-create-delete-e654`  
**Related:** PR #229 preserved; not modified by this agent turn.
**See also:** `FULL_DEV_AUDIT.md`

SQL has **not** been applied to Dev or Production from this agent environment.
**No commit / push / deploy** in the latest audit continuation.

---

## Verdict (migrations 06–07)

| Scope | Decision |
|-------|----------|
| Apply **06 + 07** on **Dev** after operator approval | **CONDITIONAL GO** — package reviewed; empty-table assumptions hold per operator inventory; smoke required; **restrictive `*_migration_deny` policies now dropped in 06** |
| Apply **01–05** on Dev (if not already applied) | **CONDITIONAL GO** — prior Forms package |
| Apply anything on **Production** | **NO-GO** |
| Claim app “fully fixed” without live smoke | **NO-GO** |

---

## Blocker resolved (repo): SLA `*_migration_deny` RESTRICTIVE policies

**Discovered (Dev SQL Editor, operator):** these RESTRICTIVE policies exist with `USING (false)` / `WITH CHECK (false)` for `authenticated`:

| Policy | Table |
|--------|-------|
| `business_holidays_migration_deny` | `business_holidays` |
| `form_field_sla_config_migration_deny` | `form_field_sla_config` |
| `sla_instances_migration_deny` | `sla_instances` |
| `escalation_events_migration_deny` | `escalation_events` |

**Why it blocked:** PostgreSQL RESTRICTIVE policies **AND** with permissive policies. Migration 06 previously only recreated scoped PERMISSIVE policies and never dropped these denies — authenticated access would remain denied after apply.

**Resolution (repo, not yet applied):** `20261020080000_dev_repair_06_sla_canonical_columns.sql` now `DROP POLICY IF EXISTS` each exact name inside the transaction **before** creating/relying on scoped replacements. Unrelated policies (e.g. `"Project members can manage SLA instances"` from `20260608…`) are **not** dropped.

Post-apply still required to confirm live access is restored.

---

## Migration review summary (06 / 07)

### `20261020080000_dev_repair_06_sla_canonical_columns.sql`

| Check | Result |
|-------|--------|
| Additive columns only; no DROP TABLE/COLUMN/TRUNCATE | **PASS** |
| Preflight requires existing SLA tables | **PASS** |
| Orphan checks before FKs (`form_id`, `chain_id`, group escalate) | **PASS** |
| Nested-select FKs for `template`/`chain`/`form` embeds | **PASS** (after columns exist) |
| Enums created idempotently | **PASS** |
| `calculate_business_hours` signature matches canonical | **PASS** |
| Drops exact Dev `*_migration_deny` RESTRICTIVE policies | **PASS** (repo fix) |
| Replaces historical `USING (true)` / `WITH CHECK (true)` on instances/events | **PASS** (scoped to org admin / project admin\|editor) |
| Ensures View + manage/insert policies on holidays, field config, instances, events | **PASS** (org/project scoped; no `USING (true)`) |
| Does not drop unrelated scoped policies by name | **PASS** |
| Compatible with Nest processor / UI / AI column names | **PASS** (code also fixed) |
| Assumes Dev SLA tables empty or orphans absent | **Documented** — RAISE if orphans |

### `20261020080100_dev_repair_07_workflow_queue_additive.sql`

| Check | Result |
|-------|--------|
| Additive columns; preserves prior Dev repair columns | **PASS** |
| No `error_message` column invented | **PASS** |
| Orphan check before `submission_id` FK | **PASS** |
| Claim uses `FOR UPDATE SKIP LOCKED` | **PASS** |
| Stuck reclaim increments `retry_count`; terminal when maxed | **PASS** |
| Claim sets `started_at = now()` (accurate stuck window) | **PASS** |
| EXECUTE granted to `service_role` only; PUBLIC revoked | **PASS** |
| Nest writes `last_error` + authenticated retry endpoint | **PASS** (code) |
| Unchanged this turn (no concrete defect) | **PASS** |

---

## Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Forms repairs 01–05 in repo | **PASS** |
| 2 | SLA additive schema 06 | **PASS (repo)** |
| 2b | SLA `*_migration_deny` drop in 06 | **PASS (repo)** — live apply pending |
| 3 | Queue additive + claim 07 | **PASS (repo)** |
| 4 | Nest queue `last_error` + retries | **PASS** |
| 5 | Queue UI retry via Nest auth endpoint | **PASS** |
| 6 | SLA `USING(true)` hardened in 06 | **PASS (repo)** |
| 7 | AI SLA column names | **PASS** |
| 8 | Promo Prod-disabled by default | **PASS** (static) |
| 9 | Dockerfile.frontend present | **PASS** |
| 10 | Live Dev apply + smoke | **PENDING** |
| 11 | Commit / push / PR update | **Not done** (awaiting approval) |

---

## Remaining unresolved / live-only

1. Confirm live Dev has zero orphan `form_id` / `submission_id` before FK add (migration raises if not).
2. Confirm Forms 01–05 already applied on Dev (skip if yes).
3. After 06: confirm the four `*_migration_deny` policies are gone and scoped View/Manage/Insert policies exist; smoke authenticated SLA reads/writes.
4. After 06: verify processor nested select `chain:escalation_chains(..., levels:escalation_levels(*))` works.
5. After 07: verify Nest; smoke enqueue → fail → auto-retry → manual retry via UI.
6. Optional: inventory remaining SLA policies after apply (templates/chains/levels untouched; leave unless unsafe).
7. ITAM/VIS live schema parity — requires Dev DB credentials (code-reviewed only).

---

## Safe Dev apply order (manual)

```bash
# Confirm Dev target first: SELECT current_database(), current_user;
psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql \
  -f supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql \
  -f supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql \
  -f supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql \
  -f supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql \
  -f supabase/migrations/20261020080000_dev_repair_06_sla_canonical_columns.sql \
  -f supabase/migrations/20261020080100_dev_repair_07_workflow_queue_additive.sql
```

Skip 01–05 if already applied. **Never** point at Production. **Never** `supabase db push` to Prod.
