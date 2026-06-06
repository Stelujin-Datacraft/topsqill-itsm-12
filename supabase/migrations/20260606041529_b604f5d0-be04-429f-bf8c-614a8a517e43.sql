CREATE OR REPLACE FUNCTION public.can_act_for_submission(_delegator uuid, _submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.record_delegations d
    JOIN public.form_submissions s ON s.id = _submission_id
    WHERE d.delegate_user_id = auth.uid()
      AND d.delegator_user_id = _delegator
      AND d.active = true
      AND d.scope::text = 'submission'
      AND d.scope_submission_id = _submission_id
      AND now() BETWEEN d.starts_at AND d.ends_at
      AND (
        d.grant_delegator_access
        OR public.can_access_form(s.form_id, auth.uid())
      )
  );
$$;

NOTIFY pgrst, 'reload schema';