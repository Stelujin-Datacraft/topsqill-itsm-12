
import { supabase } from '@/integrations/supabase/client';
import { WorkflowExecutionContext, NodeExecutionResult } from './types';
import { parseNodeConfig } from './utils';
import { NodeConnections } from './nodeConnections';
import { ActionExecutors } from './actionExecutors';
import { RecordActionExecutors } from './recordActionExecutors';
import { ConditionEvaluator } from './conditionEvaluator';
import { BranchDiscovery } from './branchDiscovery';
import { ConditionEvaluationContext, IfConditionConfig } from '@/types/conditions';

export class NodeExecutors {
  static async executeStartNode(nodeData: any, config: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    console.log('🚀 Executing start node - workflow triggered successfully');
    
    // Find next nodes connected from this start node using normal flow (no condition)
    const nextNodes = await NodeConnections.getNextNodes(context.workflowId, nodeData.id);
    
    console.log(`➡️ Found ${nextNodes.length} next nodes from start node:`, nextNodes);
    
    return {
      success: true,
      output: { 
        message: 'Workflow started successfully', 
        triggerData: context.triggerData,
        triggerType: config.triggerType,
        formId: context.triggerData.formId
      },
      nextNodeIds: nextNodes
    };
  }

  static async executeActionNode(nodeData: any, config: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    console.log('🎯 Executing action node with config:', config);
    
    try {
      let actionResult;
      
      // Convert WorkflowExecutionContext to NodeExecutionContext format
      const nodeContext = {
        executionId: context.executionId,
        workflowId: context.workflowId,
        nodeId: nodeData.id,
        config: config,
        triggerData: context.triggerData,
        submissionId: context.submissionId,
        submitterId: context.submitterId
      };

      switch (config.actionType) {
        case 'assign_form':
          console.log('📝 CALLING ActionExecutors.executeAssignFormAction');
          actionResult = await ActionExecutors.executeAssignFormAction(nodeContext);
          break;
        case 'approve_form':
          console.log('✅ CALLING ActionExecutors.executeApproveFormAction');
          actionResult = await ActionExecutors.executeApproveFormAction(nodeContext);
          break;
        case 'update_form_lifecycle_status':
          console.log('🔄 CALLING ActionExecutors.executeUpdateFormLifecycleStatusAction');
          actionResult = await ActionExecutors.executeUpdateFormLifecycleStatusAction(nodeContext);
          break;
        case 'send_notification':
          console.log('🔔 CALLING ActionExecutors.executeSendNotificationAction');
          actionResult = await ActionExecutors.executeSendNotificationAction(nodeContext);
          break;
        case 'change_field_value':
          console.log('🔧 CALLING RecordActionExecutors.executeChangeFieldValueAction');
          actionResult = await RecordActionExecutors.executeChangeFieldValueAction(nodeContext);
          break;
        case 'change_record_status':
          console.log('🔄 CALLING RecordActionExecutors.executeChangeRecordStatusAction');
          actionResult = await RecordActionExecutors.executeChangeRecordStatusAction(nodeContext);
          break;
        case 'create_record':
          console.log('➕ CALLING RecordActionExecutors.executeCreateRecordAction');
          actionResult = await RecordActionExecutors.executeCreateRecordAction(nodeContext);
          break;
        case 'create_linked_record':
          console.log('🔗 CALLING RecordActionExecutors.executeCreateLinkedRecordAction');
          actionResult = await RecordActionExecutors.executeCreateLinkedRecordAction(nodeContext);
          break;
        case 'update_linked_records':
          console.log('🔄 CALLING RecordActionExecutors.executeUpdateLinkedRecordsAction');
          actionResult = await RecordActionExecutors.executeUpdateLinkedRecordsAction(nodeContext);
          break;
        case 'create_combination_records':
          console.log('🔗✨ CALLING RecordActionExecutors.executeCreateCombinationRecordsAction');
          actionResult = await RecordActionExecutors.executeCreateCombinationRecordsAction(nodeContext);
          break;
        default:
          console.error(`❌ Unknown action type: ${config.actionType}`);
          actionResult = {
            success: false,
            error: `Unknown action type: ${config.actionType}`
          };
      }

      console.log('📊 ACTION EXECUTION RESULT:', actionResult);

      // Get next nodes using normal flow (no condition for action nodes)
      const nextNodes = await NodeConnections.getNextNodes(context.workflowId, nodeData.id);
      
      console.log(`🔍 Looking for next nodes from action node ${nodeData.id}, found:`, nextNodes);
      
      return {
        success: actionResult.success,
        output: actionResult.output || { action: config.actionType, executed: actionResult.success },
        error: actionResult.error,
        nextNodeIds: nextNodes
      };
    } catch (error) {
      console.error('❌ Action node execution failed:', error);
      // Even on error, get next nodes to continue flow
      const nextNodes = await NodeConnections.getNextNodes(context.workflowId, nodeData.id);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Action execution failed',
        nextNodeIds: nextNodes
      };
    }
  }

  static async executeApprovalNode(nodeData: any, config: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    console.log('✅ Executing approval node with config:', config);
    
    try {
      // Convert WorkflowExecutionContext to NodeExecutionContext format for approval action
      const nodeContext = {
        executionId: context.executionId,
        workflowId: context.workflowId,
        nodeId: nodeData.id,
        config: config,
        triggerData: context.triggerData,
        submissionId: context.submissionId,
        submitterId: context.submitterId
      };

      console.log('🎯 CALLING ActionExecutors.executeApprovalAction');
      const approvalResult = await ActionExecutors.executeApprovalAction(nodeContext);
      
      console.log('📊 APPROVAL EXECUTION RESULT:', approvalResult);

      // Get next nodes using normal flow (no condition for approval nodes)
      const nextNodes = await NodeConnections.getNextNodes(context.workflowId, nodeData.id);
      
      return {
        success: approvalResult.success,
        output: approvalResult.output || { 
          approval: config.approvalAction, 
          executed: approvalResult.success 
        },
        error: approvalResult.error,
        nextNodeIds: nextNodes
      };
    } catch (error) {
      console.error('❌ Approval node execution failed:', error);
      const nextNodes = await NodeConnections.getNextNodes(context.workflowId, nodeData.id);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Approval execution failed',
        nextNodeIds: nextNodes
      };
    }
  }

  static async executeFormAssignmentNode(nodeData: any, config: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    console.log('📋 Executing form assignment node with config:', config);
    
    const nextNodes = await NodeConnections.getNextNodes(context.workflowId, nodeData.id);
    
    return {
      success: true,
      output: { assigned: true, targetForm: config.targetFormId },
      nextNodeIds: nextNodes
    };
  }

  static async executeNotificationNode(nodeData: any, config: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    console.log('🔔 Executing notification node with config:', config);
    
    const nextNodes = await NodeConnections.getNextNodes(context.workflowId, nodeData.id);
    
    return {
      success: true,
      output: { notificationSent: true, type: config.notificationConfig?.type },
      nextNodeIds: nextNodes
    };
  }

  static async executeConditionNode(nodeData: any, config: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    console.log('🔍 Executing condition node with config:', config);
    
    try {
      let conditionResult = false;
      let evaluationDetails: any = {};

      // Check if config exists
      if (!config) {
        conditionResult = true;
        evaluationDetails = {
          type: 'default',
          result: true,
          message: 'No configuration found, defaulting to true'
        };
      } else if (config.enhancedCondition) {
        try {
          // Build evaluation context
          const evaluationContext: ConditionEvaluationContext = {
            formData: context.triggerData?.submissionData || context.triggerData || {},
            userProperties: {
              id: context.submitterId,
              role: context.triggerData?.userRole || 'user',
              email: context.triggerData?.userEmail || ''
            },
            systemData: {
              approvalStatus: context.triggerData?.approvalStatus,
              currentUserId: context.submitterId,
              submissionId: context.submissionId,
              workflowExecutionId: context.executionId
            }
          };

          // Enhanced condition needs to be wrapped in proper ConditionConfig format
          const wrappedCondition: IfConditionConfig = {
            type: 'if',
            condition: config.enhancedCondition,
            truePath: 'true',
            falsePath: 'false'
          };

          // Evaluate condition using the condition evaluator
          const evaluationResult = ConditionEvaluator.evaluateCondition(
            wrappedCondition,
            evaluationContext
          );

          if (!evaluationResult.success) {
            return {
              success: false,
              error: evaluationResult.error || 'Enhanced condition evaluation failed',
              nextNodeIds: []
            };
          }

          conditionResult = evaluationResult.result as boolean;
          evaluationDetails = {
            type: 'enhanced',
            enhancedCondition: config.enhancedCondition,
            evaluationResult: evaluationResult.result,
            evaluatedConditions: evaluationResult.evaluatedConditions
          };
        } catch (error) {
          return {
            success: false,
            error: `Enhanced condition evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            nextNodeIds: []
          };
        }
      } else if (config.conditionConfig) {
        try {
          // Build evaluation context for legacy conditions
          const evaluationContext: ConditionEvaluationContext = {
            formData: context.triggerData?.submissionData || context.triggerData || {},
            userProperties: {
              id: context.submitterId,
              role: context.triggerData?.userRole || 'user',
              email: context.triggerData?.userEmail || ''
            },
            systemData: {
              approvalStatus: context.triggerData?.approvalStatus,
              currentUserId: context.submitterId,
              submissionId: context.submissionId,
              workflowExecutionId: context.executionId
            }
          };

          // Evaluate legacy condition
          const evaluationResult = ConditionEvaluator.evaluateCondition(
            config.conditionConfig,
            evaluationContext
          );

          if (!evaluationResult.success) {
            return {
              success: false,
              error: evaluationResult.error || 'Legacy condition evaluation failed',
              nextNodeIds: []
            };
          }

          conditionResult = evaluationResult.result as boolean;
          evaluationDetails = {
            type: 'legacy',
            conditionConfig: config.conditionConfig,
            evaluationResult: evaluationResult.result
          };
        } catch (error) {
          return {
            success: false,
            error: `Legacy condition evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            nextNodeIds: []
          };
        }
      } else {
        conditionResult = true;
        evaluationDetails = {
          type: 'default',
          result: true,
          message: 'No condition configured, defaulting to true'
        };
      }

      // Get conditional branches - THIS IS WHERE WE USE CONDITIONS
      let trueBranchNodes: string[] = [];
      let falseBranchNodes: string[] = [];
      
      try {
        const branches = await BranchDiscovery.getConditionalBranches(
          context.workflowId, 
          nodeData.id
        );
        trueBranchNodes = branches.trueBranchNodes;
        falseBranchNodes = branches.falseBranchNodes;
      } catch {
        // Continue with empty branches rather than failing
      }

      // Determine which branch to execute and which to ignore
      let nextNodeIds: string[] = [];
      let ignoredNodeIds: string[] = [];

      if (conditionResult) {
        // Condition is true - execute true branch, ignore false branch
        nextNodeIds = await NodeConnections.getNextNodes(context.workflowId, nodeData.id, 'true');
        ignoredNodeIds = falseBranchNodes;
      } else {
        // Condition is false - execute false branch, ignore true branch
        nextNodeIds = await NodeConnections.getNextNodes(context.workflowId, nodeData.id, 'false');
        ignoredNodeIds = trueBranchNodes;
      }

      // Mark ignored nodes in the execution logs
      if (ignoredNodeIds.length > 0) {
        await this.markNodesAsIgnored(context.executionId, ignoredNodeIds, `Condition ${conditionResult ? 'TRUE' : 'FALSE'} - branch ignored`);
      }

      return {
        success: true,
        output: {
          conditionType: evaluationDetails.type,
          conditionResult,
          nextPath: conditionResult ? 'true' : 'false',
          nextNodes: nextNodeIds.length,
          ignoredNodes: ignoredNodeIds.length,
          evaluationDetails
        },
        nextNodeIds
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Condition execution failed',
        nextNodeIds: []
      };
    }
  }

  /**
   * Mark nodes as ignored in the execution logs
   */
  private static async markNodesAsIgnored(executionId: string, nodeIds: string[], reason: string) {
    if (nodeIds.length === 0) return;

    try {
      console.log(`📝 Marking ${nodeIds.length} nodes as ignored:`, nodeIds);

      // Get execution order for these entries
      const { data: orderData } = await supabase
        .rpc('get_next_execution_order', { exec_id: executionId });
      
      let executionOrder = orderData || 1;

      // Create log entries for ignored nodes
      const logEntries = nodeIds.map((nodeId, index) => ({
        execution_id: executionId,
        node_id: nodeId,
        node_type: 'ignored',
        node_label: 'Ignored Node',
        status: 'ignored',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        execution_order: executionOrder + index,
        input_data: {},
        output_data: { reason },
        error_message: null,
        duration_ms: 0
      }));

      const { error } = await supabase
        .from('workflow_instance_logs')
        .insert(logEntries);

      if (error) {
        console.error('❌ Error marking nodes as ignored:', error);
      } else {
        console.log('✅ Successfully marked nodes as ignored');
      }
    } catch (error) {
      console.error('❌ Error marking nodes as ignored:', error);
    }
  }

  static async executeWaitNode(nodeData: any, config: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    console.log('⏱️ Executing wait node with config:', JSON.stringify(config, null, 2));
    console.log('⏱️ Wait node data:', { nodeId: nodeData.id, label: nodeData.label });
    
    try {
      // Calculate the scheduled resume time based on wait configuration
      const scheduledResumeAt = this.calculateResumeTime(config);
      
      if (!scheduledResumeAt) {
        console.log('⚠️ No valid wait configuration or date in past, continuing immediately');
        const nextNodes = await NodeConnections.getNextNodes(context.workflowId, nodeData.id);
        return {
          success: true,
          output: { 
            waited: false, 
            reason: 'No valid wait configuration or date is in the past',
            waitType: config.waitType 
          },
          nextNodeIds: nextNodes
        };
      }

      const waitType = config.waitType || 'duration';
      const waitDetails = {
        waitType,
        scheduledResumeAt: scheduledResumeAt.toISOString(),
        durationValue: config.durationValue,
        durationUnit: config.durationUnit,
        untilDate: config.untilDate,
        eventType: config.eventType
      };

      console.log(`⏳ Scheduling workflow to resume at: ${scheduledResumeAt.toISOString()}`);
      console.log('⏳ Wait details:', waitDetails);

      // Update the workflow execution to 'waiting' status with scheduled resume time
      const { error: updateError, data: updateData } = await supabase
        .from('workflow_executions')
        .update({
          status: 'waiting',
          current_node_id: nodeData.id,
          scheduled_resume_at: scheduledResumeAt.toISOString(),
          wait_node_id: nodeData.id,
          wait_config: {
            ...config,
            scheduledAt: new Date().toISOString(),
            originalConfig: config
          }
        })
        .eq('id', context.executionId)
        .select();

      if (updateError) {
        console.error('❌ Failed to update workflow execution for wait:', updateError);
        throw updateError;
      }

      console.log('✅ Workflow execution updated to waiting:', updateData);

      // Update the existing log entry to 'waiting' status (created by workflowExecutor)
      const { error: logUpdateError } = await supabase
        .from('workflow_instance_logs')
        .update({
          status: 'waiting',
          action_type: waitType,
          action_details: waitDetails,
          input_data: { 
            scheduledResumeAt: scheduledResumeAt.toISOString(),
            waitType,
            config: config
          }
        })
        .eq('execution_id', context.executionId)
        .eq('node_id', nodeData.id)
        .eq('status', 'running');

      if (logUpdateError) {
        console.error('⚠️ Failed to update log entry (may already be updated):', logUpdateError);
      }

      console.log('✅ Workflow paused successfully');
      console.log(`📅 Will resume at: ${scheduledResumeAt.toISOString()}`);
      console.log(`⏰ Current time: ${new Date().toISOString()}`);
      console.log(`⏱️ Wait duration: ${(scheduledResumeAt.getTime() - Date.now()) / 1000} seconds`);

      // Return empty nextNodeIds to stop execution - it will be resumed by the cron job or event
      return {
        success: true,
        output: { 
          waited: true, 
          scheduledResumeAt: scheduledResumeAt.toISOString(),
          waitType: waitType,
          waitDetails,
          message: `Workflow paused until ${scheduledResumeAt.toISOString()}`
        },
        nextNodeIds: [] // Empty to stop execution here
      };
    } catch (error: any) {
      console.error('❌ Error in wait node execution:', error);
      // Extract error message from various error types (Supabase errors, Error objects, etc.)
      const errorMessage = error?.message || error?.error_description || 
        (typeof error === 'string' ? error : 'Wait node execution failed');
      return {
        success: false,
        error: errorMessage,
        nextNodeIds: []
      };
    }
  }

  static calculateResumeTime(config: any): Date | null {
    const now = new Date();
    const waitType = config.waitType || 'duration';

    console.log('📅 Calculating resume time for wait type:', waitType, 'config:', config);

    switch (waitType) {
      case 'duration': {
        const duration = parseInt(config.durationValue) || parseInt(config.waitDuration) || 1;
        const unit = config.durationUnit || config.waitUnit || 'minutes';
        
        console.log(`⏱️ Duration wait: ${duration} ${unit}`);
        
        let resumeTime: Date;
        switch (unit) {
          case 'minutes':
            resumeTime = new Date(now.getTime() + duration * 60 * 1000);
            break;
          case 'hours':
            resumeTime = new Date(now.getTime() + duration * 60 * 60 * 1000);
            break;
          case 'days':
            resumeTime = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
            break;
          case 'weeks':
            resumeTime = new Date(now.getTime() + duration * 7 * 24 * 60 * 60 * 1000);
            break;
          default:
            resumeTime = new Date(now.getTime() + duration * 60 * 1000);
        }
        console.log(`📅 Duration resume time: ${resumeTime.toISOString()}`);
        return resumeTime;
      }
      
      case 'until_date': {
        const untilDate = config.untilDate;
        if (!untilDate) {
          console.log('⚠️ No untilDate provided in config');
          return null;
        }
        
        // Parse the datetime-local value properly
        const targetDate = new Date(untilDate);
        
        console.log(`📅 Until date: ${untilDate} -> parsed: ${targetDate.toISOString()}`);
        
        if (isNaN(targetDate.getTime())) {
          console.log('⚠️ Invalid date format:', untilDate);
          return null;
        }
        
        // Check if the date is in the future
        if (targetDate <= now) {
          console.log('⚠️ Target date is in the past, continuing immediately');
          return null;
        }
        
        return targetDate;
      }
      
      case 'until_event': {
        // For event-based waiting, we set a very long timeout (365 days)
        // The workflow will be resumed manually when the event occurs
        const eventType = config.eventType || 'manual_trigger';
        console.log(`📅 Event wait: ${eventType} - setting 365 day max timeout`);
        const maxWaitTime = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        return maxWaitTime;
      }
      
      default:
        console.log('⚠️ Unknown wait type:', waitType);
        return null;
    }
  }

  static async executeEndNode(nodeData: any, config: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    console.log('🏁 Executing end node - workflow complete');
    
    return {
      success: true,
      output: { message: 'Workflow completed successfully' },
      nextNodeIds: [] // No next nodes - workflow ends here
    };
  }

  static async executeNodeByType(nodeData: any, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    const config = parseNodeConfig(nodeData.config);
    
    console.log(`🎯 Executing ${nodeData.node_type} node:`, {
      label: nodeData.label,
      config: config
    });

    switch (nodeData.node_type) {
      case 'start':
        return await this.executeStartNode(nodeData, config, context);
      case 'action':
        return await this.executeActionNode(nodeData, config, context);
      case 'approval':
        return await this.executeApprovalNode(nodeData, config, context);
      case 'form-assignment':
        return await this.executeFormAssignmentNode(nodeData, config, context);
      case 'notification':
        return await this.executeNotificationNode(nodeData, config, context);
      case 'condition':
        return await this.executeConditionNode(nodeData, config, context);
      case 'wait':
        return await this.executeWaitNode(nodeData, config, context);
      case 'end':
        return await this.executeEndNode(nodeData, config, context);
      default:
        throw new Error(`Unknown node type: ${nodeData.node_type}`);
    }
  }
}
