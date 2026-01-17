-- Create dedicated table for form audit/history logs
CREATE TABLE public.form_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  form_id UUID REFERENCES public.forms(id) ON DELETE SET NULL,
  form_name TEXT,
  field_id UUID,
  field_label TEXT,
  description TEXT,
  changes JSONB,
  metadata JSONB,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.form_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all form audit logs in their organization
CREATE POLICY "Admins can view all form audit logs"
ON public.form_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Users can view their own form audit logs
CREATE POLICY "Users can view their own form audit logs"
ON public.form_audit_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Authenticated users can insert their own logs
CREATE POLICY "Users can insert their own form audit logs"
ON public.form_audit_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_form_audit_logs_user_id ON public.form_audit_logs(user_id);
CREATE INDEX idx_form_audit_logs_form_id ON public.form_audit_logs(form_id);
CREATE INDEX idx_form_audit_logs_event_type ON public.form_audit_logs(event_type);
CREATE INDEX idx_form_audit_logs_created_at ON public.form_audit_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE public.form_audit_logs IS 'Dedicated audit trail for form-related operations, independent from general audit logs';