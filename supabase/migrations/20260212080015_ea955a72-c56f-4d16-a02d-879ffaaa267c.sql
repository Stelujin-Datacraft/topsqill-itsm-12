
ALTER TABLE public.workflow_queue 
DROP CONSTRAINT workflow_queue_project_id_fkey;

ALTER TABLE public.workflow_queue 
ADD CONSTRAINT workflow_queue_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
