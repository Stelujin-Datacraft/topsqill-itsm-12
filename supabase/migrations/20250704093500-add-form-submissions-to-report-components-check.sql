-- Update the check constraint on report_components table to include 'form-submissions' component type
-- First, find and drop any existing type check constraints
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name 
    FROM pg_constraint 
    WHERE conrelid = 'report_components'::regclass 
    AND contype = 'c' 
    AND consrc LIKE '%type%IN%';
    
    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE report_components DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Add the updated constraint that includes 'form-submissions'
ALTER TABLE report_components ADD CONSTRAINT report_components_type_check 
CHECK (type IN ('chart', 'table', 'metric-card', 'text', 'spacer', 'form-submissions', 'dynamic-table'));