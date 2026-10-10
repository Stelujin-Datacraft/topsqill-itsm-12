-- VIS persistence on the existing Supabase project.
-- Review only. This change does not apply the migration.
-- Idempotent: creates missing tables, indexes, and foreign keys.
-- Does not drop tables, delete rows, or overwrite existing data.
-- Service-role access only. The service-role key stays on the backend.

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_user_refs" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "tenant_id" TEXT,
    "organization_id" TEXT,
    "roles" JSONB NOT NULL DEFAULT '[]',
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" timestamptz,

    CONSTRAINT "vis_user_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_credential_references" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "secret_handle" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz,

    CONSTRAINT "vis_credential_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'DEV',
    "base_url" TEXT,
    "auth_type" TEXT NOT NULL,
    "credential_ref_id" TEXT,
    "config" JSONB,
    "allow_private_network" BOOLEAN NOT NULL DEFAULT false,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz,

    CONSTRAINT "vis_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "environment" TEXT NOT NULL DEFAULT 'DEV',
    "prompt_text" TEXT,
    "current_version_id" TEXT,
    "created_by" TEXT,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz,

    CONSTRAINT "vis_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_integration_versions" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "design" JSONB,
    "directions" JSONB,
    "ai_proposal" JSONB,
    "user_changes" JSONB,
    "event_config" JSONB,
    "source_fields" JSONB,
    "source_sample" JSONB,
    "openapi_discovery" JSONB,
    "selected_endpoint" JSONB,
    "final_configuration" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_integration_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_schema_cache" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "application_key" TEXT,
    "form_id" TEXT NOT NULL,
    "form_name" TEXT,
    "fields" JSONB NOT NULL,
    "api_version" TEXT,
    "schema_version" TEXT,
    "schema_hash" TEXT,
    "retrieved_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_schema_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_executions" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT,
    "started_at" timestamptz,
    "completed_at" timestamptz,
    "records_read" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "error_code" TEXT,
    "correlation_id" TEXT,
    "workers" INTEGER,
    "repair_report_id" TEXT,
    "payload" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_execution_logs" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "correlation_id" TEXT,
    "level" TEXT NOT NULL,
    "step" TEXT,
    "message" TEXT NOT NULL,
    "record_id" TEXT,
    "error_code" TEXT,
    "metadata" JSONB,
    "timestamp" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "integration_id" TEXT,
    "version_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_dead_letter_items" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "execution_id" TEXT,
    "source_record" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_dead_letter_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "status" TEXT NOT NULL,
    "event_type" TEXT,
    "entity_id" TEXT,
    "payload" JSONB,
    "correlation_id" TEXT,
    "trace_id" TEXT,
    "received_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" timestamptz,
    "metadata" JSONB,

    CONSTRAINT "vis_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_event_endpoints" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "secret_ref" TEXT,
    "config" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_event_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_event_subscriptions" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_event_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_event_dead_letters" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT,
    "event_id" TEXT,
    "payload" JSONB,
    "error" TEXT NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_event_dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_event_checkpoints" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "cursor" TEXT,
    "metadata" JSONB,
    "updated_at" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "vis_event_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_codegen_artifacts" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "language" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "validation" JSONB,
    "security_scan" JSONB,
    "dependency_scan" JSONB,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "approved_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_codegen_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_promotions" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "from_environment" TEXT NOT NULL,
    "to_environment" TEXT NOT NULL,
    "version_id" TEXT,
    "version_number" INTEGER,
    "env_config" JSONB,
    "actor_id" TEXT,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_change_history" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_approvals" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "actor_id" TEXT,
    "decision" TEXT NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_metric_samples" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB,
    "value" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "recorded_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_metric_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_trace_spans" (
    "id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "span_id" TEXT NOT NULL,
    "parent_span_id" TEXT,
    "name" TEXT NOT NULL,
    "correlation_id" TEXT,
    "execution_id" TEXT,
    "event_id" TEXT,
    "attributes" JSONB,
    "started_at" timestamptz NOT NULL,
    "ended_at" timestamptz,

    CONSTRAINT "vis_trace_spans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_alerts" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_reconciliation_reports" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "mode" TEXT NOT NULL,
    "diff_count" INTEGER NOT NULL,
    "diffs" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_reconciliation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_repair_reports" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "actor_id" TEXT,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_repair_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_drift_findings" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT,
    "form_id" TEXT,
    "findings" JSONB NOT NULL,
    "max_severity" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "detected_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_drift_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_impact_analyses" (
    "id" TEXT NOT NULL,
    "finding_count" INTEGER NOT NULL,
    "affected_count" INTEGER NOT NULL,
    "affected" JSONB NOT NULL,
    "ai_proposals" JSONB,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_connectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "capabilities" JSONB NOT NULL,
    "authentication" JSONB NOT NULL,
    "operations" JSONB NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "lifecycle" TEXT NOT NULL DEFAULT 'DRAFT',
    "security_status" TEXT NOT NULL DEFAULT 'PENDING',
    "publisher" TEXT,
    "package" JSONB,
    "certification" JSONB,
    "published_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz,

    CONSTRAINT "vis_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_connector_installs" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENABLED',
    "installed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "vis_connector_installs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_connector_upgrades" (
    "id" TEXT NOT NULL,
    "install_id" TEXT NOT NULL,
    "from_connector_id" TEXT NOT NULL,
    "to_connector_id" TEXT NOT NULL,
    "from_version" TEXT NOT NULL,
    "to_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" timestamptz,
    "rolled_back_at" timestamptz,

    CONSTRAINT "vis_connector_upgrades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_ai_recommendations" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "affected_integration_id" TEXT,
    "affected_version_id" TEXT,
    "proposed_change" JSONB NOT NULL,
    "risk" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "vis_ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_generated_test_suites" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "tests" JSONB NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_generated_test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_generated_docs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "structured" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_generated_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_healing_actions" (
    "id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "integration_id" TEXT,
    "execution_id" TEXT,
    "version_id" TEXT,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "evidence" JSONB,
    "result" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_healing_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_secret_blobs" (
    "id" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local-encrypted',
    "rotated_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "vis_secret_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_policy_rules" (
    "id" TEXT NOT NULL,
    "rule_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "vis_policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vis_documents" (
    "id" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz,

    CONSTRAINT "vis_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_user_refs_tenant_id_organization_id_idx" ON "vis_user_refs"("tenant_id", "organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_credential_references_organization_id_idx" ON "vis_credential_references"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_connections_organization_id_idx" ON "vis_connections"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_integrations_organization_id_status_idx" ON "vis_integrations"("organization_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_integrations_tenant_id_idx" ON "vis_integrations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vis_integration_versions_integration_id_version_key" ON "vis_integration_versions"("integration_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vis_schema_cache_connection_id_form_id_key" ON "vis_schema_cache"("connection_id", "form_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_executions_integration_id_status_idx" ON "vis_executions"("integration_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_executions_correlation_id_idx" ON "vis_executions"("correlation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_execution_logs_execution_id_idx" ON "vis_execution_logs"("execution_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_execution_logs_correlation_id_idx" ON "vis_execution_logs"("correlation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_audit_logs_integration_id_idx" ON "vis_audit_logs"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_audit_logs_action_created_at_idx" ON "vis_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_dead_letter_items_integration_id_idx" ON "vis_dead_letter_items"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vis_events_event_id_key" ON "vis_events"("event_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_events_integration_id_status_idx" ON "vis_events"("integration_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_events_entity_id_idx" ON "vis_events"("entity_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_event_endpoints_integration_id_idx" ON "vis_event_endpoints"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_event_subscriptions_integration_id_idx" ON "vis_event_subscriptions"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_event_dead_letters_integration_id_idx" ON "vis_event_dead_letters"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vis_event_checkpoints_integration_id_key" ON "vis_event_checkpoints"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_codegen_artifacts_integration_id_idx" ON "vis_codegen_artifacts"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_promotions_integration_id_idx" ON "vis_promotions"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_change_history_integration_id_created_at_idx" ON "vis_change_history"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_approvals_integration_id_version_id_idx" ON "vis_approvals"("integration_id", "version_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_metric_samples_name_recorded_at_idx" ON "vis_metric_samples"("name", "recorded_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_trace_spans_trace_id_idx" ON "vis_trace_spans"("trace_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_trace_spans_span_id_idx" ON "vis_trace_spans"("span_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_alerts_status_created_at_idx" ON "vis_alerts"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_reconciliation_reports_integration_id_idx" ON "vis_reconciliation_reports"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_repair_reports_integration_id_idx" ON "vis_repair_reports"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_drift_findings_connection_id_idx" ON "vis_drift_findings"("connection_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_connectors_lifecycle_visibility_idx" ON "vis_connectors"("lifecycle", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vis_connectors_name_vendor_version_key" ON "vis_connectors"("name", "vendor", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_connector_installs_organization_id_idx" ON "vis_connector_installs"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_ai_recommendations_affected_integration_id_status_idx" ON "vis_ai_recommendations"("affected_integration_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_generated_test_suites_integration_id_idx" ON "vis_generated_test_suites"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_generated_docs_integration_id_idx" ON "vis_generated_docs"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_healing_actions_integration_id_created_at_idx" ON "vis_healing_actions"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_healing_actions_action_type_status_idx" ON "vis_healing_actions"("action_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vis_secret_blobs_ref_id_key" ON "vis_secret_blobs"("ref_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vis_policy_rules_rule_key_key" ON "vis_policy_rules"("rule_key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vis_documents_collection_idx" ON "vis_documents"("collection");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vis_connections" ADD CONSTRAINT "vis_connections_credential_ref_id_fkey" FOREIGN KEY ("credential_ref_id") REFERENCES "vis_credential_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vis_integration_versions" ADD CONSTRAINT "vis_integration_versions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "vis_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vis_executions" ADD CONSTRAINT "vis_executions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "vis_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vis_execution_logs" ADD CONSTRAINT "vis_execution_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "vis_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vis_audit_logs" ADD CONSTRAINT "vis_audit_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "vis_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- Row level security: anon and authenticated have no policies (deny).
-- The backend uses the service role, which bypasses RLS.
DO $$
DECLARE
  t text;
  vis_tables text[] := ARRAY[
    'vis_user_refs',
    'vis_credential_references',
    'vis_connections',
    'vis_integrations',
    'vis_integration_versions',
    'vis_schema_cache',
    'vis_executions',
    'vis_execution_logs',
    'vis_audit_logs',
    'vis_dead_letter_items',
    'vis_events',
    'vis_event_endpoints',
    'vis_event_subscriptions',
    'vis_event_dead_letters',
    'vis_event_checkpoints',
    'vis_codegen_artifacts',
    'vis_promotions',
    'vis_change_history',
    'vis_approvals',
    'vis_metric_samples',
    'vis_trace_spans',
    'vis_alerts',
    'vis_reconciliation_reports',
    'vis_repair_reports',
    'vis_drift_findings',
    'vis_impact_analyses',
    'vis_connectors',
    'vis_connector_installs',
    'vis_connector_upgrades',
    'vis_ai_recommendations',
    'vis_generated_test_suites',
    'vis_generated_docs',
    'vis_healing_actions',
    'vis_secret_blobs',
    'vis_policy_rules',
    'vis_documents'
  ];
  role_name text;
BEGIN
  FOREACH t IN ARRAY vis_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', t, role_name);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT ALL ON TABLE %I TO service_role', t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.vis_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vis_credential_references',
    'vis_connections',
    'vis_integrations',
    'vis_event_checkpoints',
    'vis_connectors',
    'vis_connector_installs',
    'vis_ai_recommendations',
    'vis_secret_blobs',
    'vis_policy_rules',
    'vis_documents'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS vis_set_updated_at ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER vis_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.vis_set_updated_at()',
      t
    );
  END LOOP;
END $$;

-- One transaction for multi-row VIS writes. Only whitelisted tables are accepted.
CREATE OR REPLACE FUNCTION public.vis_apply_transaction(ops jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  action text;
  tbl text;
  row_data jsonb;
  row_id text;
  doc_collection text;
  cols text[];
  insert_cols text;
  insert_vals text;
  update_sets text;
  allowed text[] := ARRAY[
    'vis_user_refs',
    'vis_credential_references',
    'vis_connections',
    'vis_integrations',
    'vis_integration_versions',
    'vis_schema_cache',
    'vis_executions',
    'vis_execution_logs',
    'vis_audit_logs',
    'vis_dead_letter_items',
    'vis_events',
    'vis_event_endpoints',
    'vis_event_subscriptions',
    'vis_event_dead_letters',
    'vis_event_checkpoints',
    'vis_codegen_artifacts',
    'vis_promotions',
    'vis_change_history',
    'vis_approvals',
    'vis_metric_samples',
    'vis_trace_spans',
    'vis_alerts',
    'vis_reconciliation_reports',
    'vis_repair_reports',
    'vis_drift_findings',
    'vis_impact_analyses',
    'vis_connectors',
    'vis_connector_installs',
    'vis_connector_upgrades',
    'vis_ai_recommendations',
    'vis_generated_test_suites',
    'vis_generated_docs',
    'vis_healing_actions',
    'vis_secret_blobs',
    'vis_policy_rules',
    'vis_documents'
  ];
BEGIN
  IF ops IS NULL OR jsonb_typeof(ops) <> 'array' THEN
    RAISE EXCEPTION 'vis_apply_transaction ops must be a json array';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(ops) LOOP
    action := item->>'op';
    tbl := item->>'table';
    row_data := COALESCE(item->'row', '{}'::jsonb);
    row_id := COALESCE(item->>'id', row_data->>'id');
    doc_collection := item->>'collection';

    IF tbl IS NULL OR NOT (tbl = ANY (allowed)) THEN
      RAISE EXCEPTION 'vis_apply_transaction rejected table %', tbl;
    END IF;

    IF action = 'delete' THEN
      IF tbl = 'vis_documents' THEN
        UPDATE public.vis_documents
           SET deleted_at = now(), updated_at = now()
         WHERE id = row_id
           AND (doc_collection IS NULL OR collection = doc_collection);
      ELSE
        EXECUTE format('DELETE FROM public.%I WHERE id = $1', tbl) USING row_id;
      END IF;
    ELSIF action = 'upsert' THEN
      SELECT array_agg(c.column_name ORDER BY c.ordinal_position)
        INTO cols
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name = tbl
         AND c.column_name IN (SELECT jsonb_object_keys(row_data));

      IF cols IS NULL OR array_length(cols, 1) IS NULL THEN
        RAISE EXCEPTION 'vis_apply_transaction empty row for %', tbl;
      END IF;

      SELECT string_agg(quote_ident(x), ', '),
             string_agg(format('r.%I', x), ', ')
        INTO insert_cols, insert_vals
        FROM unnest(cols) AS x;

      SELECT string_agg(format('%I = EXCLUDED.%I', x, x), ', ')
        INTO update_sets
        FROM unnest(cols) AS x
       WHERE x <> 'id';

      IF update_sets IS NULL THEN
        EXECUTE format(
          'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1) AS r ON CONFLICT (id) DO NOTHING',
          tbl, insert_cols, insert_vals, tbl
        ) USING row_data;
      ELSE
        EXECUTE format(
          'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1) AS r ON CONFLICT (id) DO UPDATE SET %s',
          tbl, insert_cols, insert_vals, tbl, update_sets
        ) USING row_data;
      END IF;
    ELSE
      RAISE EXCEPTION 'vis_apply_transaction unsupported op %', action;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(ops));
END;
$$;

REVOKE ALL ON FUNCTION public.vis_apply_transaction(jsonb) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.vis_apply_transaction(jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.vis_apply_transaction(jsonb) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.vis_apply_transaction(jsonb) TO service_role;
  END IF;
END $$;
