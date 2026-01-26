-- Drop the existing constraint and recreate with query-chart included
ALTER TABLE public.report_components DROP CONSTRAINT IF EXISTS report_components_type_check;

ALTER TABLE public.report_components ADD CONSTRAINT report_components_type_check 
CHECK (type = ANY (ARRAY['chart'::text, 'metric-card'::text, 'table'::text, 'text'::text, 'spacer'::text, 'form-submissions'::text, 'dynamic-table'::text, 'query-chart'::text]));