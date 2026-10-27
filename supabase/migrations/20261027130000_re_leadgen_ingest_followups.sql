-- Real Estate lead ingest + follow-ups (ADDITIVE).
-- Depends on 20261027120000_re_leadgen_foundation.sql

-- Per-org source connector config (secrets stored server-side; never expose raw to anon)
CREATE TABLE IF NOT EXISTS public.re_lead_source_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  provider text NOT NULL,
  -- website | meta_ads | google_ads | linkedin | portal_99acres | portal_magicbricks | portal_housing | portal_email | call
  enabled boolean NOT NULL DEFAULT false,
  display_name text,
  ingest_key text,
  verify_token text,
  access_token text,
  page_id text,
  form_id_external text,
  webhook_path_token text DEFAULT encode(gen_random_bytes(16), 'hex'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_re_lead_source_configs_org
  ON public.re_lead_source_configs (organization_id);
CREATE INDEX IF NOT EXISTS idx_re_lead_source_configs_path
  ON public.re_lead_source_configs (webhook_path_token);

-- Raw ingest audit trail
CREATE TABLE IF NOT EXISTS public.re_ingest_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  -- received | accepted | rejected | error
  lead_id uuid REFERENCES public.re_leads(id) ON DELETE SET NULL,
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_ingest_events_org_created
  ON public.re_ingest_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_ingest_events_provider
  ON public.re_ingest_events (provider, created_at DESC);

-- Simple email follow-up rules per org
CREATE TABLE IF NOT EXISTS public.re_follow_up_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  name text NOT NULL DEFAULT 'Welcome / first touch',
  delay_minutes integer NOT NULL DEFAULT 15,
  channel text NOT NULL DEFAULT 'email',
  subject_template text NOT NULL DEFAULT 'Thanks for your interest, {{contact_name}}',
  body_template text NOT NULL DEFAULT 'Hi {{contact_name}},\n\nThanks for reaching out about our properties. We will get back to you shortly.\n\n— {{org_name}}',
  only_sources text[] DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_follow_up_rules_org
  ON public.re_follow_up_rules (organization_id);

-- Scheduled follow-up jobs
CREATE TABLE IF NOT EXISTS public.re_follow_up_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.re_leads(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.re_follow_up_rules(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email',
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- pending | sent | skipped | failed
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_follow_up_jobs_due
  ON public.re_follow_up_jobs (status, run_at)
  WHERE status = 'pending';

ALTER TABLE public.re_lead_source_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_ingest_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_follow_up_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_follow_up_jobs ENABLE ROW LEVEL SECURITY;

-- Source configs: org members read; admins write
DROP POLICY IF EXISTS re_src_select ON public.re_lead_source_configs;
CREATE POLICY re_src_select ON public.re_lead_source_configs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_src_write_admin ON public.re_lead_source_configs;
CREATE POLICY re_src_write_admin ON public.re_lead_source_configs
  FOR ALL TO authenticated
  USING (public.is_org_admin_of(organization_id))
  WITH CHECK (public.is_org_admin_of(organization_id));

DROP POLICY IF EXISTS re_ingest_select ON public.re_ingest_events;
CREATE POLICY re_ingest_select ON public.re_ingest_events
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_rules_select ON public.re_follow_up_rules;
CREATE POLICY re_rules_select ON public.re_follow_up_rules
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_rules_write_admin ON public.re_follow_up_rules;
CREATE POLICY re_rules_write_admin ON public.re_follow_up_rules
  FOR ALL TO authenticated
  USING (public.is_org_admin_of(organization_id))
  WITH CHECK (public.is_org_admin_of(organization_id));

DROP POLICY IF EXISTS re_jobs_select ON public.re_follow_up_jobs;
CREATE POLICY re_jobs_select ON public.re_follow_up_jobs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_lead_source_configs TO authenticated;
GRANT SELECT ON public.re_ingest_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_follow_up_rules TO authenticated;
GRANT SELECT ON public.re_follow_up_jobs TO authenticated;

GRANT ALL ON public.re_lead_source_configs TO service_role;
GRANT ALL ON public.re_ingest_events TO service_role;
GRANT ALL ON public.re_follow_up_rules TO service_role;
GRANT ALL ON public.re_follow_up_jobs TO service_role;
