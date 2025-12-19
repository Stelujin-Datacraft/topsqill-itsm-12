import { supabase } from '@/integrations/supabase/client';
import { WorkflowExecutionService } from './workflowTrigger';

export class WorkflowResumer {
  private static isPolling = false;
  private static pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Manually resume a specific waiting workflow execution
   */
  static async resumeExecution(executionId: string): Promise<{ success: boolean; error?: string }> {
    console.log('🔄 Manually resuming workflow execution:', executionId);
    
    try {
      // Call the edge function with the specific execution ID
      const { data, error } = await supabase.functions.invoke('resume-waiting-workflows', {
        body: { executionId }
      });

      if (error) {
        console.error('❌ Error calling resume function:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Resume function response:', data);
      
      // After the edge function marks it as running, continue execution from frontend
      if (data?.resumedCount > 0) {
        await this.continueResumedExecution(executionId);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Error resuming execution:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Continue execution of a resumed workflow from the frontend
   */
  static async continueResumedExecution(executionId: string): Promise<void> {
    console.log('▶️ Continuing resumed workflow execution:', executionId);

    try {
      // Get the execution details
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .select('*, workflow:workflows(*)')
        .eq('id', executionId)
        .single();

      if (execError || !execution) {
        console.error('❌ Failed to fetch execution:', execError);
        return;
      }

      if (execution.status !== 'running') {
        console.log('⏭️ Execution is not in running state:', execution.status);
        return;
      }

      // Get pending logs that need execution
      const { data: pendingLogs, error: logsError } = await supabase
        .from('workflow_instance_logs')
        .select('*')
        .eq('execution_id', executionId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (logsError) {
        console.error('❌ Failed to fetch pending logs:', logsError);
        return;
      }

      if (!pendingLogs || pendingLogs.length === 0) {
        console.log('⏭️ No pending logs to execute');
        return;
      }

      console.log(`📋 Found ${pendingLogs.length} pending node(s) to execute`);

      // Get trigger data from the execution
      const triggerData = execution.trigger_data || {};
      const submissionId = execution.trigger_submission_id;
      const submitterId = execution.submitter_id;

      // Execute each pending node
      for (const log of pendingLogs) {
        console.log(`▶️ Executing pending node: ${log.node_label} (${log.node_type})`);
        
        // Update log to running
        await supabase
          .from('workflow_instance_logs')
          .update({ status: 'running', started_at: new Date().toISOString() })
          .eq('id', log.id);

        try {
          // Use the workflow orchestrator to continue execution from this node
          const { WorkflowOrchestrator } = await import('./workflowOrchestrator');
          
          // For resumed workflows, we use the existing execution
          // Just execute the pending node directly using executeNodeFromExecution
          await WorkflowOrchestrator.continueFromNode(
            executionId,
            execution.workflow_id,
            log.node_id,
            triggerData,
            submissionId || undefined,
            submitterId || undefined
          );
        } catch (nodeError: any) {
          console.error(`❌ Error executing node ${log.node_id}:`, nodeError);
          
          await supabase
            .from('workflow_instance_logs')
            .update({ 
              status: 'failed', 
              error_message: nodeError.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', log.id);
        }
      }
    } catch (error) {
      console.error('❌ Error continuing resumed execution:', error);
    }
  }

  /**
   * Check for and resume any waiting workflows that are past their scheduled time
   */
  static async checkAndResumeWaiting(): Promise<{ resumedCount: number }> {
    console.log('🔍 Checking for waiting workflows to resume...');

    try {
      // Call the edge function to resume waiting workflows
      const { data, error } = await supabase.functions.invoke('resume-waiting-workflows');

      if (error) {
        console.error('❌ Error checking waiting workflows:', error);
        return { resumedCount: 0 };
      }

      console.log('📊 Resume check result:', data);

      // Continue execution for any resumed workflows
      if (data?.resumedExecutions && Array.isArray(data.resumedExecutions)) {
        for (const execId of data.resumedExecutions) {
          if (typeof execId === 'string') {
            await this.continueResumedExecution(execId);
          }
        }
      }

      return { resumedCount: data?.resumedCount || 0 };
    } catch (error) {
      console.error('❌ Error in checkAndResumeWaiting:', error);
      return { resumedCount: 0 };
    }
  }

  /**
   * Start polling for waiting workflows that need to be resumed
   */
  static startPolling(intervalMs: number = 60000): void {
    if (this.isPolling) {
      console.log('⚠️ Already polling for waiting workflows');
      return;
    }

    console.log(`🔄 Starting workflow resume polling (interval: ${intervalMs}ms)`);
    this.isPolling = true;

    // Initial check
    this.checkAndResumeWaiting();

    // Set up interval
    this.pollInterval = setInterval(() => {
      this.checkAndResumeWaiting();
    }, intervalMs);
  }

  /**
   * Stop polling for waiting workflows
   */
  static stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('🛑 Stopped workflow resume polling');
  }

  /**
   * Resume a workflow that was waiting for a specific event
   */
  static async resumeOnEvent(
    eventType: string, 
    eventData: any
  ): Promise<{ resumedCount: number }> {
    console.log('🎯 Checking for workflows waiting on event:', eventType);

    try {
      // Find waiting workflows that match this event type
      const { data: waitingExecutions, error } = await supabase
        .from('workflow_executions')
        .select('id, wait_config')
        .eq('status', 'waiting')
        .not('wait_config', 'is', null);

      if (error) {
        console.error('❌ Error fetching waiting executions:', error);
        return { resumedCount: 0 };
      }

      // Filter for matching event types
      const matchingExecutions = waitingExecutions?.filter(exec => {
        const config = exec.wait_config as any;
        return config?.waitType === 'until_event' && config?.eventType === eventType;
      }) || [];

      console.log(`📋 Found ${matchingExecutions.length} workflow(s) waiting for event: ${eventType}`);

      let resumedCount = 0;
      for (const exec of matchingExecutions) {
        const result = await this.resumeExecution(exec.id);
        if (result.success) resumedCount++;
      }

      return { resumedCount };
    } catch (error) {
      console.error('❌ Error resuming on event:', error);
      return { resumedCount: 0 };
    }
  }
}
