# Full Dev environment audit — consolidated report

**Branch:** `cursor/fix-dev-crud-create-delete-e654`  
**HEAD at report time:** `ae3000ad` + uncommitted working-tree repairs (not committed/pushed)  
**Date:** 2026-10-20  

**Safety:** Dev-only intent. No Production apply. No remote SQL from this agent. No commit/push/deploy without operator approval.

---

## 1. Modules audited

| Module | Status |
|--------|--------|
| Auth / profiles / sessions | Code-reviewed |
| Orgs / projects / roles | Helpers via Forms 01/03/05 |
| Forms | Repairs 01–05 in repo; preserve live Dev if applied |
| Workflows / queue | Nest `last_error` + retries + **auth Nest retry**; repair 07 |
| SLA | Repair 06 + AI columns + **USING(true) hardened** |
| Notifications / email | Code-reviewed |
| ITAM / discovery | Config tests; no remote schema apply |
| VIS | `logical_id` preserved; no mutating tests |
| Promotional Transfer | Prod-disabled by default (verified in code) |
| Reports / dashboards | Prior zero-row guards |
| AI / copilot | SLA insert columns fixed |
| Blog / integrations | Code-reviewed |
| Docker / proxy | `Dockerfile.frontend` + compose build args |

---

## 2. Issues found and fixed (this continuation)

| Issue | Fix |
|-------|-----|
| Migration 06 lacked table preflight / orphan FK guards | Added RAISE preflight + orphan counts before FKs |
| Migration 06 enabled RLS on new tables without policies | Added scoped SELECT/ALL policies |
| Historical `Manage SLA instances` `USING (true)` | Replaced with org-admin / project admin\|editor scoped policy |
| Historical `Insert escalation events` `WITH CHECK (true)` | Replaced with project-member / org-admin scoped policy |
| Dev RESTRICTIVE `*_migration_deny` on holidays / field config / instances / events (`USING (false)`) | **Blocker:** 06 did not drop them → authenticated still denied after scoped PERMISSIVE policies. **Fixed in repo:** exact `DROP POLICY IF EXISTS` before replacements; View policies re-asserted |
| Migration 07 stuck reclaim could loop forever | Increment `retry_count`; terminal-fail when maxed |
| Claim used `COALESCE(started_at, now())` | Always `started_at = now()` on claim |
| Claim EXECUTE possibly public | `REVOKE … FROM PUBLIC`; grant `service_role` only |
| Queue UI retry via user JWT under SELECT-only RLS | Nest `POST /workflows/queue/retry` + authz; UI uses `functions.invoke` |
| AI SLA wrong column names | Nest + Edge → `warning_hours` / `business_start_time` (prior turn) |
| Missing `Dockerfile.frontend` | Added (prior turn) |

---

## 3. Remaining security / live risks

| Risk | Why unresolved |
|------|----------------|
| Live apply not run | Agent must not mutate Dev DB without approval |
| SLA `*_migration_deny` still live on Dev until 06 applies | Repo migration now drops them; **post-apply policy dump + smoke required** before claiming access restored |
| Orphan FKs if Dev not empty | Migration raises — operator must clear orphans first |
| Forms 01–05 apply state | Requires Dev confirmation |
| Open Nest `@Public()` enqueue/execute/process-queue | Pre-existing; out of this repair (service-key assumption) — **do not weaken further** |
| Redis worker may skip claim stamp | Follow-up if Redis enabled |
| ITAM/VIS live schema drift | Needs Dev credentials; code-level only here |

---

## 4. Final migration review findings

See `GO_NO_GO.md` matrices for 06 and 07. Summary: **CONDITIONAL GO for Dev** after approval; **NO-GO for Prod**.

**SLA deny blocker (fixed in repo, not live):** Operator SQL Editor showed RESTRICTIVE `business_holidays_migration_deny`, `form_field_sla_config_migration_deny`, `sla_instances_migration_deny`, `escalation_events_migration_deny` (`USING (false)` / `WITH CHECK (false)`). Migration 06 previously only replaced PERMISSIVE policies; RESTRICTIVE denies would keep blocking. 06 now drops those exact names inside the transaction, then ensures scoped View / Manage / Insert policies (no `USING (true)`). Unrelated policies such as `"Project members can manage SLA instances"` are left alone.

Unverified assumptions (operator inventory): Dev SLA tables empty; Forms deny-all already known; queue columns partially repaired.

---

## 5. Tests and results

| Command | Result |
|---------|--------|
| `cd backend && npm run test:database` | Run in agent final pass |
| `cd backend && npm run build` | Run in agent final pass |
| `npm run test:promotion` | Passed previously; re-run if time |
| `npm run test:itam:discovery:config` | Passed previously |
| Frontend `npm run build` | Attempt if deps present |
| `git diff --check` | Must be clean |

Static/unit pass ≠ Dev DB repaired.

---

## 6. Live Dev validation required

1. Confirm DB identity is Dev.
2. Apply 01–05 if needed, then **06**, then **07**.
3. Post-flight: confirm four `*_migration_deny` policies absent; scoped SLA policies present; columns/FKs/RPC (see `VALIDATION.md` + GO_NO_GO).
4. Smoke: SLA template/chain/instance + process-escalations; form delete; queue fail/retry UI; AI create SLA.
5. Redeploy Nest so retry endpoint + `last_error` code are live.

---

## 7. Ordered manual Dev plan

```bash
psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261019120000_dev_repair_01_form_access_helpers.sql \
  -f supabase/migrations/20261019120100_dev_repair_02_form_table_rls.sql \
  -f supabase/migrations/20261019120200_dev_repair_03_invitations_rpc.sql \
  -f supabase/migrations/20261019120300_dev_repair_04_form_fk_delete.sql \
  -f supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql \
  -f supabase/migrations/20261020080000_dev_repair_06_sla_canonical_columns.sql \
  -f supabase/migrations/20261020080100_dev_repair_07_workflow_queue_additive.sql
```

Then: redeploy Nest backend; run UI smoke checklist above.

---

## 8. Explicit confirmation

- **No remote SQL** executed by this agent.
- **No deployment / container restart**.
- **No commit / push / PR mutation** in this continuation.
- **No Production credentials** used.
- Existing working-tree changes preserved (no reset/stash/clean/branch switch).

---

## 9. Readiness

**CONDITIONAL GO** to manually apply migrations **06 and 07** on Dev after operator approval and Nest redeploy.  
**Not fully fixed** until live post-flight + smoke succeed.
