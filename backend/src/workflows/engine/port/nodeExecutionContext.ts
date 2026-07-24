// @ts-nocheck
export interface NodeExecutionContext {
  executionId: string;
  workflowId: string;
  nodeId: string;
  config: Record<string, unknown>;
  triggerData: Record<string, unknown>;
  submissionId?: string;
  submitterId?: string;
}

export interface NodeExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  nextNodeIds?: string[];
}
