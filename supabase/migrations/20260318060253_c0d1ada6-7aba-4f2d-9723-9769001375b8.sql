
-- IT Asset Management System

-- Asset status enum
CREATE TYPE public.asset_status AS ENUM ('active', 'inactive', 'maintenance', 'retired', 'disposed', 'lost', 'stolen');
CREATE TYPE public.asset_condition AS ENUM ('new', 'good', 'fair', 'poor', 'broken');
CREATE TYPE public.agent_status AS ENUM ('online', 'offline', 'error', 'unregistered');

-- Main assets table
CREATE TABLE public.it_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_tag TEXT UNIQUE,
  hostname TEXT,
  display_name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'workstation',
  category TEXT DEFAULT 'hardware',
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  status public.asset_status NOT NULL DEFAULT 'active',
  condition public.asset_condition DEFAULT 'good',
  assigned_to UUID REFERENCES public.user_profiles(id),
  department TEXT,
  location TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(12,2),
  warranty_expiry DATE,
  ip_address TEXT,
  mac_address TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent registration and heartbeat tracking
CREATE TABLE public.asset_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  agent_key TEXT UNIQUE NOT NULL,
  hostname TEXT,
  os_type TEXT,
  os_version TEXT,
  agent_version TEXT DEFAULT '1.0.0',
  status public.agent_status NOT NULL DEFAULT 'unregistered',
  last_heartbeat TIMESTAMPTZ,
  last_report TIMESTAMPTZ,
  ip_address TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hardware info collected by agent
CREATE TABLE public.asset_hardware_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE CASCADE NOT NULL,
  cpu_model TEXT,
  cpu_cores INTEGER,
  cpu_speed_mhz INTEGER,
  ram_total_gb NUMERIC(10,2),
  disk_total_gb NUMERIC(10,2),
  disk_free_gb NUMERIC(10,2),
  gpu_model TEXT,
  os_name TEXT,
  os_version TEXT,
  os_architecture TEXT,
  bios_version TEXT,
  motherboard_model TEXT,
  network_adapters JSONB DEFAULT '[]',
  display_info JSONB DEFAULT '[]',
  last_boot_time TIMESTAMPTZ,
  uptime_hours NUMERIC(10,2),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id)
);

-- Software inventory collected by agent
CREATE TABLE public.asset_software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE CASCADE NOT NULL,
  software_name TEXT NOT NULL,
  version TEXT,
  publisher TEXT,
  install_date DATE,
  install_path TEXT,
  size_mb NUMERIC(10,2),
  is_system_component BOOLEAN DEFAULT false,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset lifecycle / change history
CREATE TABLE public.asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset categories for organization
CREATE TABLE public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Monitor',
  parent_id UUID REFERENCES public.asset_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate asset tags
CREATE OR REPLACE FUNCTION public.generate_asset_tag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  IF NEW.asset_tag IS NULL THEN
    SELECT COALESCE(MAX(
      CASE WHEN asset_tag ~ '^ASSET-[0-9]+$'
        THEN SUBSTRING(asset_tag FROM 7)::INTEGER
        ELSE 0
      END
    ), 0) + 1 INTO seq_num FROM it_assets;
    NEW.asset_tag := 'ASSET-' || LPAD(seq_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_asset_tag_trigger
  BEFORE INSERT ON public.it_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_asset_tag();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_it_asset_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_it_assets_updated_at
  BEFORE UPDATE ON public.it_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_it_asset_updated_at();

CREATE TRIGGER update_asset_agents_updated_at
  BEFORE UPDATE ON public.asset_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_it_asset_updated_at();

CREATE TRIGGER update_asset_hardware_updated_at
  BEFORE UPDATE ON public.asset_hardware_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_it_asset_updated_at();

-- RLS Policies
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_hardware_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_software ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

-- RLS: Users can access assets in their organization
CREATE POLICY "Users can view org assets" ON public.it_assets
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Admins can insert org assets" ON public.it_assets
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

CREATE POLICY "Admins can update org assets" ON public.it_assets
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Admins can delete org assets" ON public.it_assets
  FOR DELETE TO authenticated
  USING (organization_id = public.get_current_user_org_id());

-- RLS for agents
CREATE POLICY "Users can view org agents" ON public.asset_agents
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Admins can manage org agents" ON public.asset_agents
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

-- RLS for hardware info (via asset)
CREATE POLICY "Users can view asset hardware" ON public.asset_hardware_info
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.it_assets a 
    WHERE a.id = asset_id AND a.organization_id = public.get_current_user_org_id()
  ));

CREATE POLICY "System can manage asset hardware" ON public.asset_hardware_info
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.it_assets a 
    WHERE a.id = asset_id AND a.organization_id = public.get_current_user_org_id()
  ));

-- RLS for software
CREATE POLICY "Users can view asset software" ON public.asset_software
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.it_assets a 
    WHERE a.id = asset_id AND a.organization_id = public.get_current_user_org_id()
  ));

CREATE POLICY "System can manage asset software" ON public.asset_software
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.it_assets a 
    WHERE a.id = asset_id AND a.organization_id = public.get_current_user_org_id()
  ));

-- RLS for history
CREATE POLICY "Users can view asset history" ON public.asset_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.it_assets a 
    WHERE a.id = asset_id AND a.organization_id = public.get_current_user_org_id()
  ));

CREATE POLICY "System can insert asset history" ON public.asset_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.it_assets a 
    WHERE a.id = asset_id AND a.organization_id = public.get_current_user_org_id()
  ));

-- RLS for categories
CREATE POLICY "Users can view org categories" ON public.asset_categories
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "Admins can manage org categories" ON public.asset_categories
  FOR ALL TO authenticated
  USING (organization_id = public.get_current_user_org_id());

-- Indexes for performance
CREATE INDEX idx_it_assets_org ON public.it_assets(organization_id);
CREATE INDEX idx_it_assets_status ON public.it_assets(status);
CREATE INDEX idx_it_assets_type ON public.it_assets(asset_type);
CREATE INDEX idx_it_assets_assigned ON public.it_assets(assigned_to);
CREATE INDEX idx_asset_agents_org ON public.asset_agents(organization_id);
CREATE INDEX idx_asset_agents_status ON public.asset_agents(status);
CREATE INDEX idx_asset_software_asset ON public.asset_software(asset_id);
CREATE INDEX idx_asset_history_asset ON public.asset_history(asset_id);
