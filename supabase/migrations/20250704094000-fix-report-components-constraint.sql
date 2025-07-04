-- Debug and fix the report_components type constraint
-- First, let's see what constraints exist
DO $$ 
DECLARE
    constraint_record RECORD;
BEGIN
    -- List all check constraints on report_components table
    FOR constraint_record IN 
        SELECT conname, consrc 
        FROM pg_constraint 
        WHERE conrelid = 'report_components'::regclass 
        AND contype = 'c'
    LOOP
        RAISE NOTICE 'Constraint: % - Definition: %', constraint_record.conname, constraint_record.consrc;
    END LOOP;
END $$;

-- Drop ALL check constraints on the type column
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Find and drop all type-related constraints
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'report_components'::regclass 
        AND contype = 'c' 
        AND (consrc LIKE '%type%' OR conname LIKE '%type%')
    LOOP
        EXECUTE 'ALTER TABLE report_components DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Add the correct constraint with all supported types
ALTER TABLE report_components ADD CONSTRAINT report_components_type_check 
CHECK (type IN ('chart', 'table', 'metric-card', 'text', 'spacer', 'form-submissions', 'dynamic-table'));

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