ALTER TABLE public.record_delegations DROP CONSTRAINT delegation_scope_consistency;

ALTER TABLE public.record_delegations ADD CONSTRAINT delegation_scope_consistency CHECK (
  (scope::text = 'all' AND scope_form_id IS NULL AND scope_project_id IS NULL AND scope_submission_id IS NULL)
  OR (scope::text = 'form' AND scope_form_id IS NOT NULL AND scope_project_id IS NULL AND scope_submission_id IS NULL)
  OR (scope::text = 'project' AND scope_project_id IS NOT NULL AND scope_form_id IS NULL AND scope_submission_id IS NULL)
  OR (scope::text = 'submission' AND scope_submission_id IS NOT NULL AND scope_form_id IS NULL AND scope_project_id IS NULL)
);