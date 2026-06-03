
-- P1: Delegation-aware authority via can_act_for() helper + additive RLS policies
-- Safe by design: time-bound, scope-bound, fully audited, never escalates beyond delegator's own access.

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
        OR (d.scope = 'form'    AND _form_id    IS NOT NULL AND d.scope_form_id    = _form_id)
        OR (d.scope = 'project' AND _project_id IS NOT NULL AND d.scope_project_id = _project_id)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_act_for(uuid, uuid, uuid) TO authenticated;

-- Additive SELECT policy: delegate can read delegator's submissions while delegation is active and scope matches
DROP POLICY IF EXISTS "Delegates can view delegator submissions" ON public.form_submissions;
CREATE POLICY "Delegates can view delegator submissions"
ON public.form_submissions
FOR SELECT
TO authenticated
USING (
  submitted_by IS NOT NULL
  AND public.can_act_for(
    (submitted_by)::uuid,
    form_id,
    (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_submissions.form_id AND f.project_id IS NOT NULL))::text::uuid
  ) OR public.can_act_for((submitted_by)::uuid, form_id, NULL)
  OR public.can_act_for(
    (submitted_by)::uuid,
    NULL,
    (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id)
  )
);

-- Additive UPDATE policy: delegate can update delegator's submissions while delegation is active and scope matches
DROP POLICY IF EXISTS "Delegates can update delegator submissions" ON public.form_submissions;
CREATE POLICY "Delegates can update delegator submissions"
ON public.form_submissions
FOR UPDATE
TO authenticated
USING (
  submitted_by IS NOT NULL
  AND (
    public.can_act_for((submitted_by)::uuid, form_id, NULL)
    OR public.can_act_for(
      (submitted_by)::uuid,
      NULL,
      (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id)
    )
  )
)
WITH CHECK (
  submitted_by IS NOT NULL
  AND (
    public.can_act_for((submitted_by)::uuid, form_id, NULL)
    OR public.can_act_for(
      (submitted_by)::uuid,
      NULL,
      (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id)
    )
  )
);

NOTIFY pgrst, 'reload schema';
