-- ITAM Phases B–D: Cloud / Virtualization / Passive / Topology
-- Extends Phase A. Does NOT create a second asset inventory.
-- Vulnerability management intentionally excluded.

-- Extend inventory_source enum (ignore if already present)
DO $$ BEGIN ALTER TYPE inventory_source ADD VALUE IF NOT EXISTS 'CLOUD_AWS'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE inventory_source ADD VALUE IF NOT EXISTS 'CLOUD_AZURE'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE inventory_source ADD VALUE IF NOT EXISTS 'CLOUD_GCP'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE inventory_source ADD VALUE IF NOT EXISTS 'VMWARE'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE inventory_source ADD VALUE IF NOT EXISTS 'WIRELESS'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE inventory_source ADD VALUE IF NOT EXISTS 'LLDP'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE inventory_source ADD VALUE IF NOT EXISTS 'CDP'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE inventory_source ADD VALUE IF NOT EXISTS 'SWITCH_MAC'; EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE it_assets ADD COLUMN IF NOT EXISTS cloud_instance_id TEXT;
ALTER TABLE it_assets ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_it_assets_org_cloud_id
  ON it_assets(organization_id, cloud_instance_id)
  WHERE cloud_instance_id IS NOT NULL;

-- ── Phase B: Cloud providers & resources ──────────────────────────────────
CREATE TABLE IF NOT EXISTS itam_cloud_providers (
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

CREATE TABLE IF NOT EXISTS itam_cloud_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES itam_cloud_providers(id) ON DELETE CASCADE,
  account_key TEXT NOT NULL,
  display_name TEXT,
  region_scope JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider_id, account_key)
);

CREATE TABLE IF NOT EXISTS itam_cloud_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES itam_cloud_providers(id) ON DELETE CASCADE,
  account_id UUID REFERENCES itam_cloud_accounts(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES it_assets(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS itam_cloud_discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES itam_cloud_providers(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS itam_cloud_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID,
  resource_id UUID,
  change_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itam_cloud_resources_tags ON itam_cloud_resources USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_itam_cloud_resources_org_type ON itam_cloud_resources(organization_id, resource_type);

-- ── Phase C: Passive network intelligence ─────────────────────────────────
CREATE TABLE IF NOT EXISTS itam_telemetry_sources (
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

CREATE TABLE IF NOT EXISTS itam_network_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_id UUID REFERENCES itam_telemetry_sources(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  asset_id UUID REFERENCES it_assets(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_itam_obs_org_ip ON itam_network_observations(organization_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_itam_obs_org_mac ON itam_network_observations(organization_id, mac_address);
CREATE INDEX IF NOT EXISTS idx_itam_obs_org_time ON itam_network_observations(organization_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS itam_ip_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES it_assets(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  source TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, asset_id, ip_address, source)
);

CREATE TABLE IF NOT EXISTS itam_mac_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES it_assets(id) ON DELETE CASCADE,
  mac_address TEXT NOT NULL,
  source TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, asset_id, mac_address, source)
);

CREATE TABLE IF NOT EXISTS itam_passive_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID REFERENCES it_assets(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Phase D: Topology ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itam_topology_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID REFERENCES it_assets(id) ON DELETE SET NULL,
  logical_key TEXT NOT NULL,
  node_kind TEXT NOT NULL,
  display_name TEXT,
  metadata JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, logical_key)
);

CREATE TABLE IF NOT EXISTS itam_topology_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_node_id UUID NOT NULL REFERENCES itam_topology_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES itam_topology_nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'MEDIUM',
  metadata JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, source_node_id, target_node_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS itam_topology_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  edge_id UUID REFERENCES itam_topology_edges(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itam_topo_edges_org ON itam_topology_edges(organization_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_itam_topo_nodes_asset ON itam_topology_nodes(organization_id, asset_id)
  WHERE asset_id IS NOT NULL;
