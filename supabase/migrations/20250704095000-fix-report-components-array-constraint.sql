-- Fix the report_components type constraint to include form-submissions and dynamic-table
-- The constraint uses ANY (ARRAY[...]) format, not IN (...)

-- Drop the existing constraint
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Find and drop the existing type constraint
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'report_components'::regclass 
        AND contype = 'c' 
        AND (consrc LIKE '%type%ANY%' OR consrc LIKE '%type%=%)
    LOOP
        EXECUTE 'ALTER TABLE report_components DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Add the updated constraint with all supported types
ALTER TABLE report_components ADD CONSTRAINT report_components_type_check 
CHECK (type = ANY (ARRAY['chart'::text, 'metric-card'::text, 'table'::text, 'text'::text, 'spacer'::text, 'form-submissions'::text, 'dynamic-table'::text]));

-- Verify the constraint was added
DO $$ 
DECLARE
    constraint_record RECORD;
BEGIN
    SELECT conname, consrc INTO constraint_record
    FROM pg_constraint 
    WHERE conrelid = 'report_components'::regclass 
    AND contype = 'c' 
    AND conname = 'report_components_type_check';
    
    IF FOUND THEN
        RAISE NOTICE 'New constraint added: % - Definition: %', constraint_record.conname, constraint_record.consrc;
    ELSE
        RAISE NOTICE 'ERROR: Constraint was not added successfully';
    END IF;
END $$;