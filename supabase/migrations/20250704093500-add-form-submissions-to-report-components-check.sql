-- Update the check constraint on report_components table to include 'form-submissions' component type
ALTER TABLE report_components DROP CONSTRAINT IF EXISTS report_components_type_check;

-- Add the updated constraint that includes 'form-submissions'
ALTER TABLE report_components ADD CONSTRAINT report_components_type_check 
CHECK (type IN ('chart', 'table', 'metric-card', 'text', 'spacer', 'form-submissions', 'dynamic-table'));