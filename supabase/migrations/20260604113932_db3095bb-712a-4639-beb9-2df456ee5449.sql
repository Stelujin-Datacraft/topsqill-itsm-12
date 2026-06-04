
-- 1. Add toggle column (default true: trust the delegate within scope)
ALTER TABLE public.record_delegations
  ADD COLUMN IF NOT EXISTS grant_delegator_access boolean NOT NULL DEFAULT true;

-- 2. Update can_act_for to honor the new flag.
-- When grant_delegator_access = true  -> delegate inherits delegator's scope access (no own-access check)
-- When grant_delegator_access = false -> delegate must already have own access to the form/project
CREATE OR REPLACE FUNCTION public.can_act_for(_delegator uuid, _form_id uuid DEFAULT NULL::uuid, _project_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
          AND (d.grant_delegator_access OR public.can_access_form(_form_id, auth.uid()))
        )
        OR (
          d.scope = 'project'
          AND _project_id IS NOT NULL
          AND d.scope_project_id = _project_id
          AND (d.grant_delegator_access OR public.can_view_project(_project_id, auth.uid()))
        )
      )
  );
$function$;

-- 3. Add INSERT policy so delegates can create submissions on behalf of delegator
DROP POLICY IF EXISTS "Delegates can insert delegator submissions" ON public.form_submissions;
CREATE POLICY "Delegates can insert delegator submissions"
ON public.form_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by IS NOT NULL
  AND (
    can_act_for((submitted_by)::uuid, form_id, NULL::uuid)
    OR can_act_for((submitted_by)::uuid, NULL::uuid, (
      SELECT f.project_id FROM forms f WHERE f.id = form_submissions.form_id
    ))
  )
);

NOTIFY pgrst, 'reload schema';
