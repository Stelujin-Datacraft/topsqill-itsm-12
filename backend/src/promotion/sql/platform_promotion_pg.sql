-- Minimal platform schema for promotion persistence tests (local PostgreSQL).
-- Mirrors production tables needed for export/import with logical keys.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'promotion.local',
  admin_email TEXT NOT NULL DEFAULT 'admin@promotion.local',
  status TEXT NOT NULL DEFAULT 'active',
  logical_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_logical_key ON organizations (logical_key) WHERE logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active',
  logical_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_org_logical_key ON projects (organization_id, logical_key) WHERE logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft',
  reference_id TEXT,
  logical_key TEXT,
  pages JSONB,
  layout JSONB,
  form_rules JSONB,
  field_rules JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_project_logical_key ON forms (project_id, logical_key) WHERE logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required BOOLEAN DEFAULT false,
  options JSONB,
  validation JSONB,
  custom_config JSONB,
  field_order INT,
  logical_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_fields_form_logical_key ON form_fields (form_id, logical_key) WHERE logical_key IS NOT NULL AND form_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft',
  reference_id TEXT,
  logical_key TEXT,
  definition JSONB DEFAULT '{}'::jsonb,
  enrollment_mode TEXT NOT NULL DEFAULT 'once',
  notify_on_failure BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_project_logical_key ON workflows (project_id, logical_key) WHERE logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT gen_random_uuid(),
  top_level_access TEXT NOT NULL DEFAULT 'no_access',
  logical_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_org_logical_key ON roles (organization_id, logical_key) WHERE logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  resource_logical_key TEXT,
  permission_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_perm_logical ON role_permissions (resource_type, resource_logical_key) WHERE resource_logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT gen_random_uuid(),
  reference_id TEXT,
  logical_key TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  form_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_project_logical_key ON reports (project_id, logical_key) WHERE logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT gen_random_uuid(),
  reference_id TEXT,
  logical_key TEXT,
  layout JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboards_project_logical_key ON dashboards (project_id, logical_key) WHERE logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS data_source_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL DEFAULT 'http',
  http_url TEXT,
  http_auth_type TEXT,
  http_auth_config JSONB DEFAULT '{}'::jsonb,
  http_headers JSONB DEFAULT '{}'::jsonb,
  logical_key TEXT,
  credential_reference_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dsc_org_logical_key ON data_source_connections (organization_id, logical_key) WHERE logical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_secret_blobs (
  ref_id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local-encrypted',
  organization_id UUID,
  purpose TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS promotion_import_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_key TEXT NOT NULL,
  package_version TEXT NOT NULL,
  source_environment TEXT NOT NULL DEFAULT 'DEV',
  target_environment TEXT NOT NULL DEFAULT 'DEV',
  target_organization_id UUID,
  target_project_id UUID,
  target_namespace TEXT,
  initiated_by TEXT NOT NULL,
  approved_by TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  result TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promotion_key_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  component_kind TEXT NOT NULL,
  logical_key TEXT NOT NULL,
  resource_id UUID NOT NULL,
  fingerprint TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, component_kind, logical_key)
);
