
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

      console.log('📊 Current execution status after nodes completed:', currentExecution?.status, 'isTerminal:', result.isTerminal);

      // Only update status if it's still 'running' (not 'waiting' from a wait node)
      if (currentExecution?.status === 'running') {
        // If result has isTerminal flag or success, mark as completed
        const shouldComplete = result.success && (result.isTerminal || result.isTerminal === undefined);
        console.log('✅ Workflow not paused, marking as', shouldComplete ? 'completed' : 'failed');
        await supabase
          .from('workflow_executions')
          .update({
            status: shouldComplete ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            error_message: result.error
          })
          .eq('id', execution.id);
        
        // Clean up execution count tracking
        this.nodeExecutionCounts.delete(execution.id);
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

    console.log('📊 Continue from node - current status:', currentExecution?.status, 'isTerminal:', result.isTerminal);

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
      
      // Clean up execution count tracking
      this.nodeExecutionCounts.delete(executionId);
    } else if (result.success && currentExecution?.status === 'running') {
      // Mark as completed if we're still running (not waiting) and reached a terminal state
      const shouldComplete = result.isTerminal || result.isTerminal === undefined;
      if (shouldComplete) {
        await supabase
          .from('workflow_executions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', executionId);
        
        // Clean up execution count tracking
        this.nodeExecutionCounts.delete(executionId);
      }
    }

    return result;
  }

  // Track node execution counts for loop detection (static to persist across recursive calls)
  private static nodeExecutionCounts = new Map<string, Map<string, number>>();
  private static MAX_LOOP_ITERATIONS = 100;

  private static async executeNode(executionId: string, nodeId: string, inputData: any, context: WorkflowExecutionContext): Promise<{ success: boolean; error?: string; isTerminal?: boolean }> {
    console.log(`🔄 Executing node ${nodeId} for execution ${executionId}`);

    // Initialize execution count tracking for this execution
    if (!this.nodeExecutionCounts.has(executionId)) {
      this.nodeExecutionCounts.set(executionId, new Map());
    }
    const executionCounts = this.nodeExecutionCounts.get(executionId)!;
    const currentCount = executionCounts.get(nodeId) || 0;
    executionCounts.set(nodeId, currentCount + 1);

    // Safety check: prevent true infinite loops
    if (currentCount >= this.MAX_LOOP_ITERATIONS) {
      console.log(`🛑 Max loop iterations (${this.MAX_LOOP_ITERATIONS}) reached for node: ${nodeId} - stopping loop`);
      return { success: true, isTerminal: true };
    }

    // Log if this is a loop-back re-execution
    if (currentCount > 0) {
      console.log(`🔄 Loop-back detected: Re-executing node ${nodeId} (iteration ${currentCount + 1})`);
    }

    let nodeExecution: any = null;
    let node: any = null;
    const nodeStartTime = Date.now();

    try {
      // Get node details
      const { data: nodeData, error: nodeError } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('id', nodeId)
        .single();

      if (nodeError || !nodeData) {
        console.error('❌ Error fetching node:', nodeError);
        return { success: false, error: 'Node not found' };
      }
      
      node = nodeData;

      // Create node execution log
      const { data: logData, error: logError } = await supabase
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
      } else {
        nodeExecution = logData;
      }

      // Execute node using NodeExecutors with enhanced conditional support
      let result;

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

      // Update node execution log - always update even on failure
      if (nodeExecution) {
        try {
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
        } catch (logUpdateError) {
          console.error('❌ Error updating node execution log:', logUpdateError);
        }
      }

      // If this is an end node, stop execution and mark as terminal
      if (node.node_type === 'end') {
        console.log('🏁 Workflow completed - end node reached');
        return { success: true, isTerminal: true };
      }

      const WAITING_FOR_VALUE = Symbol.for('WAITING_FOR_VALUE');

      // Check if this is a wait node that paused the workflow
      if (node.node_type === 'wait' && result.output?.waited === true) {
        console.log('⏸️ Workflow paused at wait node');
        return { success: true, isTerminal: false };
      }
      // ⛔ CONDITION NODE WAITING FOR VALUE
if (
  node.node_type === 'condition' &&
  result.output?.conditionResult === WAITING_FOR_VALUE
) {
  console.log('⏸️ Condition node waiting for value — blocking execution');

  return {
    success: true,
    isTerminal: false   // CRITICAL: prevents child execution
  };
}


      // Execute next nodes if the current node was successful
      if (result.success && result.nextNodeIds && result.nextNodeIds.length > 0) {
        console.log(`➡️ Executing ${result.nextNodeIds.length} next nodes`);
        for (const nextNodeId of result.nextNodeIds) {
          const childResult = await this.executeNode(executionId, nextNodeId, result.output || inputData, context);
          // If any child returns terminal, propagate it
          if (childResult.isTerminal) {
            return { success: true, isTerminal: true };
          }
        }
        return { success: true };
      } else if (!result.success) {
        console.error('❌ Node execution failed, stopping workflow');
        return { success: false, error: result.error };
      } else {
        // No next nodes and node executed successfully - this is a terminal node (like action at end of branch)
        console.log('ℹ️ No next nodes to execute, branch path completed - treating as terminal');
        return { success: true, isTerminal: true };
      }
    } catch (error) {
      console.error(`❌ Error executing node ${nodeId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Ensure node execution log is marked as failed even on unexpected errors
      if (nodeExecution) {
        const duration = Date.now() - nodeStartTime;
        try {
          await supabase
            .from('workflow_instance_logs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              error_message: errorMessage
            })
            .eq('id', nodeExecution.id);
        } catch (logUpdateError) {
          console.error('❌ Error updating node execution log in catch block:', logUpdateError);
        }
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }
}
