-- ITAM Network Discovery — authorized enterprise network discovery
-- Does NOT replace agent inventory. Extends existing it_assets as SoR.
-- No exploitation; scopes must be explicitly authorized.

-- Enums
DO $$ BEGIN
  CREATE TYPE public.discovery_job_status AS ENUM (
    'DRAFT', 'VALIDATING', 'READY', 'RUNNING', 'PAUSING', 'PAUSED',
    'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.discovery_mode AS ENUM (
    'PASSIVE', 'ACTIVE', 'CREDENTIALED', 'AGENT', 'HYBRID'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.network_scope_auth_status AS ENUM (
    'PENDING', 'APPROVED', 'REVOKED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.discovered_asset_status AS ENUM (
    'DISCOVERED', 'UNVERIFIED', 'VERIFIED', 'MANAGED', 'IGNORED', 'RETIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.discovery_confidence AS ENUM ('HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_source AS ENUM (
    'AGENT', 'NETWORK_DISCOVERY', 'CREDENTIALED', 'MANAGEMENT_API', 'SNMP', 'MANUAL', 'DNS', 'DHCP', 'ARP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend it_assets with discovery lifecycle (non-breaking)
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS discovery_lifecycle TEXT DEFAULT 'MANAGED',
  ADD COLUMN IF NOT EXISTS discovery_confidence TEXT,
  ADD COLUMN IF NOT EXISTS primary_discovery_source TEXT,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bios_uuid TEXT,
  ADD COLUMN IF NOT EXISTS machine_guid TEXT,
  ADD COLUMN IF NOT EXISTS cloud_instance_id TEXT;

CREATE INDEX IF NOT EXISTS idx_it_assets_serial ON public.it_assets(organization_id, serial_number)
  WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_it_assets_mac ON public.it_assets(organization_id, mac_address)
  WHERE mac_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_it_assets_hostname ON public.it_assets(organization_id, hostname)
  WHERE hostname IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_it_assets_bios_uuid ON public.it_assets(organization_id, bios_uuid)
  WHERE bios_uuid IS NOT NULL;

-- Extend asset_software for multi-source inventory
ALTER TABLE public.asset_software
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'AGENT',
  ADD COLUMN IF NOT EXISTS raw_name TEXT,
  ADD COLUMN IF NOT EXISTS raw_version TEXT,
  ADD COLUMN IF NOT EXISTS software_product_id UUID,
  ADD COLUMN IF NOT EXISTS normalized_version TEXT,
  ADD COLUMN IF NOT EXISTS edition TEXT,
  ADD COLUMN IF NOT EXISTS architecture TEXT,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_asset_software_name_ver
  ON public.asset_software(asset_id, software_name, version);

-- Network scopes (authorized CIDRs only)
CREATE TABLE IF NOT EXISTS public.itam_network_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'LAB',
  name TEXT NOT NULL,
  description TEXT,
  cidr TEXT NOT NULL,
  scope_kind TEXT NOT NULL DEFAULT 'INCLUDE', -- INCLUDE | EXCLUDE
  authorization_status public.network_scope_auth_status NOT NULL DEFAULT 'PENDING',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT itam_network_scopes_env_chk CHECK (environment IN ('LAB', 'TEST', 'UAT', 'PROD')),
  CONSTRAINT itam_network_scopes_kind_chk CHECK (scope_kind IN ('INCLUDE', 'EXCLUDE'))
);

CREATE INDEX IF NOT EXISTS idx_itam_network_scopes_org
  ON public.itam_network_scopes(organization_id, environment);

-- Discovery jobs
CREATE TABLE IF NOT EXISTS public.itam_discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment_id TEXT NOT NULL DEFAULT 'LAB',
  name TEXT NOT NULL,
  description TEXT,
  status public.discovery_job_status NOT NULL DEFAULT 'DRAFT',
  discovery_mode public.discovery_mode NOT NULL DEFAULT 'ACTIVE',
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
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  progress JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_itam_discovery_jobs_org
  ON public.itam_discovery_jobs(organization_id, status);

-- Discovery runs (history)
CREATE TABLE IF NOT EXISTS public.itam_discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.itam_discovery_jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status public.discovery_job_status NOT NULL DEFAULT 'RUNNING',
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

-- Discovered host observations (before/alongside SoR merge)
CREATE TABLE IF NOT EXISTS public.itam_discovered_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.itam_discovery_jobs(id) ON DELETE SET NULL,
  run_id UUID REFERENCES public.itam_discovery_runs(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE SET NULL,
  status public.discovered_asset_status NOT NULL DEFAULT 'DISCOVERED',
  confidence public.discovery_confidence NOT NULL DEFAULT 'LOW',
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
  ON public.itam_discovered_hosts(organization_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_itam_discovered_hosts_asset
  ON public.itam_discovered_hosts(asset_id);

-- Multi-signal asset identity
CREATE TABLE IF NOT EXISTS public.itam_asset_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,
  identity_type TEXT NOT NULL,
  identity_value TEXT NOT NULL,
  source public.inventory_source NOT NULL DEFAULT 'NETWORK_DISCOVERY',
  confidence public.discovery_confidence NOT NULL DEFAULT 'MEDIUM',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, identity_type, identity_value)
);

CREATE INDEX IF NOT EXISTS idx_itam_asset_identities_asset
  ON public.itam_asset_identities(asset_id);

-- Software catalog + aliases
CREATE TABLE IF NOT EXISTS public.itam_software_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  publisher TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, canonical_name)
);

CREATE TABLE IF NOT EXISTS public.itam_software_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.itam_software_catalog(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, alias_name)
);

-- Discovery diffs
CREATE TABLE IF NOT EXISTS public.itam_discovery_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.itam_discovery_runs(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Discovery audit
CREATE TABLE IF NOT EXISTS public.itam_discovery_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itam_discovery_audit_org
  ON public.itam_discovery_audit(organization_id, created_at DESC);

-- Services observed on assets
CREATE TABLE IF NOT EXISTS public.itam_asset_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  service TEXT,
  banner TEXT,
  source public.inventory_source NOT NULL DEFAULT 'NETWORK_DISCOVERY',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, port, protocol)
);

-- Field provenance for merged assets
CREATE TABLE IF NOT EXISTS public.itam_field_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  source public.inventory_source NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, field_name)
);

-- RLS
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

CREATE POLICY "Users view org network scopes" ON public.itam_network_scopes
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org network scopes" ON public.itam_network_scopes
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view org discovery jobs" ON public.itam_discovery_jobs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org discovery jobs" ON public.itam_discovery_jobs
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view org discovery runs" ON public.itam_discovery_runs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org discovery runs" ON public.itam_discovery_runs
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view org discovered hosts" ON public.itam_discovered_hosts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org discovered hosts" ON public.itam_discovered_hosts
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view org asset identities" ON public.itam_asset_identities
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org asset identities" ON public.itam_asset_identities
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view org software catalog" ON public.itam_software_catalog
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org software catalog" ON public.itam_software_catalog
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view software aliases" ON public.itam_software_aliases
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.itam_software_catalog c
    WHERE c.id = product_id
      AND (c.organization_id IS NULL OR c.organization_id = public.get_current_user_org_id())
  ));
CREATE POLICY "Admins manage software aliases" ON public.itam_software_aliases
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.itam_software_catalog c
    WHERE c.id = product_id AND c.organization_id = public.get_current_user_org_id()
  ));

CREATE POLICY "Users view org discovery diffs" ON public.itam_discovery_diffs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org discovery diffs" ON public.itam_discovery_diffs
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view org discovery audit" ON public.itam_discovery_audit
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins insert org discovery audit" ON public.itam_discovery_audit
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view org asset services" ON public.itam_asset_services
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org asset services" ON public.itam_asset_services
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Users view org field provenance" ON public.itam_field_provenance
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());
CREATE POLICY "Admins manage org field provenance" ON public.itam_field_provenance
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());
