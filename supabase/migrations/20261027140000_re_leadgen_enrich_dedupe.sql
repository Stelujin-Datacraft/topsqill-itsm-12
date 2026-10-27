-- Real Estate: Meta enrichment + normalisation columns + de-dupe (ADDITIVE).
-- Does NOT edit 20261027120000 / 20261027130000.

-- Org-level RE settings (default country, dedupe window)
CREATE TABLE IF NOT EXISTS public.re_org_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_country_code text NOT NULL DEFAULT '+91',
  dedupe_window_days integer NOT NULL DEFAULT 90,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Source config extras for Meta enrichment / mapping
ALTER TABLE public.re_lead_source_configs
  ADD COLUMN IF NOT EXISTS app_secret text,
  ADD COLUMN IF NOT EXISTS graph_api_version text DEFAULT 'v21.0',
  ADD COLUMN IF NOT EXISTS needs_reauth boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reauth_reason text,
  ADD COLUMN IF NOT EXISTS field_mappings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Lead completeness / attribution columns
ALTER TABLE public.re_leads
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_raw text,
  ADD COLUMN IF NOT EXISTS phone_invalid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_normalized text,
  ADD COLUMN IF NOT EXISTS email_invalid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name_normalized text,
  ADD COLUMN IF NOT EXISTS budget_inr numeric,
  ADD COLUMN IF NOT EXISTS budget_raw text,
  ADD COLUMN IF NOT EXISTS custom_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS leadgen_id text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'none',
  -- none | pending | enriched | failed | skipped
  ADD COLUMN IF NOT EXISTS enrichment_error text,
  ADD COLUMN IF NOT EXISTS first_source text,
  ADD COLUMN IF NOT EXISTS latest_source text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS adset_name text,
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS form_id_external text,
  ADD COLUMN IF NOT EXISTS form_name text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS is_organic boolean,
  ADD COLUMN IF NOT EXISTS re_enquired_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_re_enquiry boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_re_leads_org_leadgen
  ON public.re_leads (organization_id, leadgen_id)
  WHERE leadgen_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_re_leads_org_phone_e164
  ON public.re_leads (organization_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_re_leads_org_email_norm
  ON public.re_leads (organization_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

-- Enrichment job queue (Meta Graph fetch — not inside webhook request)
CREATE TABLE IF NOT EXISTS public.re_enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_config_id uuid REFERENCES public.re_lead_source_configs(id) ON DELETE SET NULL,
  ingest_event_id uuid REFERENCES public.re_ingest_events(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.re_leads(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'meta_ads',
  leadgen_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- pending | running | succeeded | failed | needs_reauth
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_enrichment_jobs_due
  ON public.re_enrichment_jobs (status, run_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_re_enrichment_pending_leadgen
  ON public.re_enrichment_jobs (organization_id, leadgen_id)
  WHERE status IN ('pending', 'running');

-- Multi-touch attribution
CREATE TABLE IF NOT EXISTS public.re_lead_source_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.re_leads(id) ON DELETE CASCADE,
  source text NOT NULL,
  is_first boolean NOT NULL DEFAULT false,
  is_latest boolean NOT NULL DEFAULT false,
  campaign_name text,
  ad_name text,
  form_name text,
  custom_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingest_event_id uuid REFERENCES public.re_ingest_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_lead_source_touches_lead
  ON public.re_lead_source_touches (lead_id, created_at DESC);

-- Manual merge audit
CREATE TABLE IF NOT EXISTS public.re_lead_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  survivor_lead_id uuid NOT NULL REFERENCES public.re_leads(id) ON DELETE CASCADE,
  merged_lead_id uuid NOT NULL,
  merged_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  merged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ingest event enrichment status columns
ALTER TABLE public.re_ingest_events
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS enrichment_error text,
  ADD COLUMN IF NOT EXISTS leadgen_id text;

-- RLS
ALTER TABLE public.re_org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_lead_source_touches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_lead_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS re_org_settings_select ON public.re_org_settings;
CREATE POLICY re_org_settings_select ON public.re_org_settings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_org_settings_admin ON public.re_org_settings;
CREATE POLICY re_org_settings_admin ON public.re_org_settings
  FOR ALL TO authenticated
  USING (public.is_org_admin_of(organization_id))
  WITH CHECK (public.is_org_admin_of(organization_id));

DROP POLICY IF EXISTS re_enrich_jobs_select ON public.re_enrichment_jobs;
CREATE POLICY re_enrich_jobs_select ON public.re_enrichment_jobs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_touches_select ON public.re_lead_source_touches;
CREATE POLICY re_touches_select ON public.re_lead_source_touches
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_merges_select ON public.re_lead_merges;
CREATE POLICY re_merges_select ON public.re_lead_merges
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_org_settings TO authenticated;
GRANT SELECT ON public.re_enrichment_jobs TO authenticated;
GRANT SELECT ON public.re_lead_source_touches TO authenticated;
GRANT SELECT ON public.re_lead_merges TO authenticated;

GRANT ALL ON public.re_org_settings TO service_role;
GRANT ALL ON public.re_enrichment_jobs TO service_role;
GRANT ALL ON public.re_lead_source_touches TO service_role;
GRANT ALL ON public.re_lead_merges TO service_role;
