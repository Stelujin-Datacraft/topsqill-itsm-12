import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ActionExecutors } from './workflow/actionExecutors';
import { RecordActionExecutors } from './workflow/recordActionExecutors';

export interface NodeExecutionContext {
  executionId: string;
  workflowId: string;
  nodeId: string;
  config: any;
  triggerData: any;
  submissionId?: string;
  submitterId?: string;
}

export interface NodeExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  nextNodeIds?: string[];
}

export class NodeActions {
  static async executeStartNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    console.log('🚀 Executing start node:', context.nodeId);
    
    try {
      const output = {
        message: 'Workflow started successfully',
        triggerData: context.triggerData,
        startedAt: new Date().toISOString()
      };

      const nextNodeIds = await this.getNextNodes(context.workflowId, context.nodeId);

      return {
        success: true,
        output,
        nextNodeIds
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Start node execution failed'
      };
    }
  }

  static async executeActionNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    console.log('🎯 EXECUTING ACTION NODE:', context.nodeId);
    console.log('📋 Full action node context:', {
      executionId: context.executionId,
      workflowId: context.workflowId,
      nodeId: context.nodeId,
      config: JSON.stringify(context.config, null, 2),
      submissionId: context.submissionId,
      submitterId: context.submitterId,
      triggerDataKeys: Object.keys(context.triggerData || {})
    });
    
    try {
      const config = context.config;
      
      // Enhanced action type detection with multiple fallbacks
      let actionType = config.actionType || 
                      config.action_type || 
                      config.type ||
                      (config.data && config.data.actionType);

      console.log('🔧 ACTION TYPE DETECTION:', {
        fromConfig: config.actionType,
        fromConfigSnake: config.action_type,
        fromType: config.type,
        fromData: config.data?.actionType,
        finalActionType: actionType,
        configKeys: Object.keys(config)
      });

      if (!actionType) {
        console.error('❌ NO ACTION TYPE FOUND IN CONFIG');
        console.error('📋 Available config keys:', Object.keys(config));
        console.error('📋 Full config:', JSON.stringify(config, null, 2));
        
        return {
          success: false,
          error: 'No action type specified in node configuration',
          nextNodeIds: await this.getNextNodes(context.workflowId, context.nodeId)
        };
      }

      console.log('🔧 PROCESSING ACTION TYPE:', actionType);

      let actionResult: any;
      const actionStartTime = Date.now();

      // Execute the specific action using the new action executors
      switch (actionType) {
        case 'assign_form':
          console.log('📝 EXECUTING ASSIGN_FORM ACTION');
          actionResult = await ActionExecutors.executeAssignFormAction(context);
          break;
        case 'approve_form':
          console.log('✅ EXECUTING APPROVE_FORM ACTION');
          actionResult = await ActionExecutors.executeApproveFormAction(context);
          break;
        case 'update_form_lifecycle_status':
          console.log('🔄 EXECUTING UPDATE_FORM_LIFECYCLE_STATUS ACTION');
          actionResult = await ActionExecutors.executeUpdateFormLifecycleStatusAction(context);
          break;
        case 'send_notification':
          console.log('🔔 EXECUTING SEND_NOTIFICATION ACTION');
          actionResult = await ActionExecutors.executeSendNotificationAction(context);
          break;
        case 'change_field_value':
          console.log('🔧 EXECUTING CHANGE_FIELD_VALUE ACTION');
          actionResult = await RecordActionExecutors.executeChangeFieldValueAction(context);
          break;
        case 'change_record_status':
          console.log('🔄 EXECUTING CHANGE_RECORD_STATUS ACTION');
          actionResult = await RecordActionExecutors.executeChangeRecordStatusAction(context);
          break;
        case 'create_record':
          console.log('➕ EXECUTING CREATE_RECORD ACTION');
          actionResult = await RecordActionExecutors.executeCreateRecordAction(context);
          break;
        default:
          console.error(`❌ UNKNOWN ACTION TYPE: ${actionType}`);
          return {
            success: false,
            error: `Unknown action type: ${actionType}`,
            nextNodeIds: await this.getNextNodes(context.workflowId, context.nodeId)
          };
      }

      const actionEndTime = Date.now();
      const actionDuration = actionEndTime - actionStartTime;

      console.log('📊 ACTION EXECUTION COMPLETED:', { 
        actionType, 
        success: actionResult.success,
        duration: `${actionDuration}ms`,
        output: actionResult.output,
        error: actionResult.error
      });

      // Log the action details for debugging
      if (actionResult.actionDetails) {
        console.log('📝 ACTION DETAILS:', JSON.stringify(actionResult.actionDetails, null, 2));
      }

      const nextNodeIds = await this.getNextNodes(context.workflowId, context.nodeId);

      return {
        success: actionResult.success,
        output: actionResult.output || {
          actionType,
          result: actionResult.success ? 'completed' : 'failed',
          duration: actionDuration
        },
        nextNodeIds,
        error: actionResult.error
      };
    } catch (error) {
      console.error('❌ ACTION NODE EXECUTION FAILED:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Action execution failed',
        nextNodeIds: await this.getNextNodes(context.workflowId, context.nodeId)
      };
    }
  }

  private static async executeAssignFormAction(context: NodeExecutionContext) {
    console.log('📝 EXECUTING ASSIGN FORM ACTION');
    console.log('🔧 Assignment context:', JSON.stringify(context.config, null, 2));
    
    const config = context.config;
    
    // Validate required configuration
    if (!config.targetFormId) {
      console.error('❌ NO TARGET FORM ID PROVIDED');
      return {
        output: { actionType: 'assign_form', result: 'failed', error: 'No target form ID configured' },
        result: { success: false, error: 'No target form ID configured' }
      };
    }

    // Get assignment configuration - default to form_submitter if not provided
    let assignmentConfig = config.assignmentConfig;
    if (!assignmentConfig || !assignmentConfig.type) {
      console.log('⚠️ NO ASSIGNMENT CONFIG FOUND, DEFAULTING TO FORM_SUBMITTER');
      assignmentConfig = { type: 'form_submitter' };
    }
    
    console.log('📝 ASSIGNMENT CONFIG:', JSON.stringify(assignmentConfig, null, 2));
    console.log('📋 TRIGGER DATA AVAILABLE:', JSON.stringify(context.triggerData, null, 2));

    try {
      let assignedToUserId = null;
      let assignedToEmail = null;

      if (assignmentConfig.type === 'form_submitter') {
        console.log('👤 ASSIGNING TO FORM SUBMITTER');
        assignedToUserId = context.submitterId;
        
        // Try multiple sources for user email
        assignedToEmail = context.triggerData?.userEmail || 
                         context.triggerData?.email ||
                         context.triggerData?.submissionData?.email;
        
        console.log('📧 EMAIL RESOLUTION:', {
          submitterId: assignedToUserId,
          userEmail: context.triggerData?.userEmail,
          email: context.triggerData?.email,
          submissionEmail: context.triggerData?.submissionData?.email,
          finalEmail: assignedToEmail
        });
        
        // If no email found but we have submitter ID, look up user profile
        if (!assignedToEmail && assignedToUserId) {
          console.log('🔍 LOOKING UP USER EMAIL FROM PROFILE');
          const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('id', assignedToUserId)
            .single();
          
          if (profileError) {
            console.error('❌ ERROR LOOKING UP USER PROFILE:', profileError);
          } else if (userProfile) {
            assignedToEmail = userProfile.email;
            console.log('✅ FOUND USER EMAIL FROM PROFILE:', assignedToEmail);
          }
        }
        
      } else if (assignmentConfig.type === 'email') {
        console.log('📧 ASSIGNING TO SPECIFIC EMAIL');
        assignedToEmail = assignmentConfig.email;
        
        // Try to find user by email
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', assignedToEmail)
          .single();
        
        if (!profileError && userProfile) {
          assignedToUserId = userProfile.id;
          console.log('✅ FOUND USER ID FOR EMAIL ASSIGNMENT:', assignedToUserId);
        }
      }

      console.log('👤 FINAL ASSIGNMENT TARGET:', {
        assignedToUserId,
        assignedToEmail,
        assignmentType: assignmentConfig.type
      });

      // Validate we have minimum required data
      if (!assignedToEmail) {
        const errorMsg = `No email found for assignment. Available data: submitterId=${context.submitterId}, triggerData keys=${Object.keys(context.triggerData || {})}`;
        console.error('❌ ASSIGNMENT VALIDATION FAILED:', errorMsg);
        
        return {
          output: { 
            actionType: 'assign_form', 
            result: 'failed', 
            error: errorMsg,
            targetFormId: config.targetFormId
          },
          result: { success: false, error: errorMsg }
        };
      }

      // Create form assignment
      const assignmentData = {
        form_id: config.targetFormId,
        assigned_to_user_id: assignedToUserId,
        assigned_to_email: assignedToEmail,
        assigned_by_user_id: context.submitterId,
        assignment_type: 'workflow',
        workflow_execution_id: context.executionId,
        status: 'pending',
        notes: `Assigned via workflow: ${config.targetFormName || 'Form'}`
      };

      console.log('💾 CREATING FORM ASSIGNMENT:', JSON.stringify(assignmentData, null, 2));

      const { data: assignment, error: assignmentError } = await supabase
        .from('form_assignments')
        .insert(assignmentData)
        .select()
        .single();

      if (assignmentError) {
        console.error('❌ ERROR CREATING FORM ASSIGNMENT:', assignmentError);
        const errorMsg = `Failed to create form assignment: ${assignmentError.message}`;
        
        return {
          output: { 
            actionType: 'assign_form', 
            result: 'failed', 
            error: errorMsg,
            targetFormId: config.targetFormId
          },
          result: { success: false, error: errorMsg }
        };
      }

      console.log('✅ FORM ASSIGNMENT CREATED SUCCESSFULLY:', assignment);

      // Create notification
      let notificationCreated = false;
      if (assignedToUserId) {
        try {
          const notificationData = {
            user_id: assignedToUserId,
            type: 'form_assignment',
            title: 'New Form Assignment',
            message: `You have been assigned to work on form: ${config.targetFormName || 'Form'}`,
            data: {
              form_id: config.targetFormId,
              form_name: config.targetFormName,
              workflow_execution_id: context.executionId,
              assignment_id: assignment.id,
              action_required: true
            }
          };

          console.log('💾 CREATING NOTIFICATION:', JSON.stringify(notificationData, null, 2));

          const { data: notification, error: notificationError } = await supabase
            .from('notifications')
            .insert(notificationData)
            .select()
            .single();

          if (notificationError) {
            console.error('❌ ERROR CREATING NOTIFICATION:', notificationError);
          } else {
            console.log('✅ NOTIFICATION CREATED SUCCESSFULLY:', notification);
            notificationCreated = true;
          }
        } catch (notificationError) {
          console.error('❌ NOTIFICATION CREATION FAILED:', notificationError);
        }
      }

      const result = {
        success: true,
        assignment: assignment,
        assignedTo: assignedToEmail,
        assignedUserId: assignedToUserId,
        notificationCreated,
        assignmentId: assignment.id,
        message: `Form ${config.targetFormName || 'form'} assigned to ${assignedToEmail}`
      };

      const output = {
        actionType: 'assign_form',
        targetFormId: config.targetFormId,
        assignedTo: assignedToEmail,
        assignmentId: assignment.id,
        success: true
      };

      console.log('🎉 ASSIGNMENT COMPLETED SUCCESSFULLY:', result);

      return { output, result };
    } catch (error) {
      console.error('❌ FORM ASSIGNMENT FAILED:', error);
      const errorMsg = error instanceof Error ? error.message : 'Form assignment failed';
      
      const result = {
        success: false,
        error: errorMsg,
        assignmentType: assignmentConfig.type,
        targetFormId: config.targetFormId
      };

      return { 
        output: { 
          actionType: 'assign_form', 
          result: 'failed', 
          error: errorMsg,
          targetFormId: config.targetFormId
        }, 
        result 
      };
    }
  }

  private static async executeApproveFormAction(context: NodeExecutionContext) {
    console.log('✅ Executing approve form action');
    
    try {
      const config = context.config;
      const { data, error } = await supabase
        .from('forms')
        .update({ status: 'approved' })
        .eq('id', config.targetFormId)
        .select();

      if (error) throw error;

      const result = {
        success: true,
        updatedForm: data?.[0],
        message: `Form ${config.targetFormName} has been approved`
      };

      const output = {
        actionType: 'approve_form',
        targetFormId: config.targetFormId,
        result: 'approved'
      };

      return { output, result };
    } catch (error) {
      const result = {
        success: false,
        error: error instanceof Error ? error.message : 'Form approval failed'
      };

      return { 
        output: { actionType: 'approve_form', result: 'failed' }, 
        result 
      };
    }
  }

  private static async executeUpdateFormStatusAction(context: NodeExecutionContext) {
    console.log('🔄 Executing update form status action');
    
    try {
      const config = context.config;
      const { data, error } = await supabase
        .from('forms')
        .update({ status: config.newStatus })
        .eq('id', config.targetFormId)
        .select();

      if (error) throw error;

      const result = {
        success: true,
        updatedForm: data?.[0],
        message: `Form ${config.targetFormName} status updated to ${config.newStatus}`
      };

      const output = {
        actionType: 'update_form_status',
        targetFormId: config.targetFormId,
        newStatus: config.newStatus
      };

      return { output, result };
    } catch (error) {
      const result = {
        success: false,
        error: error instanceof Error ? error.message : 'Form status update failed'
      };

      return { 
        output: { actionType: 'update_form_status', result: 'failed' }, 
        result 
      };
    }
  }

  private static async executeSendNotificationAction(context: NodeExecutionContext) {
    console.log('🔔 Executing send notification action');
    
    try {
      const config = context.config;
      const notificationConfig = config.notificationConfig || {};

      if (notificationConfig.type === 'in_app' || !notificationConfig.type) {
        await this.sendInAppNotification(
          context.submitterId || context.triggerData.submittedBy,
          notificationConfig.message || 'Workflow notification',
          notificationConfig.subject || 'Workflow Update'
        );
      }

      const result = {
        success: true,
        notificationType: notificationConfig.type,
        recipient: context.triggerData.userEmail,
        message: 'Notification sent successfully'
      };

      const output = {
        actionType: 'send_notification',
        notificationType: notificationConfig.type,
        sent: true
      };

      return { output, result };
    } catch (error) {
      const result = {
        success: false,
        error: error instanceof Error ? error.message : 'Notification sending failed'
      };

      return { 
        output: { actionType: 'send_notification', result: 'failed' }, 
        result 
      };
    }
  }

  static async executeNotificationNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    console.log('🔔 Executing notification node:', context.nodeId);
    
    try {
      const config = context.config;
      const notificationConfig = config.notificationConfig || {};

      if (notificationConfig.type === 'in_app' || !notificationConfig.type) {
        await this.sendInAppNotification(
          context.submitterId || context.triggerData.submittedBy,
          notificationConfig.message || 'Workflow notification',
          notificationConfig.subject || 'Workflow Update'
        );
      }

      const nextNodeIds = await this.getNextNodes(context.workflowId, context.nodeId);

      return {
        success: true,
        output: {
          notificationType: notificationConfig.type,
          recipients: notificationConfig.recipients,
          message: notificationConfig.message
        },
        nextNodeIds
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Notification execution failed'
      };
    }
  }

  static async executeConditionNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    console.log('🔍 Executing condition node:', context.nodeId);
    
    try {
      const config = context.config;
      const condition = config.condition;

      if (!condition) {
        throw new Error('No condition configured for condition node');
      }

      const conditionMet = this.evaluateCondition(condition, context.triggerData);
      
      const nextNodeIds = await this.getNextNodes(
        context.workflowId, 
        context.nodeId, 
        conditionMet ? 'true' : 'false'
      );

      return {
        success: true,
        output: {
          conditionMet,
          condition,
          evaluatedValue: this.getFieldValue(condition.fieldPath, context.triggerData)
        },
        nextNodeIds
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Condition evaluation failed'
      };
    }
  }

  static async executeWaitNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    console.log('⏱️ Executing wait node:', context.nodeId);
    
    try {
      const config = context.config;
      const waitDuration = config.waitDuration || 1;
      const waitUnit = config.waitUnit || 'minutes';

      console.log(`⏳ Wait configured for ${waitDuration} ${waitUnit}`);

      const nextNodeIds = await this.getNextNodes(context.workflowId, context.nodeId);

      return {
        success: true,
        output: {
          waitDuration,
          waitUnit,
          message: `Waited for ${waitDuration} ${waitUnit}`
        },
        nextNodeIds
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Wait node execution failed'
      };
    }
  }

  static async executeEndNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    console.log('🏁 Executing end node:', context.nodeId);
    
    try {
      return {
        success: true,
        output: {
          message: 'Workflow completed successfully',
          completedAt: new Date().toISOString()
        },
        nextNodeIds: []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'End node execution failed'
      };
    }
  }

  private static async sendInAppNotification(userId: string, message: string, title: string) {
    if (!userId) return;
    
    console.log('📱 Sending in-app notification:', { userId, title, message });
    
    toast({
      title,
      description: message,
    });
  }

  private static evaluateCondition(condition: any, triggerData: any): boolean {
    const fieldValue = this.getFieldValue(condition.fieldPath, triggerData);
    const expectedValue = condition.value;
    const operator = condition.operator;

    switch (operator) {
      case '==':
        return fieldValue === expectedValue;
      case '!=':
        return fieldValue !== expectedValue;
      case '>':
        return Number(fieldValue) > Number(expectedValue);
      case '<':
        return Number(fieldValue) < Number(expectedValue);
      case '>=':
        return Number(fieldValue) >= Number(expectedValue);
      case '<=':
        return Number(fieldValue) <= Number(expectedValue);
      case 'contains':
        return String(fieldValue).includes(String(expectedValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(expectedValue));
      default:
        return false;
    }
  }

  private static getFieldValue(fieldPath: string, data: any): any {
    const keys = fieldPath.split('.');
    let value = data;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private static async getNextNodes(workflowId: string, currentNodeId: string, condition?: string): Promise<string[]> {
    try {
      const { data: connections, error } = await supabase
        .from('workflow_connections')
        .select('target_node_id, condition_type')
        .eq('workflow_id', workflowId)
        .eq('source_node_id', currentNodeId);

      if (error) {
        console.error('❌ Error getting next nodes:', error);
        return [];
      }

      const filteredConnections = connections?.filter(conn => {
        if (!condition) return true;
        return !conn.condition_type || conn.condition_type === condition || conn.condition_type === 'default';
      }) || [];

      return filteredConnections.map(conn => conn.target_node_id);
    } catch (error) {
      console.error('❌ Error getting next nodes:', error);
      return [];
    }
  }
}
