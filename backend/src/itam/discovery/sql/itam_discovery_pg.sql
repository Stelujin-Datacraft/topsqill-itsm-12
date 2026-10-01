-- ITAM Network Discovery — self-contained PostgreSQL schema for Nest persistence.
-- Applied to dedicated DB (itam_discovery). No Supabase RLS helpers required.
-- organization_id is a plain UUID (tenant key) without FK to platforms orgs table.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE discovery_job_status AS ENUM (
    'DRAFT', 'VALIDATING', 'READY', 'RUNNING', 'PAUSING', 'PAUSED',
    'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discovery_mode AS ENUM (
    'PASSIVE', 'ACTIVE', 'CREDENTIALED', 'AGENT', 'HYBRID'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE network_scope_auth_status AS ENUM (
    'PENDING', 'APPROVED', 'REVOKED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discovered_asset_status AS ENUM (
    'DISCOVERED', 'UNVERIFIED', 'VERIFIED', 'MANAGED', 'IGNORED', 'RETIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discovery_confidence AS ENUM ('HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_source AS ENUM (
    'AGENT', 'NETWORK_DISCOVERY', 'CREDENTIALED', 'MANAGEMENT_API',
    'SNMP', 'MANUAL', 'DNS', 'DHCP', 'ARP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Minimal asset SoR for discovery persistence (mirrors it_assets subset)
CREATE TABLE IF NOT EXISTS it_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_tag TEXT,
  hostname TEXT,
  display_name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'workstation',
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  ip_address TEXT,
  mac_address TEXT,
  bios_uuid TEXT,
  machine_guid TEXT,
  discovery_lifecycle TEXT DEFAULT 'MANAGED',
  discovery_confidence TEXT,
  primary_discovery_source TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_it_assets_org_serial
  ON it_assets(organization_id, serial_number)
  WHERE serial_number IS NOT NULL AND serial_number <> '';
CREATE INDEX IF NOT EXISTS idx_it_assets_org_mac ON it_assets(organization_id, mac_address)
  WHERE mac_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_it_assets_org_host ON it_assets(organization_id, hostname)
  WHERE hostname IS NOT NULL;

CREATE TABLE IF NOT EXISTS asset_software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES it_assets(id) ON DELETE CASCADE,
  software_name TEXT NOT NULL,
  version TEXT,
  publisher TEXT,
  source TEXT DEFAULT 'AGENT',
  raw_name TEXT,
  raw_version TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, software_name, version)
);

CREATE TABLE IF NOT EXISTS itam_network_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  environment TEXT NOT NULL DEFAULT 'LAB',
  name TEXT NOT NULL,
  description TEXT,
  cidr TEXT NOT NULL,
  scope_kind TEXT NOT NULL DEFAULT 'INCLUDE',
  authorization_status network_scope_auth_status NOT NULL DEFAULT 'PENDING',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, cidr, scope_kind)
);

CREATE TABLE IF NOT EXISTS itam_discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  environment_id TEXT NOT NULL DEFAULT 'LAB',
  name TEXT NOT NULL,
  description TEXT,
  status discovery_job_status NOT NULL DEFAULT 'DRAFT',
  discovery_mode discovery_mode NOT NULL DEFAULT 'ACTIVE',
  network_ranges JSONB NOT NULL DEFAULT '[]',
  excluded_ranges JSONB NOT NULL DEFAULT '[]',
  schedule TEXT DEFAULT 'ON_DEMAND',
  schedule_cron TEXT,
  max_concurrency INTEGER NOT NULL DEFAULT 32,
  max_hosts INTEGER NOT NULL DEFAULT 1024,
  timeout_ms INTEGER NOT NULL DEFAULT 3000,
  host_timeout_ms INTEGER NOT NULL DEFAULT 2000,
  job_timeout_ms INTEGER NOT NULL DEFAULT 3600000,
  rate_limit_per_sec NUMERIC(10,2) NOT NULL DEFAULT 50,
  credential_reference_id TEXT,
  tcp_ports JSONB DEFAULT '[22,80,443,3389,5985,161]',
  enable_icmp BOOLEAN NOT NULL DEFAULT true,
  enable_tcp BOOLEAN NOT NULL DEFAULT true,
  enable_snmp BOOLEAN NOT NULL DEFAULT false,
  enable_credentialed BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  progress JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_itam_discovery_jobs_org ON itam_discovery_jobs(organization_id, status);

CREATE TABLE IF NOT EXISTS itam_discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES itam_discovery_jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  status discovery_job_status NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  hosts_targeted INTEGER DEFAULT 0,
  hosts_scanned INTEGER DEFAULT 0,
  hosts_discovered INTEGER DEFAULT 0,
  assets_created INTEGER DEFAULT 0,
  assets_updated INTEGER DEFAULT 0,
  assets_unmanaged INTEGER DEFAULT 0,
  software_discovered INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  error_summary JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS itam_discovered_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID REFERENCES itam_discovery_jobs(id) ON DELETE SET NULL,
  run_id UUID REFERENCES itam_discovery_runs(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES it_assets(id) ON DELETE SET NULL,
  status discovered_asset_status NOT NULL DEFAULT 'DISCOVERED',
  confidence discovery_confidence NOT NULL DEFAULT 'LOW',
  ip_address TEXT,
  mac_address TEXT,
  hostname TEXT,
  dns_name TEXT,
  device_type TEXT DEFAULT 'UNKNOWN',
  os_name TEXT,
  os_family TEXT,
  os_version TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  bios_uuid TEXT,
  machine_guid TEXT,
  response_time_ms NUMERIC(12,2),
  discovery_methods TEXT[] DEFAULT '{}',
  services JSONB DEFAULT '[]',
  software JSONB DEFAULT '[]',
  field_provenance JSONB DEFAULT '{}',
  raw_evidence JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itam_discovered_hosts_org_ip
  ON itam_discovered_hosts(organization_id, ip_address);

CREATE TABLE IF NOT EXISTS itam_asset_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES it_assets(id) ON DELETE CASCADE,
  identity_type TEXT NOT NULL,
  identity_value TEXT NOT NULL,
  source inventory_source NOT NULL DEFAULT 'NETWORK_DISCOVERY',
  confidence discovery_confidence NOT NULL DEFAULT 'MEDIUM',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, identity_type, identity_value)
);

CREATE TABLE IF NOT EXISTS itam_software_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  canonical_name TEXT NOT NULL,
  publisher TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, canonical_name)
);

CREATE TABLE IF NOT EXISTS itam_software_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES itam_software_catalog(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, alias_name)
);

CREATE TABLE IF NOT EXISTS itam_discovery_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  run_id UUID REFERENCES itam_discovery_runs(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES it_assets(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS itam_discovery_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS itam_asset_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES it_assets(id) ON DELETE CASCADE,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  service TEXT,
  banner TEXT,
  source inventory_source NOT NULL DEFAULT 'NETWORK_DISCOVERY',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, port, protocol)
);

CREATE TABLE IF NOT EXISTS itam_field_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES it_assets(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  source inventory_source NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, field_name)
);
