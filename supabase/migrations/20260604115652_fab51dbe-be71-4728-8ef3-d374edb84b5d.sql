
-- 1. Extend enum (must be committed before literal cast usage; we avoid literal casts by using ::text comparisons)
ALTER TYPE public.delegation_scope ADD VALUE IF NOT EXISTS 'submission';

-- 2. Column to hold the specific submission
ALTER TABLE public.record_delegations
  ADD COLUMN IF NOT EXISTS scope_submission_id uuid REFERENCES public.form_submissions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_record_delegations_scope_submission
  ON public.record_delegations(scope_submission_id) WHERE scope_submission_id IS NOT NULL;

-- 3. Submission-scope helper (uses ::text to avoid enum literal cast in same migration)
CREATE OR REPLACE FUNCTION public.can_act_for_submission(_delegator uuid, _submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.record_delegations d
    WHERE d.delegate_user_id = auth.uid()
      AND d.delegator_user_id = _delegator
      AND d.active = true
      AND d.scope::text = 'submission'
      AND d.scope_submission_id = _submission_id
      AND now() BETWEEN d.starts_at AND d.ends_at
  );
$$;

-- 4. Extend existing delegate policies on form_submissions to honor submission scope
DROP POLICY IF EXISTS "Delegates can view delegator submissions" ON public.form_submissions;
CREATE POLICY "Delegates can view delegator submissions"
ON public.form_submissions FOR SELECT
USING (
  submitted_by IS NOT NULL AND (
    public.can_act_for(submitted_by::uuid, form_id, NULL::uuid)
    OR public.can_act_for(submitted_by::uuid, NULL::uuid, (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id))
    OR public.can_act_for_submission(submitted_by::uuid, id)
  )
);

DROP POLICY IF EXISTS "Delegates can update delegator submissions" ON public.form_submissions;
CREATE POLICY "Delegates can update delegator submissions"
ON public.form_submissions FOR UPDATE
USING (
  submitted_by IS NOT NULL AND (
    public.can_act_for(submitted_by::uuid, form_id, NULL::uuid)
    OR public.can_act_for(submitted_by::uuid, NULL::uuid, (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id))
    OR public.can_act_for_submission(submitted_by::uuid, id)
  )
)
WITH CHECK (
  submitted_by IS NOT NULL AND (
    public.can_act_for(submitted_by::uuid, form_id, NULL::uuid)
    OR public.can_act_for(submitted_by::uuid, NULL::uuid, (SELECT f.project_id FROM public.forms f WHERE f.id = form_submissions.form_id))
    OR public.can_act_for_submission(submitted_by::uuid, id)
  )
);

NOTIFY pgrst, 'reload schema';
