
import { ConditionConfig } from './conditions';

// Base workflow configuration types
export interface StartNodeConfig {
  trigger?: 'onSubmit' | 'onAccess' | 'onRulePass' | 'onRuleFailure';
  formId?: string;
  conditions?: WorkflowCondition[];
}

export interface AssignmentNodeConfig {
  formId?: string;
  assignTo?: 'user' | 'role' | 'group';
  waitForSubmission?: boolean;
  notifications?: {
    email?: boolean;
    platform?: boolean;
  };
  conditions?: WorkflowCondition[];
}

export interface ConditionNodeConfig {
  source?: 'current' | 'previous';
  conditions?: WorkflowCondition[];
  // Enhanced condition configuration
  conditionType?: 'if' | 'switch';
  conditionConfig?: ConditionConfig;
}

export interface ActionNodeConfig {
  actions?: WorkflowAction[];
  conditions?: WorkflowCondition[];
}

export interface EndNodeConfig {
  statusMessage?: string;
  finalFormStatus?: string;
  enableLogging?: boolean;
}

export interface WorkflowCondition {
  field: string;
  operator: '==' | '!=' | '<' | '>' | '<=' | '>=' | 'contains' | 'not_contains';
  value: string;
  logic?: 'AND' | 'OR';
}

export interface WorkflowAction {
  type: 'approve' | 'disapprove' | 'assign_form' | 'send_email' | 'send_notification' | 
        'send_sms' | 'webhook' | 'change_status' | 'set_field' | 'log_event' | 
        'update_variable' | 'start_subworkflow';
  config: Record<string, any>;
}

// Node execution status
export type NodeExecutionStatus = 'inactive' | 'active' | 'success' | 'failed' | 'waiting';

// Enhanced node data with execution tracking
export interface WorkflowNodeData {
  nodeType: string;
  label: string;
  description: string;
  status: NodeExecutionStatus;
  config: StartNodeConfig | AssignmentNodeConfig | ConditionNodeConfig | ActionNodeConfig | EndNodeConfig;
  executionHistory?: {
    startedAt?: string;
    completedAt?: string;
    error?: string;
    result?: any;
  }[];
  nextNodeId?: string;
  previousNodeId?: string;
  onConfigure: () => void;
  onDelete: () => void;
}
