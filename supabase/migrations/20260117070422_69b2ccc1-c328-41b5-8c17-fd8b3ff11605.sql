-- Add form-related indexes to audit_logs for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON public.audit_logs(event_category);

-- Add a GIN index on metadata for JSONB queries (to filter by form_id in metadata)
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON public.audit_logs USING GIN(metadata);

-- Create a category value for form events
COMMENT ON TABLE public.audit_logs IS 'Stores audit events including form actions. Form events use event_category = form_management and store form_id in metadata.';