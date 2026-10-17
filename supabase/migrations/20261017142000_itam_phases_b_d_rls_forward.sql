-- FORWARD-ONLY ITAM repair for Dev/Prod that already applied main's
-- 2026093012*/13*/14* timestamps. Do NOT edit those shipped files to re-run.
-- REVIEWABLE ONLY — do not auto-apply from CI/agents. Manual Dev apply first.
-- Requires helpers: public.get_current_user_org_id(), public.is_org_admin_of(uuid)
--   (20260930110000_get_current_user_org_id.sql or earlier equivalents).
-- Idempotent: DROP POLICY IF EXISTS + CREATE; ENABLE RLS; REVOKE/GRANT.
-- Does not mutate row data. Does not weaken controls (replaces loose FOR ALL
-- with admin-gated writes; enables RLS where previously absent on B–D / sync).
-- Source policy text mirrored from 20260930130000 (forward apply for already-migrated DBs).
-- Target: Phase B–D cloud / passive / topology tables.
-- Append-only preserved: itam_cloud_changes, itam_passive_events, itam_topology_history.

-- RLS for Phases B–D (org isolation + admin writes via is_org_admin_of).
-- Requires 20260930110000 helpers. Credential refs / provider config are admin-write only.
-- Append-only: itam_cloud_changes, itam_passive_events, itam_topology_history
--   (SELECT org members; INSERT admins; no UPDATE/DELETE for authenticated).

-- ── itam_cloud_providers ──
ALTER TABLE public.itam_cloud_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_cloud_providers" ON public.itam_cloud_providers;
DROP POLICY IF EXISTS "Admins manage org itam_cloud_providers" ON public.itam_cloud_providers;
DROP POLICY IF EXISTS "Admins insert org itam_cloud_providers" ON public.itam_cloud_providers;
DROP POLICY IF EXISTS "Admins update org itam_cloud_providers" ON public.itam_cloud_providers;
DROP POLICY IF EXISTS "Admins delete org itam_cloud_providers" ON public.itam_cloud_providers;
CREATE POLICY "Users view org itam_cloud_providers" ON public.itam_cloud_providers
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_cloud_providers" ON public.itam_cloud_providers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_cloud_providers" ON public.itam_cloud_providers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_cloud_providers" ON public.itam_cloud_providers
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_cloud_accounts ──
ALTER TABLE public.itam_cloud_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_cloud_accounts" ON public.itam_cloud_accounts;
DROP POLICY IF EXISTS "Admins manage org itam_cloud_accounts" ON public.itam_cloud_accounts;
DROP POLICY IF EXISTS "Admins insert org itam_cloud_accounts" ON public.itam_cloud_accounts;
DROP POLICY IF EXISTS "Admins update org itam_cloud_accounts" ON public.itam_cloud_accounts;
DROP POLICY IF EXISTS "Admins delete org itam_cloud_accounts" ON public.itam_cloud_accounts;
CREATE POLICY "Users view org itam_cloud_accounts" ON public.itam_cloud_accounts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_cloud_accounts" ON public.itam_cloud_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_cloud_accounts" ON public.itam_cloud_accounts
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_cloud_accounts" ON public.itam_cloud_accounts
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_cloud_resources ──
ALTER TABLE public.itam_cloud_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_cloud_resources" ON public.itam_cloud_resources;
DROP POLICY IF EXISTS "Admins manage org itam_cloud_resources" ON public.itam_cloud_resources;
DROP POLICY IF EXISTS "Admins insert org itam_cloud_resources" ON public.itam_cloud_resources;
DROP POLICY IF EXISTS "Admins update org itam_cloud_resources" ON public.itam_cloud_resources;
DROP POLICY IF EXISTS "Admins delete org itam_cloud_resources" ON public.itam_cloud_resources;
CREATE POLICY "Users view org itam_cloud_resources" ON public.itam_cloud_resources
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_cloud_resources" ON public.itam_cloud_resources
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_cloud_resources" ON public.itam_cloud_resources
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_cloud_resources" ON public.itam_cloud_resources
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_cloud_discovery_jobs ──
ALTER TABLE public.itam_cloud_discovery_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs;
DROP POLICY IF EXISTS "Admins manage org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs;
DROP POLICY IF EXISTS "Admins insert org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs;
DROP POLICY IF EXISTS "Admins update org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs;
DROP POLICY IF EXISTS "Admins delete org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs;
CREATE POLICY "Users view org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_cloud_discovery_jobs" ON public.itam_cloud_discovery_jobs
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_cloud_changes ──
ALTER TABLE public.itam_cloud_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_cloud_changes" ON public.itam_cloud_changes;
DROP POLICY IF EXISTS "Admins manage org itam_cloud_changes" ON public.itam_cloud_changes;
DROP POLICY IF EXISTS "Admins insert org itam_cloud_changes" ON public.itam_cloud_changes;
DROP POLICY IF EXISTS "Admins update org itam_cloud_changes" ON public.itam_cloud_changes;
DROP POLICY IF EXISTS "Admins delete org itam_cloud_changes" ON public.itam_cloud_changes;
CREATE POLICY "Users view org itam_cloud_changes" ON public.itam_cloud_changes
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_cloud_changes" ON public.itam_cloud_changes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_telemetry_sources ──
ALTER TABLE public.itam_telemetry_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_telemetry_sources" ON public.itam_telemetry_sources;
DROP POLICY IF EXISTS "Admins manage org itam_telemetry_sources" ON public.itam_telemetry_sources;
DROP POLICY IF EXISTS "Admins insert org itam_telemetry_sources" ON public.itam_telemetry_sources;
DROP POLICY IF EXISTS "Admins update org itam_telemetry_sources" ON public.itam_telemetry_sources;
DROP POLICY IF EXISTS "Admins delete org itam_telemetry_sources" ON public.itam_telemetry_sources;
CREATE POLICY "Users view org itam_telemetry_sources" ON public.itam_telemetry_sources
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_telemetry_sources" ON public.itam_telemetry_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_telemetry_sources" ON public.itam_telemetry_sources
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_telemetry_sources" ON public.itam_telemetry_sources
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_network_observations ──
ALTER TABLE public.itam_network_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_network_observations" ON public.itam_network_observations;
DROP POLICY IF EXISTS "Admins manage org itam_network_observations" ON public.itam_network_observations;
DROP POLICY IF EXISTS "Admins insert org itam_network_observations" ON public.itam_network_observations;
DROP POLICY IF EXISTS "Admins update org itam_network_observations" ON public.itam_network_observations;
DROP POLICY IF EXISTS "Admins delete org itam_network_observations" ON public.itam_network_observations;
CREATE POLICY "Users view org itam_network_observations" ON public.itam_network_observations
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_network_observations" ON public.itam_network_observations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_network_observations" ON public.itam_network_observations
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_network_observations" ON public.itam_network_observations
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_ip_history ──
ALTER TABLE public.itam_ip_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_ip_history" ON public.itam_ip_history;
DROP POLICY IF EXISTS "Admins manage org itam_ip_history" ON public.itam_ip_history;
DROP POLICY IF EXISTS "Admins insert org itam_ip_history" ON public.itam_ip_history;
DROP POLICY IF EXISTS "Admins update org itam_ip_history" ON public.itam_ip_history;
DROP POLICY IF EXISTS "Admins delete org itam_ip_history" ON public.itam_ip_history;
CREATE POLICY "Users view org itam_ip_history" ON public.itam_ip_history
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_ip_history" ON public.itam_ip_history
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_ip_history" ON public.itam_ip_history
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_ip_history" ON public.itam_ip_history
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_mac_history ──
ALTER TABLE public.itam_mac_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_mac_history" ON public.itam_mac_history;
DROP POLICY IF EXISTS "Admins manage org itam_mac_history" ON public.itam_mac_history;
DROP POLICY IF EXISTS "Admins insert org itam_mac_history" ON public.itam_mac_history;
DROP POLICY IF EXISTS "Admins update org itam_mac_history" ON public.itam_mac_history;
DROP POLICY IF EXISTS "Admins delete org itam_mac_history" ON public.itam_mac_history;
CREATE POLICY "Users view org itam_mac_history" ON public.itam_mac_history
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_mac_history" ON public.itam_mac_history
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_mac_history" ON public.itam_mac_history
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_mac_history" ON public.itam_mac_history
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_passive_events ──
ALTER TABLE public.itam_passive_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_passive_events" ON public.itam_passive_events;
DROP POLICY IF EXISTS "Admins manage org itam_passive_events" ON public.itam_passive_events;
DROP POLICY IF EXISTS "Admins insert org itam_passive_events" ON public.itam_passive_events;
DROP POLICY IF EXISTS "Admins update org itam_passive_events" ON public.itam_passive_events;
DROP POLICY IF EXISTS "Admins delete org itam_passive_events" ON public.itam_passive_events;
CREATE POLICY "Users view org itam_passive_events" ON public.itam_passive_events
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_passive_events" ON public.itam_passive_events
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_topology_nodes ──
ALTER TABLE public.itam_topology_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_topology_nodes" ON public.itam_topology_nodes;
DROP POLICY IF EXISTS "Admins manage org itam_topology_nodes" ON public.itam_topology_nodes;
DROP POLICY IF EXISTS "Admins insert org itam_topology_nodes" ON public.itam_topology_nodes;
DROP POLICY IF EXISTS "Admins update org itam_topology_nodes" ON public.itam_topology_nodes;
DROP POLICY IF EXISTS "Admins delete org itam_topology_nodes" ON public.itam_topology_nodes;
CREATE POLICY "Users view org itam_topology_nodes" ON public.itam_topology_nodes
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_topology_nodes" ON public.itam_topology_nodes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_topology_nodes" ON public.itam_topology_nodes
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_topology_nodes" ON public.itam_topology_nodes
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_topology_edges ──
ALTER TABLE public.itam_topology_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_topology_edges" ON public.itam_topology_edges;
DROP POLICY IF EXISTS "Admins manage org itam_topology_edges" ON public.itam_topology_edges;
DROP POLICY IF EXISTS "Admins insert org itam_topology_edges" ON public.itam_topology_edges;
DROP POLICY IF EXISTS "Admins update org itam_topology_edges" ON public.itam_topology_edges;
DROP POLICY IF EXISTS "Admins delete org itam_topology_edges" ON public.itam_topology_edges;
CREATE POLICY "Users view org itam_topology_edges" ON public.itam_topology_edges
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_topology_edges" ON public.itam_topology_edges
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins update org itam_topology_edges" ON public.itam_topology_edges
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  )
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );
CREATE POLICY "Admins delete org itam_topology_edges" ON public.itam_topology_edges
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

-- ── itam_topology_history ──
ALTER TABLE public.itam_topology_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view org itam_topology_history" ON public.itam_topology_history;
DROP POLICY IF EXISTS "Admins manage org itam_topology_history" ON public.itam_topology_history;
DROP POLICY IF EXISTS "Admins insert org itam_topology_history" ON public.itam_topology_history;
DROP POLICY IF EXISTS "Admins update org itam_topology_history" ON public.itam_topology_history;
DROP POLICY IF EXISTS "Admins delete org itam_topology_history" ON public.itam_topology_history;
CREATE POLICY "Users view org itam_topology_history" ON public.itam_topology_history
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org itam_topology_history" ON public.itam_topology_history
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin_of(organization_id)
  );

REVOKE ALL ON TABLE
  public.itam_cloud_providers,
  public.itam_cloud_accounts,
  public.itam_cloud_resources,
  public.itam_cloud_discovery_jobs,
  public.itam_cloud_changes,
  public.itam_telemetry_sources,
  public.itam_network_observations,
  public.itam_ip_history,
  public.itam_mac_history,
  public.itam_passive_events,
  public.itam_topology_nodes,
  public.itam_topology_edges,
  public.itam_topology_history
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.itam_cloud_providers,
  public.itam_cloud_accounts,
  public.itam_cloud_resources,
  public.itam_cloud_discovery_jobs,
  public.itam_cloud_changes,
  public.itam_telemetry_sources,
  public.itam_network_observations,
  public.itam_ip_history,
  public.itam_mac_history,
  public.itam_passive_events,
  public.itam_topology_nodes,
  public.itam_topology_edges,
  public.itam_topology_history
TO authenticated;

GRANT ALL ON TABLE
  public.itam_cloud_providers,
  public.itam_cloud_accounts,
  public.itam_cloud_resources,
  public.itam_cloud_discovery_jobs,
  public.itam_cloud_changes,
  public.itam_telemetry_sources,
  public.itam_network_observations,
  public.itam_ip_history,
  public.itam_mac_history,
  public.itam_passive_events,
  public.itam_topology_nodes,
  public.itam_topology_edges,
  public.itam_topology_history
TO service_role;

