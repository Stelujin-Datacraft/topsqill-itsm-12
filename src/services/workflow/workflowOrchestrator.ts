
import { supabase } from '@/integrations/supabase/client';
import { parseNodeConfig } from './utils';
import { NodeExecutors } from './nodeExecutors';
import { WorkflowExecutionContext } from './types';

export class WorkflowOrchestrator {
  static async executeWorkflow(
    workflowId: string,
    startNodeId: string,
    triggerData: any,
    submissionId?: string,
    submitterId?: string,
    formOwnerId?: string | null
  ) {
    console.log('🚀 WorkflowOrchestrator.executeWorkflow called with:', {
      workflowId,
      startNodeId,
      triggerData,
      submissionId,
      submitterId,
      formOwnerId
    });

    try {
      // Create workflow execution record
      const { data: execution, error: executionError } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          status: 'running',
          trigger_data: triggerData,
          form_submission_id: submissionId,
          submitter_id: submitterId,
          form_owner_id: formOwnerId,
          current_node_id: startNodeId,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (executionError) {
        console.error('❌ Error creating workflow execution:', executionError);
        throw executionError;
      }

      console.log('✅ Workflow execution created:', execution);

      // Create execution context
      const context: WorkflowExecutionContext = {
        executionId: execution.id,
        workflowId,
        triggerData,
        submissionId,
        submitterId,
        formOwnerId
      };

      // Execute the workflow starting from the start node
      const result = await this.executeNode(execution.id, startNodeId, triggerData, context);

      // Check current execution status before updating
      // A wait node may have already set status to 'waiting' - don't overwrite it!
      const { data: currentExecution } = await supabase
        .from('workflow_executions')
        .select('status')
        .eq('id', execution.id)
        .single();

      console.log('📊 Current execution status after nodes completed:', currentExecution?.status);

      // Only update status if it's still 'running' (not 'waiting' from a wait node)
      if (currentExecution?.status === 'running') {
        console.log('✅ Workflow not paused, marking as', result.success ? 'completed' : 'failed');
        await supabase
          .from('workflow_executions')
          .update({
            status: result.success ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            error_message: result.error
          })
          .eq('id', execution.id);
      } else if (currentExecution?.status === 'waiting') {
        console.log('⏸️ Workflow is paused by wait node, preserving waiting status');
      }

      return {
        executionId: execution.id,
        success: result.success,
        error: result.error,
        isWaiting: currentExecution?.status === 'waiting'
      };
    } catch (error) {
      console.error('❌ Error in workflow execution:', error);
      return {
        executionId: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Continue workflow execution from a specific node (used for resuming after wait)
   */
  static async continueFromNode(
    executionId: string,
    workflowId: string,
    nodeId: string,
    triggerData: any,
    submissionId?: string,
    submitterId?: string
  ) {
    console.log('▶️ Continuing workflow from node:', { executionId, workflowId, nodeId });

    const context: WorkflowExecutionContext = {
      executionId,
      workflowId,
      triggerData,
      submissionId,
      submitterId
    };

    const result = await this.executeNode(executionId, nodeId, triggerData, context);

    // Check current execution status before updating
    const { data: currentExecution } = await supabase
      .from('workflow_executions')
      .select('status')
      .eq('id', executionId)
      .single();

    console.log('📊 Continue from node - current status:', currentExecution?.status);

    // Only mark as failed if execution failed AND status is not 'waiting'
    if (!result.success && currentExecution?.status !== 'waiting') {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: result.error
        })
        .eq('id', executionId);
    } else if (result.success && currentExecution?.status === 'running') {
      // Mark as completed only if we're still running (not waiting)
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }

    return result;
  }

  private static async executeNode(executionId: string, nodeId: string, inputData: any, context: WorkflowExecutionContext) {
    console.log(`🔄 Executing node ${nodeId} for execution ${executionId}`);

    try {
      // Get node details
      const { data: node, error: nodeError } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('id', nodeId)
        .single();

      if (nodeError || !node) {
        console.error('❌ Error fetching node:', nodeError);
        return { success: false, error: 'Node not found' };
      }

      // Create node execution log
      const { data: nodeExecution, error: logError } = await supabase
        .from('workflow_instance_logs')
        .insert({
          execution_id: executionId,
          node_id: nodeId,
          node_type: node.node_type,
          node_label: node.label,
          status: 'running',
          input_data: inputData,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (logError) {
        console.error('❌ Error creating node execution log:', logError);
      }

      // Execute node using NodeExecutors with enhanced conditional support
      let result;
      const nodeStartTime = Date.now();

      try {
        console.log(`🎯 Executing ${node.node_type} node using NodeExecutors`);
        result = await NodeExecutors.executeNodeByType(node, context);
      } catch (executionError) {
        console.error(`❌ Error executing node ${nodeId}:`, executionError);
        result = {
          success: false,
          error: executionError instanceof Error ? executionError.message : 'Node execution failed',
          nextNodeIds: []
        };
      }

      const nodeEndTime = Date.now();
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

      console.log(`${result.success ? '✅' : '❌'} Node execution result:`, {
        nodeId,
        nodeType: node.node_type,
        success: result.success,
        error: result.error,
        duration: `${duration}ms`,
        nextNodeCount: result.nextNodeIds?.length || 0,
        conditionalInfo
      });

      // Update node execution log
      if (nodeExecution) {
        await supabase
          .from('workflow_instance_logs')
          .update({
            status: result.success ? 'completed' : 'failed',
            output_data: { ...result.output || {}, ...conditionalInfo },
            completed_at: new Date().toISOString(),
            duration_ms: duration,
            error_message: result.error
          })
          .eq('id', nodeExecution.id);
      }

      // If this is an end node, stop execution
      if (node.node_type === 'end') {
        console.log('🏁 Workflow completed - end node reached');
        return { success: true };
      }

      // Execute next nodes if the current node was successful
      if (result.success && result.nextNodeIds && result.nextNodeIds.length > 0) {
        console.log(`➡️ Executing ${result.nextNodeIds.length} next nodes`);
        for (const nextNodeId of result.nextNodeIds) {
          await this.executeNode(executionId, nextNodeId, result.output || inputData, context);
        }
      } else if (!result.success) {
        console.error('❌ Node execution failed, stopping workflow');
        return { success: false, error: result.error };
      } else {
        console.log('ℹ️ No next nodes to execute, workflow path completed');
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ Error executing node ${nodeId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
