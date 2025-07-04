
-- Add custom_config column to form_fields table
ALTER TABLE public.form_fields 
ADD COLUMN custom_config jsonb DEFAULT NULL;
