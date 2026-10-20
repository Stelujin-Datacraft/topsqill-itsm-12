/**
 * Static review of Dev SLA + workflow_queue repair migrations / Nest queue fix.
 * Does not connect to a database.
 *
 *   npx tsx test/database/dev-sla-workflow-repair.test.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const ROOT = resolve(__dirname, '../../..');

function load(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function assertContains(sql: string, needle: string | RegExp, msg: string) {
  const ok = typeof needle === 'string' ? sql.includes(needle) : needle.test(sql);
  assert(ok, msg);
}

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
}

const M06 = 'supabase/migrations/20261020080000_dev_repair_06_sla_canonical_columns.sql';
const M07 = 'supabase/migrations/20261020080100_dev_repair_07_workflow_queue_additive.sql';
const WF = 'backend/src/workflows/workflows.service.ts';
const WFC = 'backend/src/workflows/workflows.controller.ts';
const AI = 'backend/src/engines/ai-copilot-action.engine.ts';
const MONITOR = 'src/components/workflows/WorkflowQueueMonitor.tsx';
const API = 'src/services/api/apiClient.ts';
const PROMO = 'backend/src/promotion/promotion-access.ts';

console.log('dev-sla-workflow-repair static review');

{
  const m06 = load(M06);
  const code = stripSqlComments(m06);
  assertContains(m06, 'BEGIN;', '06 transactional');
  assertContains(m06, 'COMMIT;', '06 commit');
  assertContains(m06, 'preflight failed — missing SLA tables', '06 fails if SLA tables missing');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS warning_hours', '06 adds warning_hours');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS breach_hours', '06 adds breach_hours');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS chain_id', '06 adds chain_id');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS started_at', '06 adds started_at');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS warning_at', '06 adds warning_at');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS breach_at', '06 adds breach_at');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS current_stage', '06 adds current_stage');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS level_order', '06 adds level_order');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS hours_after_breach', '06 adds hours_after_breach');
  assertContains(m06, 'ADD COLUMN IF NOT EXISTS escalation_level', '06 adds escalation_events.escalation_level');
  assertContains(m06, 'CREATE TABLE IF NOT EXISTS public.form_field_sla_config', '06 ensures form_field_sla_config');
  assertContains(m06, 'CREATE TABLE IF NOT EXISTS public.business_holidays', '06 ensures business_holidays');
  assertContains(m06, 'orphans before adding FK', '06 orphan-guards FKs');

  // Known Dev temporary RESTRICTIVE deny-all (USING/WITH CHECK false) — must drop
  // before scoped policies can take effect (RESTRICTIVE AND permissive).
  assertContains(
    m06,
    'DROP POLICY IF EXISTS "business_holidays_migration_deny" ON public.business_holidays',
    '06 drops business_holidays_migration_deny',
  );
  assertContains(
    m06,
    'DROP POLICY IF EXISTS "form_field_sla_config_migration_deny" ON public.form_field_sla_config',
    '06 drops form_field_sla_config_migration_deny',
  );
  assertContains(
    m06,
    'DROP POLICY IF EXISTS "sla_instances_migration_deny" ON public.sla_instances',
    '06 drops sla_instances_migration_deny',
  );
  assertContains(
    m06,
    'DROP POLICY IF EXISTS "escalation_events_migration_deny" ON public.escalation_events',
    '06 drops escalation_events_migration_deny',
  );

  // Deny drops must appear before the intended scoped CREATE POLICY replacements
  const denyPos = m06.indexOf('DROP POLICY IF EXISTS "sla_instances_migration_deny"');
  const managePos = m06.indexOf('CREATE POLICY "Manage SLA instances"');
  const viewInstPos = m06.indexOf('CREATE POLICY "View SLA instances"');
  const insertEvtPos = m06.indexOf('CREATE POLICY "Insert escalation events"');
  const viewEvtPos = m06.indexOf('CREATE POLICY "View escalation events"');
  const viewHolPos = m06.indexOf('CREATE POLICY "View holidays in org"');
  const viewFieldPos = m06.indexOf('CREATE POLICY "View field SLA config"');
  assert(denyPos >= 0 && managePos > denyPos, '06 drops sla deny before Manage SLA instances');
  assert(viewHolPos > denyPos, '06 drops denies before holiday policies');
  assert(viewFieldPos > denyPos, '06 drops denies before field SLA policies');
  assert(viewInstPos > denyPos, '06 ensures View SLA instances after deny drop');
  assert(viewEvtPos > denyPos, '06 ensures View escalation events after deny drop');
  assert(insertEvtPos > denyPos, '06 ensures Insert escalation events after deny drop');

  assertContains(m06, 'DROP POLICY IF EXISTS "Manage SLA instances"', '06 drops permissive manage policy');
  assertContains(m06, 'DROP POLICY IF EXISTS "Insert escalation events"', '06 drops permissive insert policy');
  assertContains(m06, 'CREATE POLICY "Manage SLA instances"', '06 defines Manage SLA instances');
  assertContains(m06, 'CREATE POLICY "View SLA instances"', '06 defines View SLA instances');
  assertContains(m06, 'CREATE POLICY "Insert escalation events"', '06 defines Insert escalation events');
  assertContains(m06, 'CREATE POLICY "View escalation events"', '06 defines View escalation events');
  assertContains(m06, 'CREATE POLICY "View holidays in org"', '06 defines View holidays in org');
  assertContains(m06, 'CREATE POLICY "Admins manage holidays"', '06 defines Admins manage holidays');
  assertContains(m06, 'CREATE POLICY "View field SLA config"', '06 defines View field SLA config');
  assertContains(m06, 'CREATE POLICY "Admins manage field SLA config"', '06 defines Admins manage field SLA config');
  assertContains(m06, "pu.role IN ('admin', 'editor')", '06 scopes manage to project admin/editor');
  assertContains(m06, 'organization_id = business_holidays.organization_id', '06 holidays admin is org-scoped');
  assertContains(m06, 'up.organization_id = f.organization_id', '06 field SLA admin is org-scoped via form');
  assert(!/Project members can manage SLA instances/.test(code), '06 must not drop unrelated Project members manage policy by name');
  assert(!/USING\s*\(\s*true\s*\)/i.test(code), '06 must not recreate USING(true)');
  assert(!/WITH CHECK\s*\(\s*true\s*\)/i.test(code), '06 must not recreate WITH CHECK(true)');
  assert(!/\bDROP\s+TABLE\b/i.test(code), '06 must not DROP TABLE');
  assert(!/\bTRUNCATE\b/i.test(code), '06 must not TRUNCATE');
  assert(!/\bDROP\s+COLUMN\b/i.test(code), '06 must not DROP COLUMN');
  console.log('  ✓ migration 06 SLA canonical columns + deny drop + RLS harden');
}

{
  const m07 = load(M07);
  const code = stripSqlComments(m07);
  assertContains(m07, 'BEGIN;', '07 transactional');
  assertContains(m07, 'ADD COLUMN IF NOT EXISTS submission_id', '07 preserves/adds submission_id');
  assertContains(m07, 'ADD COLUMN IF NOT EXISTS trigger_data', '07 preserves/adds trigger_data');
  assertContains(m07, 'ADD COLUMN IF NOT EXISTS started_at', '07 preserves/adds started_at');
  assertContains(m07, 'ADD COLUMN IF NOT EXISTS last_error', '07 ensures last_error');
  assertContains(m07, 'claim_workflow_queue_batch', '07 restores claim RPC');
  assertContains(m07, 'FOR UPDATE SKIP LOCKED', '07 concurrent-safe claim');
  assertContains(m07, 'started_at = now()', '07 claim stamps started_at=now for stuck detection');
  assertContains(m07, 'retry_count = COALESCE(retry_count, 0) + 1', '07 stuck reclaim increments retry');
  assertContains(m07, 'max retries', '07 terminal-fails exhausted stuck jobs');
  assertContains(m07, 'REVOKE ALL ON FUNCTION public.claim_workflow_queue_batch(integer) FROM PUBLIC', '07 revokes PUBLIC');
  assertContains(m07, 'GRANT EXECUTE ON FUNCTION public.claim_workflow_queue_batch(integer) TO service_role', '07 grants service_role');
  assertContains(m07, 'orphans', '07 orphan-guards submission FK');
  assert(!/\bADD\s+COLUMN[\s\S]{0,80}\berror_message\b/i.test(code), '07 must not ADD error_message');
  assert(!/\bDROP\s+TABLE\b/i.test(code), '07 must not DROP TABLE');
  console.log('  ✓ migration 07 workflow_queue additive + claim RPC');
}

{
  const wf = load(WF);
  assertContains(wf, 'markQueueItemFailure', 'Nest has retry-aware failure helper');
  assertContains(wf, 'Max retries exceeded', 'Nest permanent-fail path');
  assertContains(wf, 'retryQueueItem', 'Nest manual retry method');
  assertContains(wf, 'userCanManageQueueItem', 'Nest authz for retry');
  assert(/last_error:\s*null/.test(wf), 'success clears last_error');
  assert(/last_error:\s*truncated/.test(wf), 'retry path sets last_error');
  const helperStart = wf.indexOf('markQueueItemFailure');
  const helperSlice = wf.slice(helperStart, helperStart + 1800);
  assert(!/error_message\s*:/.test(helperSlice), 'queue failure helper has no error_message key');
  console.log('  ✓ Nest workflow queue uses last_error + retries + authz retry');
}

{
  const wfc = load(WFC);
  assertContains(wfc, "Post('queue/retry')", 'controller exposes queue retry');
  assertContains(wfc, 'SupabaseAuthGuard', 'retry requires auth');
  assertContains(wfc, 'queue_id', 'retry accepts queue_id body');
  console.log('  ✓ Nest queue retry endpoint is authenticated');
}

{
  const monitor = load(MONITOR);
  const api = load(API);
  assertContains(api, 'retry-workflow-queue-item', 'apiClient maps retry function');
  assertContains(monitor, 'retry-workflow-queue-item', 'UI calls Nest retry');
  assert(
    !/\.from\('workflow_queue'\)[\s\S]{0,200}\.update\(/.test(monitor),
    'UI must not direct-update workflow_queue for retry',
  );
  console.log('  ✓ Queue monitor retries via Nest (not direct RLS write)');
}

{
  const ai = load(AI);
  assertContains(ai, 'warning_hours:', 'AI insert uses warning_hours');
  assertContains(ai, 'breach_hours:', 'AI insert uses breach_hours');
  assertContains(ai, 'business_start_time:', 'AI insert uses business_start_time');
  assert(!/\bwarning_threshold_hours\s*:/.test(ai), 'AI must not insert warning_threshold_hours');
  assert(!/\bbusiness_hours_start\s*:/.test(ai), 'AI must not insert business_hours_start');
  console.log('  ✓ AI copilot SLA insert uses canonical column names');
}

{
  const promo = load(PROMO);
  assertContains(promo, 'production', 'promo access aware of production');
  assertContains(promo, 'PROMOTIONAL_TRANSFER_ENABLED', 'promo has explicit flag');
  assert(
    /production[\s\S]{0,200}disabled|disabled[\s\S]{0,200}production/i.test(promo),
    'promo disabled in production by default',
  );
  console.log('  ✓ Promotional Transfer remains Prod-disabled by default');
}

console.log('dev-sla-workflow-repair: all static checks passed');
