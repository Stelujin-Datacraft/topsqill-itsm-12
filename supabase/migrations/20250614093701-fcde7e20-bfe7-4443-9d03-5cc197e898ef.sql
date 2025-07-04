
-- Add columns to workflow_instance_logs for better action tracking
ALTER TABLE workflow_instance_logs 
ADD COLUMN IF NOT EXISTS action_type text,
ADD COLUMN IF NOT EXISTS action_details jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS action_result jsonb DEFAULT '{}';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_instance_logs_execution_id 
ON workflow_instance_logs(execution_id);

CREATE INDEX IF NOT EXISTS idx_workflow_instance_logs_node_type 
ON workflow_instance_logs(node_type);

-- Add form_assignments table for tracking form assignments
CREATE TABLE IF NOT EXISTS form_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  assigned_to_user_id uuid,
  assigned_to_email text,
  assigned_by_user_id uuid,
  assignment_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  due_date timestamp with time zone,
  notes text,
  workflow_execution_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add RLS policies for form_assignments
ALTER TABLE form_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view form assignments in their org" ON form_assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM forms f
    JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_assignments.form_id 
    AND up.id = auth.uid()
  )
);

CREATE POLICY "Users can create form assignments in their org" ON form_assignments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms f
    JOIN user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_assignments.form_id 
    AND up.id = auth.uid()
  )
);

-- Add trigger to update updated_at column
CREATE OR REPLACE TRIGGER update_form_assignments_updated_at
BEFORE UPDATE ON form_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
