-- Create table for tracking record/submission field changes
CREATE TABLE public.record_field_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  field_id UUID REFERENCES public.form_fields(id) ON DELETE SET NULL,
  field_label TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL DEFAULT 'updated' CHECK (change_type IN ('created', 'updated', 'deleted'))
);

-- Create indexes for efficient querying
CREATE INDEX idx_record_field_history_submission_id ON public.record_field_history(submission_id);
CREATE INDEX idx_record_field_history_changed_at ON public.record_field_history(changed_at DESC);
CREATE INDEX idx_record_field_history_field_id ON public.record_field_history(field_id);

-- Enable Row Level Security
ALTER TABLE public.record_field_history ENABLE ROW LEVEL SECURITY;

-- Create policy for reading history (users in same org can view)
CREATE POLICY "Users can view record history for their organization's submissions"
ON public.record_field_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.form_submissions fs
    JOIN public.forms f ON fs.form_id = f.id
    JOIN public.user_profiles up ON f.organization_id = up.organization_id
    WHERE fs.id = record_field_history.submission_id
    AND up.id = auth.uid()
  )
);

-- Create policy for inserting history (authenticated users)
CREATE POLICY "Authenticated users can insert record history"
ON public.record_field_history
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment for documentation
COMMENT ON TABLE public.record_field_history IS 'Tracks field-level changes to form submission records';