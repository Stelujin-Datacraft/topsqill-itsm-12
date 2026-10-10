/**
 * VIS collection → Supabase table map.
 * Column names match supabase/migrations/20261010120000_vis_supabase_persistence.sql.
 */
import type { VisStoreData } from './vis.store';

export type VisCollection = keyof VisStoreData;

/** Collections stored as JSON documents (demo forms / records). */
export const DOCUMENT_COLLECTIONS: VisCollection[] = ['mockForms', 'mockRecords'];

const COLUMN_OVERRIDES: Record<string, string> = {
  allowPrivateNet: 'allow_private_network',
  openApiDiscovery: 'openapi_discovery',
};

const FIELD_OVERRIDES: Record<string, string> = {
  allow_private_network: 'allowPrivateNet',
  openapi_discovery: 'openApiDiscovery',
};

export function toColumn(field: string): string {
  if (COLUMN_OVERRIDES[field]) return COLUMN_OVERRIDES[field];
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toField(column: string): string {
  if (FIELD_OVERRIDES[column]) return FIELD_OVERRIDES[column];
  return column.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export interface VisCollectionSpec {
  table: string;
  columns: string[];
  orderBy: string;
}

function spec(table: string, columns: string[], orderBy = 'created_at'): VisCollectionSpec {
  return { table, columns, orderBy };
}

export const VIS_COLLECTIONS: Record<Exclude<VisCollection, 'mockForms' | 'mockRecords'>, VisCollectionSpec> = {
  connections: spec('vis_connections', [
    'id', 'organization_id', 'name', 'kind', 'environment', 'base_url', 'auth_type',
    'credential_ref_id', 'config', 'allow_private_network', 'created_at', 'updated_at', 'deleted_at',
  ]),
  credentials: spec('vis_credential_references', [
    'id', 'organization_id', 'tenant_id', 'name', 'type', 'secret_handle', 'metadata',
    'created_at', 'updated_at', 'deleted_at',
  ]),
  integrations: spec('vis_integrations', [
    'id', 'organization_id', 'tenant_id', 'name', 'description', 'status', 'environment',
    'prompt_text', 'current_version_id', 'created_by', 'created_at', 'updated_at', 'deleted_at',
  ]),
  versions: spec('vis_integration_versions', [
    'id', 'integration_id', 'version', 'status', 'design', 'directions', 'ai_proposal',
    'user_changes', 'event_config', 'source_fields', 'source_sample', 'openapi_discovery',
    'selected_endpoint', 'final_configuration', 'created_at',
  ]),
  schemaCache: spec('vis_schema_cache', [
    'id', 'connection_id', 'application_key', 'form_id', 'form_name', 'fields', 'api_version',
    'schema_version', 'schema_hash', 'retrieved_at',
  ], 'retrieved_at'),
  executions: spec('vis_executions', [
    'id', 'integration_id', 'version_id', 'status', 'trigger', 'started_at', 'completed_at',
    'records_read', 'records_created', 'records_updated', 'records_failed', 'retry_count',
    'error_message', 'error_code', 'correlation_id', 'workers', 'repair_report_id', 'payload', 'created_at',
  ]),
  logs: spec('vis_execution_logs', [
    'id', 'execution_id', 'integration_id', 'correlation_id', 'level', 'step', 'message',
    'record_id', 'error_code', 'metadata', 'timestamp',
  ], 'timestamp'),
  audits: spec('vis_audit_logs', [
    'id', 'organization_id', 'integration_id', 'version_id', 'actor_id', 'action', 'detail', 'created_at',
  ]),
  deadLetters: spec('vis_dead_letter_items', [
    'id', 'integration_id', 'execution_id', 'source_record', 'error', 'retry_count', 'status', 'created_at',
  ]),
  events: spec('vis_events', [
    'id', 'event_id', 'integration_id', 'status', 'event_type', 'entity_id', 'payload',
    'correlation_id', 'trace_id', 'received_at', 'processed_at', 'metadata',
  ], 'received_at'),
  eventEndpoints: spec('vis_event_endpoints', [
    'id', 'integration_id', 'path', 'secret_ref', 'config', 'created_at',
  ]),
  eventSubscriptions: spec('vis_event_subscriptions', [
    'id', 'integration_id', 'config', 'created_at',
  ]),
  eventDeadLetters: spec('vis_event_dead_letters', [
    'id', 'integration_id', 'event_id', 'payload', 'error', 'created_at',
  ]),
  eventCheckpoints: spec('vis_event_checkpoints', [
    'id', 'integration_id', 'cursor', 'metadata', 'updated_at',
  ], 'updated_at'),
  codegenArtifacts: spec('vis_codegen_artifacts', [
    'id', 'integration_id', 'version_id', 'language', 'files', 'validation', 'security_scan',
    'dependency_scan', 'status', 'approved_at', 'created_at',
  ]),
  promotions: spec('vis_promotions', [
    'id', 'integration_id', 'from_environment', 'to_environment', 'version_id', 'version_number',
    'env_config', 'actor_id', 'created_at',
  ]),
  changeHistory: spec('vis_change_history', [
    'id', 'integration_id', 'version_id', 'action', 'detail', 'created_at',
  ]),
  approvals: spec('vis_approvals', [
    'id', 'integration_id', 'version_id', 'actor_id', 'decision', 'created_at',
  ]),
  metrics: spec('vis_metric_samples', [
    'id', 'name', 'labels', 'value', 'kind', 'recorded_at',
  ], 'recorded_at'),
  traces: spec('vis_trace_spans', [
    'id', 'trace_id', 'span_id', 'parent_span_id', 'name', 'correlation_id', 'execution_id',
    'event_id', 'attributes', 'started_at', 'ended_at',
  ], 'started_at'),
  alerts: spec('vis_alerts', [
    'id', 'rule_id', 'message', 'severity', 'value', 'status', 'created_at',
  ]),
  reconciliationReports: spec('vis_reconciliation_reports', [
    'id', 'integration_id', 'version_id', 'mode', 'diff_count', 'diffs', 'status', 'created_at',
  ]),
  repairReports: spec('vis_repair_reports', [
    'id', 'report_id', 'integration_id', 'version_id', 'actor_id', 'items', 'status', 'created_at',
  ]),
  driftFindings: spec('vis_drift_findings', [
    'id', 'connection_id', 'form_id', 'findings', 'max_severity', 'acknowledged', 'detected_at',
  ], 'detected_at'),
  impactAnalyses: spec('vis_impact_analyses', [
    'id', 'finding_count', 'affected_count', 'affected', 'ai_proposals', 'requires_approval', 'created_at',
  ]),
  connectors: spec('vis_connectors', [
    'id', 'name', 'vendor', 'version', 'category', 'description', 'capabilities', 'authentication',
    'operations', 'visibility', 'lifecycle', 'security_status', 'publisher', 'package', 'certification',
    'published_at', 'created_at', 'updated_at', 'deleted_at',
  ]),
  connectorInstalls: spec('vis_connector_installs', [
    'id', 'connector_id', 'organization_id', 'integration_id', 'version', 'status', 'installed_at', 'updated_at',
  ], 'installed_at'),
  connectorUpgrades: spec('vis_connector_upgrades', [
    'id', 'install_id', 'from_connector_id', 'to_connector_id', 'from_version', 'to_version', 'status',
    'created_at', 'applied_at', 'rolled_back_at',
  ]),
  aiRecommendations: spec('vis_ai_recommendations', [
    'id', 'type', 'reason', 'evidence', 'confidence', 'affected_integration_id', 'affected_version_id',
    'proposed_change', 'risk', 'status', 'created_at', 'updated_at',
  ]),
  generatedTests: spec('vis_generated_test_suites', [
    'id', 'integration_id', 'tests', 'created_at',
  ]),
  generatedDocs: spec('vis_generated_docs', [
    'id', 'integration_id', 'markdown', 'structured', 'created_at',
  ]),
  healingActions: spec('vis_healing_actions', [
    'id', 'action_type', 'trigger', 'integration_id', 'execution_id', 'version_id', 'status',
    'detail', 'evidence', 'result', 'created_at',
  ]),
};

export function isDocumentCollection(collection: VisCollection): boolean {
  return DOCUMENT_COLLECTIONS.includes(collection);
}

export function collectionSpec(collection: VisCollection): VisCollectionSpec | null {
  if (isDocumentCollection(collection)) return null;
  return VIS_COLLECTIONS[collection as Exclude<VisCollection, 'mockForms' | 'mockRecords'>];
}

export const VIS_TABLE_NAMES: string[] = [
  ...Object.values(VIS_COLLECTIONS).map((item) => item.table),
  'vis_documents',
  'vis_secret_blobs',
  'vis_policy_rules',
  'vis_user_refs',
];
