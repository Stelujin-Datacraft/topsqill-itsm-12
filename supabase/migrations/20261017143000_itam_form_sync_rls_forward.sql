-- FORWARD-ONLY ITAM repair for Dev/Prod that already applied main's
-- 2026093012*/13*/14* timestamps. Do NOT edit those shipped files to re-run.
-- REVIEWABLE ONLY — do not auto-apply from CI/agents. Manual Dev apply first.
-- Requires helpers: public.get_current_user_org_id(), public.is_org_admin_of(uuid)
--   (20260930110000_get_current_user_org_id.sql or earlier equivalents).
-- Idempotent: DROP POLICY IF EXISTS + CREATE; ENABLE RLS; REVOKE/GRANT.
-- Does not mutate row data. Does not weaken controls (replaces loose FOR ALL
-- with admin-gated writes; enables RLS where previously absent on B–D / sync).
-- Source policy text mirrored from 20260930140000 (forward apply for already-migrated DBs).
-- Target: form-sync tables. itam_sync_schema_cache remains service_role-only.
-- Append-only preserved: itam_sync_history, itam_sync_provenance.

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

