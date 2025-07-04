
-- First, let's see what status values currently exist and update any invalid ones
UPDATE forms 
SET status = 'draft' 
WHERE status NOT IN ('draft', 'active', 'completed', 'approved', 'rejected', 'pending_review', 'in_progress', 'archived');

-- Now we can safely add the constraint
ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_status_check;

-- Add the updated constraint that includes all the statuses from FormStatusSelector
ALTER TABLE forms ADD CONSTRAINT forms_status_check 
CHECK (status IN ('draft', 'active', 'completed', 'approved', 'rejected', 'pending_review', 'in_progress', 'archived'));
