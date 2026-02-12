
-- Fix workflow_executions constraints to CASCADE
ALTER TABLE public.workflow_executions
DROP CONSTRAINT workflow_executions_trigger_submission_id_fkey;
ALTER TABLE public.workflow_executions
ADD CONSTRAINT workflow_executions_trigger_submission_id_fkey
FOREIGN KEY (trigger_submission_id) REFERENCES public.form_submissions(id) ON DELETE CASCADE;

ALTER TABLE public.workflow_executions
DROP CONSTRAINT workflow_executions_trigger_form_id_fkey;
ALTER TABLE public.workflow_executions
ADD CONSTRAINT workflow_executions_trigger_form_id_fkey
FOREIGN KEY (trigger_form_id) REFERENCES public.forms(id) ON DELETE CASCADE;

ALTER TABLE public.workflow_executions
DROP CONSTRAINT fk_workflow_executions_form_submission;
ALTER TABLE public.workflow_executions
ADD CONSTRAINT fk_workflow_executions_form_submission
FOREIGN KEY (form_submission_id) REFERENCES public.form_submissions(id) ON DELETE CASCADE;

ALTER TABLE public.workflow_queue
DROP CONSTRAINT workflow_queue_submission_id_fkey;
ALTER TABLE public.workflow_queue
ADD CONSTRAINT workflow_queue_submission_id_fkey
FOREIGN KEY (submission_id) REFERENCES public.form_submissions(id) ON DELETE CASCADE;

ALTER TABLE public.form_audit_logs
DROP CONSTRAINT form_audit_logs_form_id_fkey;
ALTER TABLE public.form_audit_logs
ADD CONSTRAINT form_audit_logs_form_id_fkey
FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;

-- Clean up orphaned records
DELETE FROM public.forms WHERE project_id NOT IN (SELECT id FROM public.projects);
DELETE FROM public.workflows WHERE project_id NOT IN (SELECT id FROM public.projects);
DELETE FROM public.dashboards WHERE project_id::uuid NOT IN (SELECT id FROM public.projects);

-- Add CASCADE FK for forms and workflows (already uuid type)
ALTER TABLE public.forms
ADD CONSTRAINT forms_project_id_fkey
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.workflows
ADD CONSTRAINT workflows_project_id_fkey
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Convert dashboards.project_id from text to uuid, then add FK
ALTER TABLE public.dashboards
ALTER COLUMN project_id TYPE uuid USING project_id::uuid;

ALTER TABLE public.dashboards
ADD CONSTRAINT dashboards_project_id_fkey
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
