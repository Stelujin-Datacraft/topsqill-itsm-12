-- ITAM Form Sync metadata — NOT a duplicate asset SoR.
-- Authoritative ITAM records remain in the existing application Form API.
-- Requires 20260930110000 helpers for RLS (get_current_user_org_id / is_org_admin_of).


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

-- RLS for Form Sync metadata.
-- Tenant tables: SELECT org members; writes org admins (is_org_admin_of).
-- itam_sync_history / itam_sync_provenance: append-only for authenticated
--   (no UPDATE/DELETE policies).
-- itam_sync_schema_cache: no organization_id column (keyed by form_id only).
--   Application usage is Nest/service-side cache. Enabling RLS with NO
--   authenticated policies denies PostgREST access; service_role bypasses RLS.
--   Adding organization_id would be a separate schema change if org-scoped
--   PostgREST cache access is required later.

-- ── itam_sync_targets ──
ALTER TABLE public.itam_sync_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_sync_targets" ON public.itam_sync_targets;
DROP POLICY IF EXISTS "Admins manage org itam_sync_targets" ON public.itam_sync_targets;
DROP POLICY IF EXISTS "Admins insert org itam_sync_targets" ON public.itam_sync_targets;
DROP POLICY IF EXISTS "Admins update org itam_sync_targets" ON public.itam_sync_targets;
DROP POLICY IF EXISTS "Admins delete org itam_sync_targets" ON public.itam_sync_targets;
CREATE POLICY "Users view org itam_sync_targets" ON public.itam_sync_targets
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_sync_targets" ON public.itam_sync_targets
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_sync_targets" ON public.itam_sync_targets
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_sync_targets" ON public.itam_sync_targets
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_sync_mappings ──
ALTER TABLE public.itam_sync_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_sync_mappings" ON public.itam_sync_mappings;
DROP POLICY IF EXISTS "Admins manage org itam_sync_mappings" ON public.itam_sync_mappings;
DROP POLICY IF EXISTS "Admins insert org itam_sync_mappings" ON public.itam_sync_mappings;
DROP POLICY IF EXISTS "Admins update org itam_sync_mappings" ON public.itam_sync_mappings;
DROP POLICY IF EXISTS "Admins delete org itam_sync_mappings" ON public.itam_sync_mappings;
CREATE POLICY "Users view org itam_sync_mappings" ON public.itam_sync_mappings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_sync_mappings" ON public.itam_sync_mappings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_sync_mappings" ON public.itam_sync_mappings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_sync_mappings" ON public.itam_sync_mappings
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_sync_runs ──
ALTER TABLE public.itam_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_sync_runs" ON public.itam_sync_runs;
DROP POLICY IF EXISTS "Admins manage org itam_sync_runs" ON public.itam_sync_runs;
DROP POLICY IF EXISTS "Admins insert org itam_sync_runs" ON public.itam_sync_runs;
DROP POLICY IF EXISTS "Admins update org itam_sync_runs" ON public.itam_sync_runs;
DROP POLICY IF EXISTS "Admins delete org itam_sync_runs" ON public.itam_sync_runs;
CREATE POLICY "Users view org itam_sync_runs" ON public.itam_sync_runs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_sync_runs" ON public.itam_sync_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_sync_runs" ON public.itam_sync_runs
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_sync_runs" ON public.itam_sync_runs
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_sync_history ──
ALTER TABLE public.itam_sync_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_sync_history" ON public.itam_sync_history;
DROP POLICY IF EXISTS "Admins manage org itam_sync_history" ON public.itam_sync_history;
DROP POLICY IF EXISTS "Admins insert org itam_sync_history" ON public.itam_sync_history;
DROP POLICY IF EXISTS "Admins update org itam_sync_history" ON public.itam_sync_history;
DROP POLICY IF EXISTS "Admins delete org itam_sync_history" ON public.itam_sync_history;
CREATE POLICY "Users view org itam_sync_history" ON public.itam_sync_history
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_sync_history" ON public.itam_sync_history
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_sync_provenance ──
ALTER TABLE public.itam_sync_provenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_sync_provenance" ON public.itam_sync_provenance;
DROP POLICY IF EXISTS "Admins manage org itam_sync_provenance" ON public.itam_sync_provenance;
DROP POLICY IF EXISTS "Admins insert org itam_sync_provenance" ON public.itam_sync_provenance;
DROP POLICY IF EXISTS "Admins update org itam_sync_provenance" ON public.itam_sync_provenance;
DROP POLICY IF EXISTS "Admins delete org itam_sync_provenance" ON public.itam_sync_provenance;
CREATE POLICY "Users view org itam_sync_provenance" ON public.itam_sync_provenance
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_sync_provenance" ON public.itam_sync_provenance
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_sync_links ──
ALTER TABLE public.itam_sync_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_sync_links" ON public.itam_sync_links;
DROP POLICY IF EXISTS "Admins manage org itam_sync_links" ON public.itam_sync_links;
DROP POLICY IF EXISTS "Admins insert org itam_sync_links" ON public.itam_sync_links;
DROP POLICY IF EXISTS "Admins update org itam_sync_links" ON public.itam_sync_links;
DROP POLICY IF EXISTS "Admins delete org itam_sync_links" ON public.itam_sync_links;
CREATE POLICY "Users view org itam_sync_links" ON public.itam_sync_links
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_sync_links" ON public.itam_sync_links
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_sync_links" ON public.itam_sync_links
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_sync_links" ON public.itam_sync_links
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_sync_schema_cache (no organization_id — deny authenticated) ──
ALTER TABLE public.itam_sync_schema_cache ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies for authenticated/anon → deny by default under RLS.

REVOKE ALL ON TABLE
  public.itam_sync_targets,
  public.itam_sync_mappings,
  public.itam_sync_schema_cache,
  public.itam_sync_runs,
  public.itam_sync_history,
  public.itam_sync_provenance,
  public.itam_sync_links
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.itam_sync_targets,
  public.itam_sync_mappings,
  public.itam_sync_runs,
  public.itam_sync_history,
  public.itam_sync_provenance,
  public.itam_sync_links
TO authenticated;

-- schema_cache: service_role only (no authenticated GRANT)
REVOKE ALL ON TABLE public.itam_sync_schema_cache FROM authenticated;

GRANT ALL ON TABLE
  public.itam_sync_targets,
  public.itam_sync_mappings,
  public.itam_sync_schema_cache,
  public.itam_sync_runs,
  public.itam_sync_history,
  public.itam_sync_provenance,
  public.itam_sync_links
TO service_role;

