
export type NodeType = 
  | 'start'
  | 'form-assignment'
  | 'form-approval'
  | 'notification'
  | 'condition'
  | 'wait'
  | 'action'
  | 'approval'
  | 'end';

export type TriggerType = 
  | 'form_submission'
  | 'form_completion'
  | 'form_approval'
  | 'form_rejection'
  | 'rule_success'
  | 'rule_failure'
  | 'manual'
  | 'webhook'
  | 'schedule';

export type ActionType = 
  | 'assign_form'
  | 'approve_form'
  | 'disapprove_form'
  | 'send_email'
  | 'send_notification'
  | 'send_sms'
  | 'trigger_webhook'
  | 'change_form_status'
  | 'set_field_values'
  | 'log_event'
  | 'update_workflow_variable'
  | 'wait_for_completion'
  | 'change_field_value'
  | 'change_record_status';

export type ConditionOperator = '==' | '!=' | '<' | '>' | '<=' | '>=' | 'contains' | 'in' | 'not_in' | 'exists' | 'not_exists';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  data: {
    config?: any;
    // Trigger configuration
    triggerType?: TriggerType;
    triggerFormId?: string;
    triggerFormName?: string;
    // Action configuration
    actionType?: ActionType;
    targetFormId?: string;
    targetFormName?: string;
    assignToUserId?: string;
    assignToUserEmail?: string;
    assignToFieldPath?: string; // e.g., "email" to extract from form data
    // Status and approval
    newStatus?: string;
    approvalMessage?: string;
    rejectionMessage?: string;
    // Wait configuration
    waitDuration?: number;
    waitUnit?: 'minutes' | 'hours' | 'days';
    waitForCompletion?: boolean;
    // Condition configuration
    condition?: {
      fieldPath: string; // e.g., "age" or "user.email"
      operator: ConditionOperator;
      value: string | number;
      sourceFormId?: string;
    };
    // Notification configuration
    notificationConfig?: {
      type: 'email' | 'sms' | 'in_app' | 'webhook';
      message: string;
      recipients?: string[];
      recipientFieldPath?: string; // extract from form data
      subject?: string;
      webhookUrl?: string;
    };
    // Field value updates
    fieldUpdates?: Array<{
      fieldPath: string;
      value: string | number | boolean;
      targetFormId?: string;
    }>;
    // Webhook configuration
    webhookConfig?: {
      url: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      payload?: Record<string, any>;
    };
    // Variables
    workflowVariables?: Record<string, any>;
  };
}

export interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  status: 'draft' | 'active' | 'inactive';
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentNodeId?: string;
  triggerData: any;
  executionData: any;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}
