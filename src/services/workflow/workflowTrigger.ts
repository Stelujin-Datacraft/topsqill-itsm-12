
import { supabase } from '@/integrations/supabase/client';
import { parseNodeConfig } from './utils';
import { WorkflowOrchestrator } from './workflowOrchestrator';

export class WorkflowTrigger {
  static async findMatchingWorkflows(formId: string, submissionData: any) {
    // Find all active workflows that have start nodes triggered by this form
    const { data: workflows, error: workflowError } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('status', 'active');

    if (workflowError) {
      return [];
    }

    if (!workflows || workflows.length === 0) {
      return [];
    }

    const triggeredWorkflows = [];

    // Check each workflow for matching start nodes
    for (const workflow of workflows) {
      const { data: nodes, error: nodesError } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', workflow.id)
        .eq('node_type', 'start');

      if (nodesError) {
        continue;
      }

      // Check if any start node is triggered by this form submission
      const matchingNode = nodes?.find(node => {
        const config = parseNodeConfig(node.config);
        
        // Default triggerType to 'form_submission' if not set
        const triggerType = config.triggerType || 'form_submission';
        
        // Check for both 'form_submission' and 'form_completion' trigger types
        return (triggerType === 'form_submission' || triggerType === 'form_completion') 
          && config.triggerFormId === formId;
      });

      if (matchingNode) {
        triggeredWorkflows.push({
          workflow,
          matchingNode,
          matchingConfig: parseNodeConfig(matchingNode.config)
        });
      }
    }

    return triggeredWorkflows;
  }

  static async resolveFormOwner(formId: string): Promise<string | null> {
    const { data: formData } = await supabase
      .from('forms')
      .select('created_by')
      .eq('id', formId)
      .single();

    let formOwnerId = null;
    if (formData?.created_by) {
      // Check if created_by is already a UUID or an email
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.created_by);
      
      if (isUUID) {
        formOwnerId = formData.created_by;
      } else {
        // It's an email, look up the user ID
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', formData.created_by)
          .single();
        
        formOwnerId = userProfile?.id || null;
      }
    }

    return formOwnerId;
  }
}

export class WorkflowExecutionService {
  static async triggerWorkflowsForFormSubmission(
    formId: string,
    submissionData: any,
    submissionId: string,
    submitterId: string
  ) {
    // Find matching workflows
    const matchingWorkflows = await WorkflowTrigger.findMatchingWorkflows(formId, submissionData);
    
    if (matchingWorkflows.length === 0) {
      return [];
    }

    const executionResults = [];

    // Execute each matching workflow
    for (const { workflow, matchingNode } of matchingWorkflows) {
      try {
        // Resolve form owner
        const formOwnerId = await WorkflowTrigger.resolveFormOwner(formId);
        
        // Create enhanced trigger data with all necessary information
        const triggerData = {
          formId,
          submissionData,
          submissionId,
          submitterId,
          formOwnerId,
          userEmail: submissionData.userEmail || submissionData.email,
          submitterName: submissionData.submitterName || `${submissionData.firstName || ''} ${submissionData.lastName || ''}`.trim()
        };

        // Start workflow execution
        const executionResult = await WorkflowOrchestrator.executeWorkflow(
          workflow.id,
          matchingNode.id,
          triggerData,
          submissionId,
          submitterId,
          formOwnerId
        );
        
        executionResults.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionId: executionResult.executionId,
          success: executionResult.success
        });
      } catch (error) {
        executionResults.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return executionResults;
  }
}
