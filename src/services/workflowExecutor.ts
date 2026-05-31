
import { supabase } from '@/integrations/supabase/client';
import { NodeActions, NodeExecutionContext, NodeExecutionResult } from './nodeActions';
import { notifyWorkflowFailure } from './workflow/notifyFailure';

export class WorkflowExecutor {
  static async executeWorkflow(
    workflowId: string,
    triggerData: any,
    submissionId?: string,
    submitterId?: string
  ): Promise<string | null> {
    try {
      console.log('🚀 Starting workflow execution:', { workflowId, submissionId, submitterId });

      // Check if workflow is active
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .select('id, name, status')
        .eq('id', workflowId)
        .single();

      if (workflowError || !workflow) {
        console.error('❌ Workflow not found:', workflowError);
        return null;
      }

      if (workflow.status !== 'active') {
        console.log('⚠️ Workflow is not active:', workflow.status);
        return null;
      }

      // Create workflow execution record
      const { data: execution, error: executionError } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          status: 'running',
          trigger_data: triggerData,
          execution_data: {},
          form_submission_id: submissionId,
          submitter_id: submitterId,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (executionError) {
        console.error('❌ Error creating workflow execution:', executionError);
        return null;
      }

      console.log('✅ Created workflow execution:', execution.id);

      // Find the first active node (start node)
      const startNode = await this.findStartNode(workflowId);
      if (!startNode) {
        await this.markExecutionFailed(execution.id, 'No start node found');
        return null;
      }

      // Begin execution from start node
      await this.executeNodeSequence(execution.id, workflowId, startNode.id, triggerData, submissionId, submitterId);

      return execution.id;
    } catch (error) {
      console.error('❌ Error in workflow execution:', error);
      return null;
    }
  }

  private static async findStartNode(workflowId: string) {
    const { data: nodes, error } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('node_type', 'start')
      .limit(1);

    if (error) {
      console.error('❌ Error finding start node:', error);
      return null;
    }

    return nodes?.[0] || null;
  }

  private static async executeNodeSequence(
    executionId: string,
    workflowId: string,
    nodeId: string,
    triggerData: any,
    submissionId?: string,
    submitterId?: string
  ) {
    try {
      console.log(`🔄 Executing node: ${nodeId}`);

      // Get node details
      const { data: node, error: nodeError } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('id', nodeId)
        .single();

      if (nodeError || !node) {
        console.error('❌ Node not found:', nodeError);
        return;
      }

      // Update workflow execution current node
      await supabase
        .from('workflow_executions')
        .update({ current_node_id: nodeId })
        .eq('id', executionId);

      // Get execution order for this node
      const { data: orderData } = await supabase
        .rpc('get_next_execution_order', { exec_id: executionId });
      
      const executionOrder = orderData || 1;
      const startTime = new Date().toISOString();

      // Create initial log entry
      const { data: logEntry, error: logError } = await supabase
        .from('workflow_instance_logs')
        .insert({
          execution_id: executionId,
          node_id: nodeId,
          node_type: node.node_type,
          node_label: node.label,
          status: 'running',
          started_at: startTime,
          execution_order: executionOrder,
          input_data: triggerData,
          output_data: {}
        })
        .select()
        .single();

      if (logError) {
        console.error('❌ Error creating log entry:', logError);
        return;
      }

      // Execute the node based on its type using NodeActions
      const context: NodeExecutionContext = {
        executionId,
        workflowId,
        nodeId,
        config: node.config || {},
        triggerData,
        submissionId,
        submitterId
      };

      let result: NodeExecutionResult;
      const nodeStartTime = Date.now();
      let nodeEndTime = Date.now();
      let executionCompleted = false;

      try {
        // Execute nodes with enhanced conditional handling
        switch (node.node_type) {
          case 'start':
            console.log('▶️ Executing start node');
            result = await NodeActions.executeStartNode(context);
            break;
          case 'notification':
            console.log('🔔 Executing notification node');
            result = await NodeActions.executeNotificationNode(context);
            break;
          case 'action':
            console.log('🎯 Executing action node');
            result = await NodeActions.executeActionNode(context);
            break;
          case 'condition':
            console.log('🔍 Executing condition node with conditional branching');
            result = await NodeActions.executeConditionNode(context);
            break;
          case 'wait':
            console.log('⏱️ Executing wait node');
            result = await NodeActions.executeWaitNode(context);
            break;
          case 'end':
            console.log('🏁 Executing end node');
            result = await NodeActions.executeEndNode(context);
            break;
          default:
            console.error(`❌ Unknown node type: ${node.node_type}`);
            result = {
              success: false,
              error: `Unknown node type: ${node.node_type}`
            };
        }
        executionCompleted = true;
      } catch (nodeExecError) {
        console.error(`❌ Node execution threw error:`, nodeExecError);
        result = {
          success: false,
          error: nodeExecError instanceof Error ? nodeExecError.message : 'Node execution failed unexpectedly'
        };
        executionCompleted = true;
      }

      nodeEndTime = Date.now();
      const duration = nodeEndTime - nodeStartTime;

      // Enhanced logging for conditional nodes
      let conditionalInfo = {};
      if (node.node_type === 'condition' && result.output) {
        conditionalInfo = {
          conditionResult: result.output.conditionResult,
          conditionType: result.output.conditionType,
          nextPath: result.output.nextPath,
          nextNodes: result.output.nextNodes,
          ignoredNodes: result.output.ignoredNodes
        };
      }

      // Enhanced logging for action nodes
      let actionType = null;
      let actionDetails = {};
      
      if (node.node_type === 'action' && node.config) {
        const config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
        if (config && typeof config === 'object' && 'actionType' in config) {
          actionType = config.actionType as string;
          actionDetails = {
            actionType,
            targetFormId: config.targetFormId || null,
            assignmentConfig: config.assignmentConfig || null,
            executionResult: result.success ? 'success' : 'failed'
          };
        }
      }

      // For wait nodes that are pausing, don't update the log entry - it already has 'waiting' status
      const isWaitNodePausing = node.node_type === 'wait' && result.success && 
        result.output?.waited === true && (!result.nextNodeIds || result.nextNodeIds.length === 0);

      if (!isWaitNodePausing) {
        // Update log entry with results - always update even on failure
        try {
          await supabase
            .from('workflow_instance_logs')
            .update({
              status: result.success ? 'completed' : 'failed',
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              output_data: { 
                ...result.output || {}, 
                ...conditionalInfo 
              },
              error_message: result.error,
              action_type: actionType,
              action_details: { ...actionDetails, ...conditionalInfo }
            })
            .eq('id', logEntry.id);
        } catch (logUpdateError) {
          console.error('❌ Error updating log entry:', logUpdateError);
        }
      }

      console.log(`${result.success ? '✅' : '❌'} Node execution result:`, {
        nodeId,
        nodeType: node.node_type,
        actionType,
        success: result.success,
        error: result.error,
        duration: `${duration}ms`,
        conditionalInfo,
        nextNodeCount: result.nextNodeIds?.length || 0
      });

      // Continue to next nodes if successful
      if (result.success && result.nextNodeIds && result.nextNodeIds.length > 0) {
        console.log(`➡️ Executing ${result.nextNodeIds.length} next nodes`);
        for (const nextNodeId of result.nextNodeIds) {
          await this.executeNodeSequence(executionId, workflowId, nextNodeId, triggerData, submissionId, submitterId);
        }
      } else if (result.success && (!result.nextNodeIds || result.nextNodeIds.length === 0)) {
        // Check if this is a wait node that's pausing - don't mark workflow as completed
        if (isWaitNodePausing) {
          console.log('⏸️ Workflow paused by wait node, will resume later');
          // Don't mark as completed - the wait node already set status to 'waiting'
        } else {
          // No more nodes - workflow completed
          console.log('🏁 Workflow execution completed');
          await this.markExecutionCompleted(executionId);
        }
      } else {
        // Node failed - mark workflow as failed
        await this.markExecutionFailed(executionId, result.error);
      }

    } catch (error) {
      console.error('❌ Error in node execution sequence:', error);
      await this.markExecutionFailed(executionId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private static async markExecutionCompleted(executionId: string) {
    // Check if execution is in 'waiting' status - don't mark as completed if so
    const { data: currentExecution } = await supabase
      .from('workflow_executions')
      .select('status')
      .eq('id', executionId)
      .single();

    if (currentExecution?.status === 'waiting') {
      console.log('⏸️ Execution is in waiting state, not marking as completed');
      return;
    }

    await supabase
      .from('workflow_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        current_node_id: null
      })
      .eq('id', executionId);
  }

  private static async markExecutionFailed(executionId: string, errorMessage?: string) {
    await supabase
      .from('workflow_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        current_node_id: null
      })
      .eq('id', executionId);

    try {
      const { data: exec } = await supabase
        .from('workflow_executions')
        .select('workflow_id')
        .eq('id', executionId)
        .maybeSingle();
      if (exec?.workflow_id) {
        notifyWorkflowFailure(exec.workflow_id, errorMessage, { executionId });
      }
    } catch (e) {
      console.error('notify-failure lookup failed:', e);
    }
  }
}
