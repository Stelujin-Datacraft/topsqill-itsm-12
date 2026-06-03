-- Record Delegation System
CREATE TYPE public.delegation_scope AS ENUM ('all', 'form', 'project');

CREATE TABLE public.record_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  delegator_user_id UUID NOT NULL,
  delegate_user_id UUID NOT NULL,
  scope public.delegation_scope NOT NULL DEFAULT 'all',
  scope_form_id UUID NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  scope_project_id UUID NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  include_approvals BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delegation_window_valid CHECK (ends_at > starts_at),
  CONSTRAINT delegation_not_self CHECK (delegator_user_id <> delegate_user_id),
  CONSTRAINT delegation_scope_consistency CHECK (
    (scope = 'all' AND scope_form_id IS NULL AND scope_project_id IS NULL) OR
    (scope = 'form' AND scope_form_id IS NOT NULL AND scope_project_id IS NULL) OR
    (scope = 'project' AND scope_project_id IS NOT NULL AND scope_form_id IS NULL)
  )
);

CREATE INDEX idx_record_delegations_delegate ON public.record_delegations(delegate_user_id) WHERE active = true;
CREATE INDEX idx_record_delegations_delegator ON public.record_delegations(delegator_user_id) WHERE active = true;
CREATE INDEX idx_record_delegations_org ON public.record_delegations(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_delegations TO authenticated;
GRANT ALL ON public.record_delegations TO service_role;

ALTER TABLE public.record_delegations ENABLE ROW LEVEL SECURITY;

-- Delegators manage their own
CREATE POLICY "Delegators manage their own delegations"
ON public.record_delegations
FOR ALL
USING (delegator_user_id = auth.uid())
WITH CHECK (delegator_user_id = auth.uid());

-- Delegates can view delegations granted to them
CREATE POLICY "Delegates can view their delegations"
ON public.record_delegations
FOR SELECT
USING (delegate_user_id = auth.uid());

-- Org admins manage all
CREATE POLICY "Org admins manage all delegations"
ON public.record_delegations
FOR ALL
USING (
  organization_id = public.get_user_org_id_cached()
  AND public.is_org_admin_cached()
)
WITH CHECK (
  organization_id = public.get_user_org_id_cached()
  AND public.is_org_admin_cached()
);

-- Updated_at trigger
CREATE TRIGGER update_record_delegations_updated_at
BEFORE UPDATE ON public.record_delegations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: list of users a given user is currently acting on behalf of
CREATE OR REPLACE FUNCTION public.get_active_delegators(
  _user_id UUID,
  _form_id UUID DEFAULT NULL,
  _project_id UUID DEFAULT NULL
)
RETURNS TABLE(delegator_user_id UUID, include_approvals BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT rd.delegator_user_id, bool_or(rd.include_approvals) AS include_approvals
  FROM public.record_delegations rd
  WHERE rd.delegate_user_id = _user_id
    AND rd.active = true
    AND now() BETWEEN rd.starts_at AND rd.ends_at
    AND (
      rd.scope = 'all'
      OR (rd.scope = 'form' AND _form_id IS NOT NULL AND rd.scope_form_id = _form_id)
      OR (rd.scope = 'project' AND _project_id IS NOT NULL AND rd.scope_project_id = _project_id)
    )
  GROUP BY rd.delegator_user_id;
$$;

NOTIFY pgrst, 'reload schema';