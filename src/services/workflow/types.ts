
export interface WorkflowExecutionContext {
  executionId: string;
  workflowId: string;
  triggerData: any;
  submissionId?: string;
  submitterId?: string;
  formOwnerId?: string | null;
}

export interface NodeExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  nextNodeIds?: string[];
}
