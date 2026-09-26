-- =============================================
-- OUTBOUND CONNECTORS — third-party app credentials
-- =============================================

CREATE TABLE IF NOT EXISTS public.outbound_connectors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    provider TEXT NOT NULL DEFAULT 'generic_http',
    mode TEXT NOT NULL DEFAULT 'batch'
      CHECK (mode IN ('realtime', 'batch')),
    base_url TEXT,
    auth_type TEXT NOT NULL DEFAULT 'api_key'
      CHECK (auth_type IN ('api_key', 'basic', 'bearer', 'oauth_client', 'custom')),
    credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
    headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule_cron TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_connectors_org
  ON public.outbound_connectors(organization_id);
CREATE INDEX IF NOT EXISTS idx_outbound_connectors_project
  ON public.outbound_connectors(project_id);
CREATE INDEX IF NOT EXISTS idx_outbound_connectors_active
  ON public.outbound_connectors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_outbound_connectors_provider
  ON public.outbound_connectors(provider);

ALTER TABLE public.outbound_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view outbound connectors"
ON public.outbound_connectors FOR SELECT
TO authenticated
USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

CREATE POLICY "Admins can create outbound connectors"
ON public.outbound_connectors FOR INSERT
TO authenticated
WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

CREATE POLICY "Admins can update outbound connectors"
ON public.outbound_connectors FOR UPDATE
TO authenticated
USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

CREATE POLICY "Admins can delete outbound connectors"
ON public.outbound_connectors FOR DELETE
TO authenticated
USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

CREATE OR REPLACE FUNCTION public.update_outbound_connectors_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_outbound_connectors_updated_at ON public.outbound_connectors;
CREATE TRIGGER update_outbound_connectors_updated_at
  BEFORE UPDATE ON public.outbound_connectors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_outbound_connectors_updated_at();
