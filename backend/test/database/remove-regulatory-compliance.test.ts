import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sqlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/migrations/20261029120000_remove_regulatory_compliance_module.sql',
);
const sql = readFileSync(sqlPath, 'utf8');

const formRefs = [
  'grc.regulatory.standard',
  'grc.regulatory.clause',
  'grc.regulatory.requirement',
];
const workflowRefs = [
  'grc.regulatory.workflow.standard-review',
  'grc.regulatory.workflow.source-review',
  'grc.regulatory.workflow.requirement-review',
];
const reportRefs = [
  'grc.regulatory.report.standards',
  'grc.regulatory.report.standards-awaiting-verification',
  'grc.regulatory.report.clauses',
  'grc.regulatory.report.clauses-awaiting-verification',
  'grc.regulatory.report.requirements',
  'grc.regulatory.report.ai-suggested-requirements',
  'grc.regulatory.report.requirements-awaiting-review',
  'grc.regulatory.report.applicability-open',
];

for (const referenceId of [...formRefs, ...workflowRefs, ...reportRefs, 'grc.regulatory.dashboard']) {
  assert.ok(sql.includes(`'${referenceId}'`), `missing ${referenceId}`);
}

assert.equal(sql.includes('DELETE FROM public.policies'), false);
assert.equal(sql.includes('DELETE FROM public.compliance_frameworks'), false);
assert.equal(sql.includes('DELETE FROM public.compliance_controls'), false);
assert.ok(sql.includes('Regulatory cleanup changed the Policy Register row count'));
assert.ok(sql.includes('UPDATE public.policies'));
assert.ok(sql.includes('SET form_id = NULL'));
assert.ok(sql.includes('SET workflow_id = NULL'));

const deleteTargets = [...sql.matchAll(/DELETE FROM public\.([a-z0-9_]+)/g)].map((match) => match[1]);
const allowed = new Set([
  'data_feed_runs',
  'data_feeds',
  'workflow_queue',
  'workflow_executions',
  'workflow_connections',
  'workflow_nodes',
  'workflow_triggers',
  'sla_instances',
  'form_field_sla_config',
  'lifecycle_stage_history',
  'record_field_history',
  'document_history',
  'performance_data_sources',
  'form_audit_logs',
  'form_user_access',
  'form_access_requests',
  'form_assignments',
  'form_submissions',
  'form_fields',
  'report_components',
  'report_media',
  'reports',
  'default_dashboard_users',
  'dashboards',
  'workflows',
  'forms',
  'audit_logs',
]);
for (const table of deleteTargets) {
  assert.ok(allowed.has(table), `unexpected delete target ${table}`);
}

assert.ok(sql.includes("event_category = 'regulatory'"));
assert.ok(sql.includes('kept_forms'));
assert.match(sql, /Regulatory cleanup removed a form outside the regulatory reference ids/);

console.log('regulatory removal migration is limited to the module reference ids');
