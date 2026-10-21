-- FORWARD-ONLY ITAM repair for Dev/Prod that already applied main's
-- 2026093012*/13*/14* timestamps. Do NOT edit those shipped files to re-run.
-- REVIEWABLE ONLY — do not auto-apply from CI/agents. Manual Dev apply first.
-- Requires helpers: public.get_current_user_org_id(), public.is_org_admin_of(uuid)
--   (20260930110000_get_current_user_org_id.sql or earlier equivalents).
-- Idempotent: DROP POLICY IF EXISTS + CREATE; ENABLE RLS; REVOKE/GRANT.
-- Does not mutate row data. Does not weaken controls (replaces loose FOR ALL
-- with admin-gated writes; enables RLS where previously absent on B–D / sync).
-- Source policy text mirrored from 20260930120000 (forward apply for already-migrated DBs).
-- Target: Phase A discovery tables.

-- RLS (idempotent: DROP IF EXISTS then CREATE — safe re-apply / repair)
-- Admin writes require is_org_admin_of(organization_id) (user_profiles.role = 'admin').
ALTER TABLE public.itam_network_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_discovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_discovered_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_asset_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_software_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_software_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_discovery_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_discovery_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_asset_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itam_field_provenance ENABLE ROW LEVEL SECURITY;

-- ── itam_network_scopes ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view org network scopes" ON public.itam_network_scopes;
DROP POLICY IF EXISTS "Admins manage org network scopes" ON public.itam_network_scopes;
DROP POLICY IF EXISTS "Admins insert org network scopes" ON public.itam_network_scopes;
DROP POLICY IF EXISTS "Admins update org network scopes" ON public.itam_network_scopes;
DROP POLICY IF EXISTS "Admins delete org network scopes" ON public.itam_network_scopes;
CREATE POLICY "Users view org network scopes" ON public.itam_network_scopes
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org network scopes" ON public.itam_network_scopes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org network scopes" ON public.itam_network_scopes
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org network scopes" ON public.itam_network_scopes
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_discovery_jobs ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view org discovery jobs" ON public.itam_discovery_jobs;
DROP POLICY IF EXISTS "Admins manage org discovery jobs" ON public.itam_discovery_jobs;
DROP POLICY IF EXISTS "Admins insert org discovery jobs" ON public.itam_discovery_jobs;
DROP POLICY IF EXISTS "Admins update org discovery jobs" ON public.itam_discovery_jobs;
DROP POLICY IF EXISTS "Admins delete org discovery jobs" ON public.itam_discovery_jobs;
CREATE POLICY "Users view org discovery jobs" ON public.itam_discovery_jobs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org discovery jobs" ON public.itam_discovery_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org discovery jobs" ON public.itam_discovery_jobs
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org discovery jobs" ON public.itam_discovery_jobs
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_discovery_runs ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view org discovery runs" ON public.itam_discovery_runs;
DROP POLICY IF EXISTS "Admins manage org discovery runs" ON public.itam_discovery_runs;
DROP POLICY IF EXISTS "Admins insert org discovery runs" ON public.itam_discovery_runs;
DROP POLICY IF EXISTS "Admins update org discovery runs" ON public.itam_discovery_runs;
DROP POLICY IF EXISTS "Admins delete org discovery runs" ON public.itam_discovery_runs;
CREATE POLICY "Users view org discovery runs" ON public.itam_discovery_runs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org discovery runs" ON public.itam_discovery_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org discovery runs" ON public.itam_discovery_runs
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org discovery runs" ON public.itam_discovery_runs
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_discovered_hosts ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view org discovered hosts" ON public.itam_discovered_hosts;
DROP POLICY IF EXISTS "Admins manage org discovered hosts" ON public.itam_discovered_hosts;
DROP POLICY IF EXISTS "Admins insert org discovered hosts" ON public.itam_discovered_hosts;
DROP POLICY IF EXISTS "Admins update org discovered hosts" ON public.itam_discovered_hosts;
DROP POLICY IF EXISTS "Admins delete org discovered hosts" ON public.itam_discovered_hosts;
CREATE POLICY "Users view org discovered hosts" ON public.itam_discovered_hosts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org discovered hosts" ON public.itam_discovered_hosts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org discovered hosts" ON public.itam_discovered_hosts
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org discovered hosts" ON public.itam_discovered_hosts
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_asset_identities ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view org asset identities" ON public.itam_asset_identities;
DROP POLICY IF EXISTS "Admins manage org asset identities" ON public.itam_asset_identities;
DROP POLICY IF EXISTS "Admins insert org asset identities" ON public.itam_asset_identities;
DROP POLICY IF EXISTS "Admins update org asset identities" ON public.itam_asset_identities;
DROP POLICY IF EXISTS "Admins delete org asset identities" ON public.itam_asset_identities;
CREATE POLICY "Users view org asset identities" ON public.itam_asset_identities
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org asset identities" ON public.itam_asset_identities
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org asset identities" ON public.itam_asset_identities
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org asset identities" ON public.itam_asset_identities
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_software_catalog (global NULL org readable; writes org-scoped only) ─
DROP POLICY IF EXISTS "Users view org software catalog" ON public.itam_software_catalog;
DROP POLICY IF EXISTS "Admins manage org software catalog" ON public.itam_software_catalog;
DROP POLICY IF EXISTS "Admins insert org software catalog" ON public.itam_software_catalog;
DROP POLICY IF EXISTS "Admins update org software catalog" ON public.itam_software_catalog;
DROP POLICY IF EXISTS "Admins delete org software catalog" ON public.itam_software_catalog;
CREATE POLICY "Users view org software catalog" ON public.itam_software_catalog
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = public.get_current_user_org_id()
  );
CREATE POLICY "Admins insert org software catalog" ON public.itam_software_catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org software catalog" ON public.itam_software_catalog
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org software catalog" ON public.itam_software_catalog
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_software_aliases ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view software aliases" ON public.itam_software_aliases;
DROP POLICY IF EXISTS "Admins manage software aliases" ON public.itam_software_aliases;
DROP POLICY IF EXISTS "Admins insert software aliases" ON public.itam_software_aliases;
DROP POLICY IF EXISTS "Admins update software aliases" ON public.itam_software_aliases;
DROP POLICY IF EXISTS "Admins delete software aliases" ON public.itam_software_aliases;
CREATE POLICY "Users view software aliases" ON public.itam_software_aliases
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.itam_software_catalog c
    WHERE c.id = product_id
      AND (c.organization_id IS NULL OR c.organization_id = public.get_current_user_org_id())
  ));
CREATE POLICY "Admins insert software aliases" ON public.itam_software_aliases
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.itam_software_catalog c
    WHERE c.id = product_id
      AND c.organization_id = public.get_current_user_org_id()
      AND public.is_org_admin_of(c.organization_id)
  ));
CREATE POLICY "Admins update software aliases" ON public.itam_software_aliases
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.itam_software_catalog c
    WHERE c.id = product_id
      AND c.organization_id = public.get_current_user_org_id()
      AND public.is_org_admin_of(c.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.itam_software_catalog c
    WHERE c.id = product_id
      AND c.organization_id = public.get_current_user_org_id()
      AND public.is_org_admin_of(c.organization_id)
  ));
CREATE POLICY "Admins delete software aliases" ON public.itam_software_aliases
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.itam_software_catalog c
    WHERE c.id = product_id
      AND c.organization_id = public.get_current_user_org_id()
      AND public.is_org_admin_of(c.organization_id)
  ));

-- ── itam_discovery_diffs ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view org discovery diffs" ON public.itam_discovery_diffs;
DROP POLICY IF EXISTS "Admins manage org discovery diffs" ON public.itam_discovery_diffs;
DROP POLICY IF EXISTS "Admins insert org discovery diffs" ON public.itam_discovery_diffs;
DROP POLICY IF EXISTS "Admins update org discovery diffs" ON public.itam_discovery_diffs;
DROP POLICY IF EXISTS "Admins delete org discovery diffs" ON public.itam_discovery_diffs;
CREATE POLICY "Users view org discovery diffs" ON public.itam_discovery_diffs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org discovery diffs" ON public.itam_discovery_diffs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org discovery diffs" ON public.itam_discovery_diffs
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org discovery diffs" ON public.itam_discovery_diffs
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_discovery_audit (append-oriented: no UPDATE/DELETE for authenticated) ─
DROP POLICY IF EXISTS "Users view org discovery audit" ON public.itam_discovery_audit;
DROP POLICY IF EXISTS "Admins insert org discovery audit" ON public.itam_discovery_audit;
DROP POLICY IF EXISTS "Admins manage org discovery audit" ON public.itam_discovery_audit;
CREATE POLICY "Users view org discovery audit" ON public.itam_discovery_audit
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org discovery audit" ON public.itam_discovery_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_asset_services ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view org asset services" ON public.itam_asset_services;
DROP POLICY IF EXISTS "Admins manage org asset services" ON public.itam_asset_services;
DROP POLICY IF EXISTS "Admins insert org asset services" ON public.itam_asset_services;
DROP POLICY IF EXISTS "Admins update org asset services" ON public.itam_asset_services;
DROP POLICY IF EXISTS "Admins delete org asset services" ON public.itam_asset_services;
CREATE POLICY "Users view org asset services" ON public.itam_asset_services
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org asset services" ON public.itam_asset_services
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org asset services" ON public.itam_asset_services
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org asset services" ON public.itam_asset_services
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_field_provenance ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view org field provenance" ON public.itam_field_provenance;
DROP POLICY IF EXISTS "Admins manage org field provenance" ON public.itam_field_provenance;
DROP POLICY IF EXISTS "Admins insert org field provenance" ON public.itam_field_provenance;
DROP POLICY IF EXISTS "Admins update org field provenance" ON public.itam_field_provenance;
DROP POLICY IF EXISTS "Admins delete org field provenance" ON public.itam_field_provenance;
CREATE POLICY "Users view org field provenance" ON public.itam_field_provenance
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org field provenance" ON public.itam_field_provenance
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org field provenance" ON public.itam_field_provenance
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org field provenance" ON public.itam_field_provenance
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- Privileges: deny anon; authenticated uses RLS; service_role for Nest SoR path
REVOKE ALL ON TABLE
  public.itam_network_scopes,
  public.itam_discovery_jobs,
  public.itam_discovery_runs,
  public.itam_discovered_hosts,
  public.itam_asset_identities,
  public.itam_software_catalog,
  public.itam_software_aliases,
  public.itam_discovery_diffs,
  public.itam_discovery_audit,
  public.itam_asset_services,
  public.itam_field_provenance
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.itam_network_scopes,
  public.itam_discovery_jobs,
  public.itam_discovery_runs,
  public.itam_discovered_hosts,
  public.itam_asset_identities,
  public.itam_software_catalog,
  public.itam_software_aliases,
  public.itam_discovery_diffs,
  public.itam_discovery_audit,
  public.itam_asset_services,
  public.itam_field_provenance
TO authenticated;

GRANT ALL ON TABLE
  public.itam_network_scopes,
  public.itam_discovery_jobs,
  public.itam_discovery_runs,
  public.itam_discovered_hosts,
  public.itam_asset_identities,
  public.itam_software_catalog,
  public.itam_software_aliases,
  public.itam_discovery_diffs,
  public.itam_discovery_audit,
  public.itam_asset_services,
  public.itam_field_provenance
TO service_role;
