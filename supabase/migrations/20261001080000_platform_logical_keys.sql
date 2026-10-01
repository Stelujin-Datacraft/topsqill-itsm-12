-- ============================================================
-- Platform promotion readiness: stable logical keys (DEV-only phase)
--
-- CURRENT ENVIRONMENT: DEV ONLY
-- FUTURE: DEV → QA → PROD (QA/PROD NOT provisioned here)
--
-- Strategy:
-- - Add nullable logical_key columns (non-breaking)
-- - Partial unique indexes per tenant/project scope
-- - Existing forms/workflows/reports/dashboards continue to use reference_id
--   as their logical identity until backfilled into logical_key where useful
-- - Do NOT copy DEV DB to future environments; use migrations + packages
-- ============================================================

-- Organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_logical_key
  ON public.organizations (logical_key)
  WHERE logical_key IS NOT NULL;

-- Projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_org_logical_key
  ON public.projects (organization_id, logical_key)
  WHERE logical_key IS NOT NULL;

-- Forms: keep reference_id; add logical_key for explicit promotion identity
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_project_logical_key
  ON public.forms (project_id, logical_key)
  WHERE logical_key IS NOT NULL;

-- Soft backfill logical_key from reference_id where missing
UPDATE public.forms
SET logical_key = lower(trim(reference_id))
WHERE logical_key IS NULL
  AND reference_id IS NOT NULL
  AND length(trim(reference_id)) > 0;

-- Form fields
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_fields_form_logical_key
  ON public.form_fields (form_id, logical_key)
  WHERE logical_key IS NOT NULL AND form_id IS NOT NULL;

-- Workflows
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_project_logical_key
  ON public.workflows (project_id, logical_key)
  WHERE logical_key IS NOT NULL;

UPDATE public.workflows
SET logical_key = lower(trim(reference_id))
WHERE logical_key IS NULL
  AND reference_id IS NOT NULL
  AND length(trim(reference_id)) > 0;

-- Roles
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_org_logical_key
  ON public.roles (organization_id, logical_key)
  WHERE logical_key IS NOT NULL;

-- Groups (definition promotable; membership remains env-specific)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_org_logical_key
  ON public.groups (organization_id, logical_key)
  WHERE logical_key IS NOT NULL;

-- Reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_project_logical_key
  ON public.reports (project_id, logical_key)
  WHERE logical_key IS NOT NULL;

UPDATE public.reports
SET logical_key = lower(trim(reference_id))
WHERE logical_key IS NULL
  AND reference_id IS NOT NULL
  AND length(trim(reference_id)) > 0;

-- Dashboards
ALTER TABLE public.dashboards
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboards_project_logical_key
  ON public.dashboards (project_id, logical_key)
  WHERE logical_key IS NOT NULL;

UPDATE public.dashboards
SET logical_key = lower(trim(reference_id))
WHERE logical_key IS NULL
  AND reference_id IS NOT NULL
  AND length(trim(reference_id)) > 0;

-- Outbound connectors / integrations: logical key + credential reference slot
ALTER TABLE public.outbound_connectors
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

ALTER TABLE public.outbound_connectors
  ADD COLUMN IF NOT EXISTS credential_reference_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_connectors_org_logical_key
  ON public.outbound_connectors (organization_id, logical_key)
  WHERE logical_key IS NOT NULL;

COMMENT ON COLUMN public.organizations.logical_key IS
  'Stable logical key for future env promotion (DEV→QA→PROD). Nullable; unique when set.';
COMMENT ON COLUMN public.projects.logical_key IS
  'Stable project logical key (e.g. grc). Unique per organization when set.';
COMMENT ON COLUMN public.forms.logical_key IS
  'Stable form logical key (e.g. grc.risk). Prefer over UUID in workflows/reports.';
COMMENT ON COLUMN public.form_fields.logical_key IS
  'Stable field logical key (e.g. grc.risk.owner). Required for cross-env promotion.';
COMMENT ON COLUMN public.outbound_connectors.credential_reference_id IS
  'Environment-specific secret slot. Never promote credential values—only this reference id.';
