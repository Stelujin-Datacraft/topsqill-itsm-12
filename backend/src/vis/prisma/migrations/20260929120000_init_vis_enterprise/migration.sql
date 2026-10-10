-- SUPERSEDED. VIS runtime persistence is Supabase.
-- Apply supabase/migrations/20261010120000_vis_supabase_persistence.sql instead.
-- This Prisma migration is history and is not executed by the backend.

-- CreateTable
CREATE TABLE "vis_user_refs" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "tenant_id" TEXT,
    "organization_id" TEXT,
    "roles" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vis_user_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_credential_references" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "secret_handle" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vis_credential_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_connections" (
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vis_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_integrations" (
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vis_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_integration_versions" (
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_integration_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_schema_cache" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "application_key" TEXT,
    "form_id" TEXT NOT NULL,
    "form_name" TEXT,
    "fields" JSONB NOT NULL,
    "api_version" TEXT,
    "schema_version" TEXT,
    "schema_hash" TEXT,
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_schema_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_executions" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_execution_logs" (
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
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "integration_id" TEXT,
    "version_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_dead_letter_items" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "execution_id" TEXT,
    "source_record" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_dead_letter_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "status" TEXT NOT NULL,
    "event_type" TEXT,
    "entity_id" TEXT,
    "payload" JSONB,
    "correlation_id" TEXT,
    "trace_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "vis_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_event_endpoints" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "secret_ref" TEXT,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_event_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_event_subscriptions" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_event_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_event_dead_letters" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT,
    "event_id" TEXT,
    "payload" JSONB,
    "error" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_event_dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_event_checkpoints" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "cursor" TEXT,
    "metadata" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vis_event_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_codegen_artifacts" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "language" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "validation" JSONB,
    "security_scan" JSONB,
    "dependency_scan" JSONB,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_codegen_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_promotions" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "from_environment" TEXT NOT NULL,
    "to_environment" TEXT NOT NULL,
    "version_id" TEXT,
    "version_number" INTEGER,
    "env_config" JSONB,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_change_history" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_approvals" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "actorId" TEXT,
    "decision" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_metric_samples" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB,
    "value" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_metric_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_trace_spans" (
    "id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "span_id" TEXT NOT NULL,
    "parent_span_id" TEXT,
    "name" TEXT NOT NULL,
    "correlation_id" TEXT,
    "execution_id" TEXT,
    "event_id" TEXT,
    "attributes" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "vis_trace_spans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_alerts" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_reconciliation_reports" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "mode" TEXT NOT NULL,
    "diff_count" INTEGER NOT NULL,
    "diffs" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_reconciliation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_repair_reports" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version_id" TEXT,
    "actor_id" TEXT,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_repair_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_drift_findings" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT,
    "form_id" TEXT,
    "findings" JSONB NOT NULL,
    "max_severity" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_drift_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_impact_analyses" (
    "id" TEXT NOT NULL,
    "finding_count" INTEGER NOT NULL,
    "affected_count" INTEGER NOT NULL,
    "affected" JSONB NOT NULL,
    "ai_proposals" JSONB,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_connectors" (
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
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vis_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_connector_installs" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENABLED',
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vis_connector_installs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_connector_upgrades" (
    "id" TEXT NOT NULL,
    "install_id" TEXT NOT NULL,
    "from_connector_id" TEXT NOT NULL,
    "to_connector_id" TEXT NOT NULL,
    "from_version" TEXT NOT NULL,
    "to_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),

    CONSTRAINT "vis_connector_upgrades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_ai_recommendations" (
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vis_ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_generated_test_suites" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "tests" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_generated_test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_generated_docs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "structured" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_generated_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_healing_actions" (
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vis_healing_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_secret_blobs" (
    "id" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local-encrypted',
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vis_secret_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_policy_rules" (
    "id" TEXT NOT NULL,
    "rule_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vis_policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vis_documents" (
    "id" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vis_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vis_user_refs_tenant_id_organization_id_idx" ON "vis_user_refs"("tenant_id", "organization_id");

-- CreateIndex
CREATE INDEX "vis_credential_references_organization_id_idx" ON "vis_credential_references"("organization_id");

-- CreateIndex
CREATE INDEX "vis_connections_organization_id_idx" ON "vis_connections"("organization_id");

-- CreateIndex
CREATE INDEX "vis_integrations_organization_id_status_idx" ON "vis_integrations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "vis_integrations_tenant_id_idx" ON "vis_integrations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "vis_integration_versions_integration_id_version_key" ON "vis_integration_versions"("integration_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "vis_schema_cache_connection_id_form_id_key" ON "vis_schema_cache"("connection_id", "form_id");

-- CreateIndex
CREATE INDEX "vis_executions_integration_id_status_idx" ON "vis_executions"("integration_id", "status");

-- CreateIndex
CREATE INDEX "vis_executions_correlation_id_idx" ON "vis_executions"("correlation_id");

-- CreateIndex
CREATE INDEX "vis_execution_logs_execution_id_idx" ON "vis_execution_logs"("execution_id");

-- CreateIndex
CREATE INDEX "vis_execution_logs_correlation_id_idx" ON "vis_execution_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "vis_audit_logs_integration_id_idx" ON "vis_audit_logs"("integration_id");

-- CreateIndex
CREATE INDEX "vis_audit_logs_action_created_at_idx" ON "vis_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "vis_dead_letter_items_integration_id_idx" ON "vis_dead_letter_items"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "vis_events_event_id_key" ON "vis_events"("event_id");

-- CreateIndex
CREATE INDEX "vis_events_integration_id_status_idx" ON "vis_events"("integration_id", "status");

-- CreateIndex
CREATE INDEX "vis_events_entity_id_idx" ON "vis_events"("entity_id");

-- CreateIndex
CREATE INDEX "vis_event_endpoints_integration_id_idx" ON "vis_event_endpoints"("integration_id");

-- CreateIndex
CREATE INDEX "vis_event_subscriptions_integration_id_idx" ON "vis_event_subscriptions"("integration_id");

-- CreateIndex
CREATE INDEX "vis_event_dead_letters_integration_id_idx" ON "vis_event_dead_letters"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "vis_event_checkpoints_integration_id_key" ON "vis_event_checkpoints"("integration_id");

-- CreateIndex
CREATE INDEX "vis_codegen_artifacts_integration_id_idx" ON "vis_codegen_artifacts"("integration_id");

-- CreateIndex
CREATE INDEX "vis_promotions_integration_id_idx" ON "vis_promotions"("integration_id");

-- CreateIndex
CREATE INDEX "vis_change_history_integration_id_created_at_idx" ON "vis_change_history"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "vis_approvals_integration_id_version_id_idx" ON "vis_approvals"("integration_id", "version_id");

-- CreateIndex
CREATE INDEX "vis_metric_samples_name_recorded_at_idx" ON "vis_metric_samples"("name", "recorded_at");

-- CreateIndex
CREATE INDEX "vis_trace_spans_trace_id_idx" ON "vis_trace_spans"("trace_id");

-- CreateIndex
CREATE INDEX "vis_trace_spans_span_id_idx" ON "vis_trace_spans"("span_id");

-- CreateIndex
CREATE INDEX "vis_alerts_status_created_at_idx" ON "vis_alerts"("status", "created_at");

-- CreateIndex
CREATE INDEX "vis_reconciliation_reports_integration_id_idx" ON "vis_reconciliation_reports"("integration_id");

-- CreateIndex
CREATE INDEX "vis_repair_reports_integration_id_idx" ON "vis_repair_reports"("integration_id");

-- CreateIndex
CREATE INDEX "vis_drift_findings_connection_id_idx" ON "vis_drift_findings"("connection_id");

-- CreateIndex
CREATE INDEX "vis_connectors_lifecycle_visibility_idx" ON "vis_connectors"("lifecycle", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "vis_connectors_name_vendor_version_key" ON "vis_connectors"("name", "vendor", "version");

-- CreateIndex
CREATE INDEX "vis_connector_installs_organization_id_idx" ON "vis_connector_installs"("organization_id");

-- CreateIndex
CREATE INDEX "vis_ai_recommendations_affected_integration_id_status_idx" ON "vis_ai_recommendations"("affected_integration_id", "status");

-- CreateIndex
CREATE INDEX "vis_generated_test_suites_integration_id_idx" ON "vis_generated_test_suites"("integration_id");

-- CreateIndex
CREATE INDEX "vis_generated_docs_integration_id_idx" ON "vis_generated_docs"("integration_id");

-- CreateIndex
CREATE INDEX "vis_healing_actions_integration_id_created_at_idx" ON "vis_healing_actions"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "vis_healing_actions_action_type_status_idx" ON "vis_healing_actions"("action_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vis_secret_blobs_ref_id_key" ON "vis_secret_blobs"("ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "vis_policy_rules_rule_key_key" ON "vis_policy_rules"("rule_key");

-- CreateIndex
CREATE INDEX "vis_documents_collection_idx" ON "vis_documents"("collection");

-- AddForeignKey
ALTER TABLE "vis_connections" ADD CONSTRAINT "vis_connections_credential_ref_id_fkey" FOREIGN KEY ("credential_ref_id") REFERENCES "vis_credential_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vis_integration_versions" ADD CONSTRAINT "vis_integration_versions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "vis_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vis_executions" ADD CONSTRAINT "vis_executions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "vis_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vis_execution_logs" ADD CONSTRAINT "vis_execution_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "vis_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vis_audit_logs" ADD CONSTRAINT "vis_audit_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "vis_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

