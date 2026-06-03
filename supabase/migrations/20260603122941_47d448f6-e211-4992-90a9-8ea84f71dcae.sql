
CREATE OR REPLACE FUNCTION public.can_act_for(
  _delegator uuid,
  _form_id uuid DEFAULT NULL,
  _project_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.record_delegations d
    WHERE d.delegate_user_id = auth.uid()
      AND d.delegator_user_id = _delegator
      AND d.active = true
      AND now() BETWEEN d.starts_at AND d.ends_at
      AND (
        d.scope = 'all'
        OR (
          d.scope = 'form'
          AND _form_id IS NOT NULL
          AND d.scope_form_id = _form_id
          AND public.can_access_form(_form_id, auth.uid())
        )
        OR (
          d.scope = 'project'
          AND _project_id IS NOT NULL
          AND d.scope_project_id = _project_id
          AND public.can_view_project(_project_id, auth.uid())
        )
      )
  );
$$;

NOTIFY pgrst, 'reload schema';
