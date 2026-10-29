-- Remove only the Regulatory Compliance module created by reference_id.
-- Forms: grc.regulatory.standard, grc.regulatory.clause, grc.regulatory.requirement
-- Workflows: grc.regulatory.workflow.standard-review, source-review, requirement-review
-- Dashboard: grc.regulatory.dashboard
-- Reports: grc.regulatory.report.*
-- Policy Register rows and the existing compliance catalog are not deleted.
-- A policy or performance project that pointed at one of these records is unlinked.

BEGIN;

CREATE TEMP TABLE regulatory_form_ids ON COMMIT DROP AS
SELECT id
FROM public.forms
WHERE reference_id IN (
  'grc.regulatory.standard',
  'grc.regulatory.clause',
  'grc.regulatory.requirement'
);

CREATE TEMP TABLE regulatory_workflow_ids ON COMMIT DROP AS
SELECT id
FROM public.workflows
WHERE reference_id IN (
  'grc.regulatory.workflow.standard-review',
  'grc.regulatory.workflow.source-review',
  'grc.regulatory.workflow.requirement-review'
);

CREATE TEMP TABLE regulatory_dashboard_ids ON COMMIT DROP AS
SELECT id
FROM public.dashboards
WHERE reference_id = 'grc.regulatory.dashboard';

CREATE TEMP TABLE regulatory_report_ids ON COMMIT DROP AS
SELECT id
FROM public.reports
WHERE reference_id IN (
  'grc.regulatory.report.standards',
  'grc.regulatory.report.standards-awaiting-verification',
  'grc.regulatory.report.clauses',
  'grc.regulatory.report.clauses-awaiting-verification',
  'grc.regulatory.report.requirements',
  'grc.regulatory.report.ai-suggested-requirements',
  'grc.regulatory.report.requirements-awaiting-review',
  'grc.regulatory.report.applicability-open'
);

CREATE TEMP TABLE regulatory_submission_ids ON COMMIT DROP AS
SELECT id
FROM public.form_submissions
WHERE form_id IN (SELECT id FROM regulatory_form_ids);

CREATE TEMP TABLE regulatory_field_ids ON COMMIT DROP AS
SELECT id
FROM public.form_fields
WHERE form_id IN (SELECT id FROM regulatory_form_ids);

CREATE TEMP TABLE regulatory_feed_ids ON COMMIT DROP AS
SELECT id
FROM public.data_feeds
WHERE target_form_id IN (SELECT id FROM regulatory_form_ids)
   OR source_form_id IN (SELECT id FROM regulatory_form_ids)
   OR cross_reference_field_id IN (SELECT id FROM regulatory_field_ids);

DO $$
DECLARE
  policy_count bigint;
  framework_count bigint;
  control_count bigint;
  kept_forms bigint;
  kept_workflows bigint;
  kept_dashboards bigint;
  kept_reports bigint;
BEGIN
  SELECT count(*) INTO policy_count FROM public.policies;
  SELECT count(*) INTO kept_forms
  FROM public.forms
  WHERE reference_id IS NULL
     OR reference_id NOT IN (
       'grc.regulatory.standard',
       'grc.regulatory.clause',
       'grc.regulatory.requirement'
     );
  SELECT count(*) INTO kept_workflows
  FROM public.workflows
  WHERE reference_id IS NULL
     OR reference_id NOT IN (
       'grc.regulatory.workflow.standard-review',
       'grc.regulatory.workflow.source-review',
       'grc.regulatory.workflow.requirement-review'
     );
  SELECT count(*) INTO kept_dashboards
  FROM public.dashboards
  WHERE reference_id IS NULL
     OR reference_id <> 'grc.regulatory.dashboard';
  SELECT count(*) INTO kept_reports
  FROM public.reports
  WHERE reference_id IS NULL
     OR reference_id NOT IN (
       'grc.regulatory.report.standards',
       'grc.regulatory.report.standards-awaiting-verification',
       'grc.regulatory.report.clauses',
       'grc.regulatory.report.clauses-awaiting-verification',
       'grc.regulatory.report.requirements',
       'grc.regulatory.report.ai-suggested-requirements',
       'grc.regulatory.report.requirements-awaiting-review',
       'grc.regulatory.report.applicability-open'
     );

  IF to_regclass('public.compliance_frameworks') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.compliance_frameworks' INTO framework_count;
  END IF;
  IF to_regclass('public.compliance_controls') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.compliance_controls' INTO control_count;
  END IF;

  UPDATE public.policies
  SET form_id = NULL
  WHERE form_id IN (SELECT id FROM regulatory_form_ids);
  UPDATE public.policies
  SET workflow_id = NULL
  WHERE workflow_id IN (SELECT id FROM regulatory_workflow_ids);

  IF to_regclass('public.performance_projects') IS NOT NULL THEN
    UPDATE public.performance_projects
    SET form_id = NULL
    WHERE form_id IN (SELECT id FROM regulatory_form_ids);
  END IF;
  IF to_regclass('public.record_delegations') IS NOT NULL THEN
    UPDATE public.record_delegations
    SET scope_form_id = NULL
    WHERE scope_form_id IN (SELECT id FROM regulatory_form_ids);
    UPDATE public.record_delegations
    SET scope_submission_id = NULL
    WHERE scope_submission_id IN (SELECT id FROM regulatory_submission_ids);
  END IF;

  IF to_regclass('public.data_feed_runs') IS NOT NULL THEN
    DELETE FROM public.data_feed_runs
    WHERE data_feed_id IN (SELECT id FROM regulatory_feed_ids);
  END IF;
  DELETE FROM public.data_feeds
  WHERE id IN (SELECT id FROM regulatory_feed_ids);

  IF to_regclass('public.workflow_queue') IS NOT NULL THEN
    DELETE FROM public.workflow_queue
    WHERE workflow_id IN (SELECT id FROM regulatory_workflow_ids)
       OR submission_id IN (SELECT id FROM regulatory_submission_ids);
  END IF;
  IF to_regclass('public.workflow_executions') IS NOT NULL THEN
    DELETE FROM public.workflow_executions
    WHERE workflow_id IN (SELECT id FROM regulatory_workflow_ids)
       OR trigger_form_id IN (SELECT id FROM regulatory_form_ids)
       OR trigger_submission_id IN (SELECT id FROM regulatory_submission_ids)
       OR form_submission_id IN (SELECT id FROM regulatory_submission_ids);
  END IF;
  DELETE FROM public.workflow_connections
  WHERE workflow_id IN (SELECT id FROM regulatory_workflow_ids);
  DELETE FROM public.workflow_nodes
  WHERE workflow_id IN (SELECT id FROM regulatory_workflow_ids);
  DELETE FROM public.workflow_triggers
  WHERE target_workflow_id IN (SELECT id FROM regulatory_workflow_ids)
     OR source_form_id IN (SELECT id FROM regulatory_form_ids);

  IF to_regclass('public.sla_instances') IS NOT NULL THEN
    DELETE FROM public.sla_instances
    WHERE form_id IN (SELECT id FROM regulatory_form_ids)
       OR submission_id IN (SELECT id FROM regulatory_submission_ids);
  END IF;
  IF to_regclass('public.form_field_sla_config') IS NOT NULL THEN
    DELETE FROM public.form_field_sla_config
    WHERE form_id IN (SELECT id FROM regulatory_form_ids);
  END IF;
  IF to_regclass('public.lifecycle_stage_history') IS NOT NULL THEN
    DELETE FROM public.lifecycle_stage_history
    WHERE submission_id IN (SELECT id FROM regulatory_submission_ids);
  END IF;
  IF to_regclass('public.record_field_history') IS NOT NULL THEN
    DELETE FROM public.record_field_history
    WHERE submission_id IN (SELECT id FROM regulatory_submission_ids)
       OR field_id IN (SELECT id FROM regulatory_field_ids);
  END IF;
  IF to_regclass('public.document_history') IS NOT NULL THEN
    DELETE FROM public.document_history
    WHERE form_id IN (SELECT id FROM regulatory_form_ids);
  END IF;
  IF to_regclass('public.performance_data_sources') IS NOT NULL THEN
    DELETE FROM public.performance_data_sources
    WHERE source_form_id IN (SELECT id FROM regulatory_form_ids);
  END IF;

  DELETE FROM public.form_audit_logs
  WHERE form_id IN (SELECT id FROM regulatory_form_ids);
  IF to_regclass('public.form_user_access') IS NOT NULL THEN
    DELETE FROM public.form_user_access
    WHERE form_id IN (SELECT id FROM regulatory_form_ids);
  END IF;
  IF to_regclass('public.form_access_requests') IS NOT NULL THEN
    DELETE FROM public.form_access_requests
    WHERE form_id IN (SELECT id FROM regulatory_form_ids);
  END IF;
  IF to_regclass('public.form_assignments') IS NOT NULL THEN
    DELETE FROM public.form_assignments
    WHERE form_id IN (SELECT id FROM regulatory_form_ids);
  END IF;
  DELETE FROM public.form_submissions
  WHERE id IN (SELECT id FROM regulatory_submission_ids);
  DELETE FROM public.form_fields
  WHERE form_id IN (SELECT id FROM regulatory_form_ids);

  IF to_regclass('public.report_components') IS NOT NULL THEN
    DELETE FROM public.report_components
    WHERE report_id IN (SELECT id FROM regulatory_report_ids);
  END IF;
  IF to_regclass('public.report_media') IS NOT NULL THEN
    DELETE FROM public.report_media
    WHERE report_id IN (SELECT id FROM regulatory_report_ids);
  END IF;
  DELETE FROM public.reports
  WHERE id IN (SELECT id FROM regulatory_report_ids);
  IF to_regclass('public.default_dashboard_users') IS NOT NULL THEN
    DELETE FROM public.default_dashboard_users
    WHERE dashboard_id IN (SELECT id FROM regulatory_dashboard_ids);
  END IF;
  DELETE FROM public.dashboards
  WHERE id IN (SELECT id FROM regulatory_dashboard_ids);

  DELETE FROM public.workflows
  WHERE id IN (SELECT id FROM regulatory_workflow_ids);
  DELETE FROM public.forms
  WHERE id IN (SELECT id FROM regulatory_form_ids);

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DELETE FROM public.audit_logs
    WHERE event_category = 'regulatory'
      AND event_type IN (
        'regulatory_provision',
        'regulatory_import',
        'regulatory_source_verification',
        'regulatory_requirement_approval'
      );
  END IF;

  IF (SELECT count(*) FROM public.policies) <> policy_count THEN
    RAISE EXCEPTION 'Regulatory cleanup changed the Policy Register row count';
  END IF;
  IF framework_count IS NOT NULL AND (SELECT count(*) FROM public.compliance_frameworks) <> framework_count THEN
    RAISE EXCEPTION 'Regulatory cleanup changed compliance_frameworks';
  END IF;
  IF control_count IS NOT NULL AND (SELECT count(*) FROM public.compliance_controls) <> control_count THEN
    RAISE EXCEPTION 'Regulatory cleanup changed compliance_controls';
  END IF;
  IF (SELECT count(*) FROM public.forms) <> kept_forms THEN
    RAISE EXCEPTION 'Regulatory cleanup removed a form outside the regulatory reference ids';
  END IF;
  IF (SELECT count(*) FROM public.workflows) <> kept_workflows THEN
    RAISE EXCEPTION 'Regulatory cleanup removed a workflow outside the regulatory reference ids';
  END IF;
  IF (SELECT count(*) FROM public.dashboards) <> kept_dashboards THEN
    RAISE EXCEPTION 'Regulatory cleanup removed a dashboard outside grc.regulatory.dashboard';
  END IF;
  IF (SELECT count(*) FROM public.reports) <> kept_reports THEN
    RAISE EXCEPTION 'Regulatory cleanup removed a report outside the regulatory reference ids';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.forms
    WHERE reference_id IN (
      'grc.regulatory.standard',
      'grc.regulatory.clause',
      'grc.regulatory.requirement'
    )
  ) THEN
    RAISE EXCEPTION 'Regulatory forms are still present';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workflows
    WHERE reference_id IN (
      'grc.regulatory.workflow.standard-review',
      'grc.regulatory.workflow.source-review',
      'grc.regulatory.workflow.requirement-review'
    )
  ) THEN
    RAISE EXCEPTION 'Regulatory workflows are still present';
  END IF;
END $$;

COMMIT;
