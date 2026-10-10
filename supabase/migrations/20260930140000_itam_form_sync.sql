-- ITAM Form Sync metadata — NOT a duplicate asset SoR.
-- Authoritative ITAM records remain in the existing application Form API.

CREATE TABLE IF NOT EXISTS public.itam_sync_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  credential_reference_id TEXT NOT NULL,
  forms_path TEXT NOT NULL DEFAULT '/api/forms',
  form_fields_path TEXT NOT NULL DEFAULT '/api/forms/{formId}/fields',
  records_path TEXT NOT NULL DEFAULT '/api/forms/{formId}/records',
  record_by_id_path TEXT NOT NULL DEFAULT '/api/forms/{formId}/records/{recordId}',
  search_path TEXT,
  target_form_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.itam_sync_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  target_form_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  mappings JSONB NOT NULL DEFAULT '[]',
  matching_source_fields JSONB NOT NULL DEFAULT '[]',
  matching_target_fields JSONB NOT NULL DEFAULT '[]',
  mapping_source TEXT NOT NULL DEFAULT 'DETERMINISTIC',
  confidence TEXT,
  reasoning TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.itam_sync_schema_cache (
  form_id TEXT PRIMARY KEY,
  form_name TEXT,
  version TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.itam_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  target_config_id UUID REFERENCES public.itam_sync_targets(id) ON DELETE SET NULL,
  mapping_id UUID,
  mapping_version INTEGER,
  schema_version TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  correlation_id TEXT,
  execution_id TEXT,
  totals JSONB DEFAULT '{}',
  items JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error TEXT
);

CREATE TABLE IF NOT EXISTS public.itam_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  target_form_id TEXT NOT NULL,
  target_record_id TEXT,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  changed_fields JSONB DEFAULT '[]',
  mapping_version INTEGER,
  schema_version TEXT,
  execution_id TEXT,
  error_category TEXT,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itam_sync_history_ext
  ON public.itam_sync_history(organization_id, external_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.itam_sync_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  target_record_id TEXT,
  target_field TEXT NOT NULL,
  value TEXT,
  source_provider TEXT,
  source_field TEXT,
  mapping_id UUID,
  mapping_version INTEGER,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.itam_sync_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  target_form_id TEXT NOT NULL,
  target_record_id TEXT NOT NULL,
  identity_keys JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_operation TEXT,
  UNIQUE(organization_id, target_form_id, external_id)
);
