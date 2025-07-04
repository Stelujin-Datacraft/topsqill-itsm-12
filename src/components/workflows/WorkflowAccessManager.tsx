
import React from 'react';
import { EnhancedWorkflowAccessManager } from './EnhancedWorkflowAccessManager';

interface WorkflowAccessManagerProps {
  workflowId: string;
  workflowName: string;
}

export function WorkflowAccessManager({ workflowId, workflowName }: WorkflowAccessManagerProps) {
  return <EnhancedWorkflowAccessManager workflowId={workflowId} workflowName={workflowName} />;
}
