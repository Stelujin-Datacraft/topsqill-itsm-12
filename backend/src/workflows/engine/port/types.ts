// @ts-nocheck

import type { WorkflowGraph } from './workflowGraph';

export type { WorkflowGraph };

export interface WorkflowExecutionContext {
  executionId: string;
  workflowId: string;
  triggerData: any;
  submissionId?: string;
  submitterId?: string;
  formOwnerId?: string | null;
  graph?: WorkflowGraph;
}

export interface NodeExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  nextNodeIds?: string[];
  isWaiting?: boolean;
}
