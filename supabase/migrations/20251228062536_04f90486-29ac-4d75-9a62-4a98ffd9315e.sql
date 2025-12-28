-- Create table for lifecycle stage history
CREATE TABLE public.lifecycle_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  field_id UUID NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES public.user_profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  comment TEXT,
  duration_in_previous_stage INTERVAL
);

-- Enable RLS
ALTER TABLE public.lifecycle_stage_history ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_lifecycle_stage_history_submission ON public.lifecycle_stage_history(submission_id);
CREATE INDEX idx_lifecycle_stage_history_field ON public.lifecycle_stage_history(field_id);
CREATE INDEX idx_lifecycle_stage_history_changed_at ON public.lifecycle_stage_history(changed_at DESC);

-- RLS policies - users can view history for submissions they have access to
CREATE POLICY "Users can view lifecycle history for accessible submissions"
ON public.lifecycle_stage_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.form_submissions fs
    JOIN public.forms f ON fs.form_id = f.id
    JOIN public.project_users pu ON f.project_id = pu.project_id
    WHERE fs.id = lifecycle_stage_history.submission_id
    AND pu.user_id = auth.uid()
  )
);

-- Users can insert history for submissions they can edit
CREATE POLICY "Users can create lifecycle history"
ON public.lifecycle_stage_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.form_submissions fs
    JOIN public.forms f ON fs.form_id = f.id
    JOIN public.project_users pu ON f.project_id = pu.project_id
    WHERE fs.id = lifecycle_stage_history.submission_id
    AND pu.user_id = auth.uid()
    AND pu.role IN ('admin', 'editor')
  )
);