-- ITAM Phases B–D: Cloud / Virtualization / Passive / Topology
-- Extends Phase A. Does NOT create a second asset inventory.
-- Vulnerability management intentionally excluded.
-- Requires 20260930120000_itam_network_discovery (inventory_source enum, it_assets extensions).

-- Extend inventory_source enum (ignore if already present)
DO $$ BEGIN ALTER TYPE public.inventory_source ADD VALUE IF NOT EXISTS 'CLOUD_AWS'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.inventory_source ADD VALUE IF NOT EXISTS 'CLOUD_AZURE'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.inventory_source ADD VALUE IF NOT EXISTS 'CLOUD_GCP'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.inventory_source ADD VALUE IF NOT EXISTS 'VMWARE'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.inventory_source ADD VALUE IF NOT EXISTS 'WIRELESS'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.inventory_source ADD VALUE IF NOT EXISTS 'LLDP'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.inventory_source ADD VALUE IF NOT EXISTS 'CDP'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.inventory_source ADD VALUE IF NOT EXISTS 'SWITCH_MAC'; EXCEPTION WHEN others THEN NULL; END $$;

-- cloud_instance_id may already exist from 20260930120000 — IF NOT EXISTS is safe.
ALTER TABLE public.it_assets ADD COLUMN IF NOT EXISTS cloud_instance_id TEXT;
-- DO NOT ADD tags JSONB: core it_assets.tags is TEXT[] (20260318060253_*).
-- Replacing/altering that column requires inspecting live row shapes — out of scope here.
CREATE INDEX IF NOT EXISTS idx_it_assets_org_cloud_id
  ON public.it_assets(organization_id, cloud_instance_id)
  WHERE cloud_instance_id IS NOT NULL;

-- ── Phase B: Cloud providers & resources ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.itam_cloud_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('AWS','AZURE','GCP','VMWARE','OTHER')),
  name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'LAB',
  credential_reference_id TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING',
  last_error TEXT,
  last_tested_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider_type, name)
);

CREATE TABLE IF NOT EXISTS public.itam_cloud_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.itam_cloud_providers(id) ON DELETE CASCADE,
  account_key TEXT NOT NULL,
  display_name TEXT,
  region_scope JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider_id, account_key)
);

CREATE TABLE IF NOT EXISTS public.itam_cloud_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.itam_cloud_providers(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.itam_cloud_accounts(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE SET NULL,
  provider_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_arn TEXT,
  resource_type TEXT NOT NULL,
  name TEXT,
  region TEXT,
  zone TEXT,
  status TEXT,
  tags JSONB DEFAULT '{}',
  network_info JSONB DEFAULT '{}',
  raw JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider_type, resource_id)
);

CREATE TABLE IF NOT EXISTS public.itam_cloud_discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.itam_cloud_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  schedule TEXT DEFAULT 'ON_DEMAND',
  schedule_cron TEXT,
  credential_reference_id TEXT,
  progress JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  last_error TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.itam_cloud_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID,
  resource_id UUID,
  change_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itam_cloud_resources_tags ON public.itam_cloud_resources USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_itam_cloud_resources_org_type ON public.itam_cloud_resources(organization_id, resource_type);

-- ── Phase C: Passive network intelligence ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.itam_telemetry_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('DHCP','ARP','DNS','SWITCH_MAC','WIRELESS','NMS')),
  name TEXT NOT NULL,
  credential_reference_id TEXT,
  authorized_scopes JSONB DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, source_type, name)
);

CREATE TABLE IF NOT EXISTS public.itam_network_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_id UUID REFERENCES public.itam_telemetry_sources(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE SET NULL,
  ip_address TEXT,
  mac_address TEXT,
  hostname TEXT,
  vlan TEXT,
  interface_name TEXT,
  switch_id TEXT,
  ssid TEXT,
  record_type TEXT,
  lease_start TIMESTAMPTZ,
  lease_end TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itam_obs_org_ip ON public.itam_network_observations(organization_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_itam_obs_org_mac ON public.itam_network_observations(organization_id, mac_address);
CREATE INDEX IF NOT EXISTS idx_itam_obs_org_time ON public.itam_network_observations(organization_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.itam_ip_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  source TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, asset_id, ip_address, source)
);

CREATE TABLE IF NOT EXISTS public.itam_mac_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,
  mac_address TEXT NOT NULL,
  source TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, asset_id, mac_address, source)
);

CREATE TABLE IF NOT EXISTS public.itam_passive_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Phase D: Topology ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.itam_topology_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE SET NULL,
  logical_key TEXT NOT NULL,
  node_kind TEXT NOT NULL,
  display_name TEXT,
  metadata JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, logical_key)
);

CREATE TABLE IF NOT EXISTS public.itam_topology_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_node_id UUID NOT NULL REFERENCES public.itam_topology_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.itam_topology_nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'MEDIUM',
  metadata JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, source_node_id, target_node_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS public.itam_topology_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  edge_id UUID REFERENCES public.itam_topology_edges(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itam_topo_edges_org ON public.itam_topology_edges(organization_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_itam_topo_nodes_asset ON public.itam_topology_nodes(organization_id, asset_id)
  WHERE asset_id IS NOT NULL;

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

