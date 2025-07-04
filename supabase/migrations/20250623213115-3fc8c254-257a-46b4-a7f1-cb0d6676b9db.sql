
-- Update the check constraint on workflow_nodes table to include 'approval' node type
ALTER TABLE workflow_nodes DROP CONSTRAINT IF EXISTS workflow_nodes_node_type_check;

-- Add the updated constraint that includes 'approval'
ALTER TABLE workflow_nodes ADD CONSTRAINT workflow_nodes_node_type_check 
CHECK (node_type IN ('start', 'form-assignment', 'form-approval', 'notification', 'condition', 'wait', 'action', 'approval', 'end'));
