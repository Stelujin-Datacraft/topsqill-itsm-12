
-- Create asset_licenses table for license tracking
CREATE TABLE public.asset_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE SET NULL,
  license_name TEXT NOT NULL,
  license_key TEXT,
  license_type TEXT NOT NULL DEFAULT 'per-device',
  vendor TEXT,
  product TEXT,
  purchase_date DATE,
  expiry_date DATE,
  cost NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  seats_total INTEGER DEFAULT 1,
  seats_used INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asset_licenses ENABLE ROW LEVEL SECURITY;

-- RLS policies - org-scoped access
CREATE POLICY "Users can view licenses in their org"
  ON public.asset_licenses FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert licenses in their org"
  ON public.asset_licenses FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update licenses in their org"
  ON public.asset_licenses FOR UPDATE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete licenses in their org"
  ON public.asset_licenses FOR DELETE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_asset_licenses_org_id ON public.asset_licenses(organization_id);
CREATE INDEX idx_asset_licenses_asset_id ON public.asset_licenses(asset_id);
CREATE INDEX idx_asset_licenses_expiry ON public.asset_licenses(expiry_date);
