
-- Add source_handle and target_handle columns to workflow_connections table
ALTER TABLE public.workflow_connections 
ADD COLUMN IF NOT EXISTS source_handle text,
ADD COLUMN IF NOT EXISTS target_handle text;
