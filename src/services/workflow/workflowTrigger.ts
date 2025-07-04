
import { supabase } from '@/integrations/supabase/client';
import { parseNodeConfig } from './utils';
import { WorkflowOrchestrator } from './workflowOrchestrator';

export class WorkflowTrigger {
  static async findMatchingWorkflows(formId: string, submissionData: any) {
    console.log('🔍 Starting workflow triggering process for form submission:', {
      formId,
      submissionData: Object.keys(submissionData || {})
    });
    
    // Find all active workflows that have start nodes triggered by this form
    const { data: workflows, error: workflowError } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('status', 'active');

    if (workflowError) {
      console.error('❌ Error fetching active workflows:', workflowError);
      return [];
    }

    if (!workflows || workflows.length === 0) {
      console.log('⚠️ No active workflows found');
      return [];
    }

    console.log(`✅ Found ${workflows.length} active workflows to check:`, workflows.map(w => w.name));

    const triggeredWorkflows = [];

    // Check each workflow for matching start nodes
    for (const workflow of workflows) {
      console.log(`🔍 Checking workflow: ${workflow.name} (${workflow.id})`);
      
      const { data: nodes, error: nodesError } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', workflow.id)
        .eq('node_type', 'start');

      if (nodesError) {
        console.error('❌ Error fetching workflow nodes:', nodesError);
        continue;
      }

      console.log(`📋 Found ${nodes?.length || 0} start nodes in workflow ${workflow.name}`);

      // Check if any start node is triggered by this form submission
      const matchingNode = nodes?.find(node => {
        const config = parseNodeConfig(node.config);
        console.log(`🔍 Checking start node ${node.id} config:`, config);
        
        // Check for both 'form_submission' and 'form_completion' trigger types
        const triggerMatches = (config.triggerType === 'form_submission' || config.triggerType === 'form_completion') 
          && config.triggerFormId === formId;
        
        console.log(`🎯 Trigger match result:`, {
          nodeId: node.id,
          triggerType: config.triggerType,
          triggerFormId: config.triggerFormId,
          expectedFormId: formId,
          matches: triggerMatches
        });
        
        return triggerMatches;
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
    console.log('🚀 WorkflowExecutionService.triggerWorkflowsForFormSubmission called with:', {
      formId,
      submissionId,
      submitterId,
      submissionDataKeys: Object.keys(submissionData || {}),
      userEmail: submissionData.userEmail
    });

    // Find matching workflows
    const matchingWorkflows = await WorkflowTrigger.findMatchingWorkflows(formId, submissionData);
    
    if (matchingWorkflows.length === 0) {
      console.log('ℹ️ No workflows found that match this form submission');
      return [];
    }

    console.log(`🎯 Found ${matchingWorkflows.length} matching workflows to execute`);

    const executionResults = [];

    // Execute each matching workflow
    for (const { workflow, matchingNode } of matchingWorkflows) {
      console.log(`🏃 Executing workflow: ${workflow.name} (${workflow.id})`);
      
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

        console.log('📋 Enhanced trigger data for workflow execution:', triggerData);

        // Start workflow execution
        const executionResult = await WorkflowOrchestrator.executeWorkflow(
          workflow.id,
          matchingNode.id,
          triggerData,
          submissionId,
          submitterId,
          formOwnerId
        );

        console.log(`✅ Workflow ${workflow.name} execution completed:`, executionResult);
        
        executionResults.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionId: executionResult.executionId,
          success: executionResult.success
        });
      } catch (error) {
        console.error(`❌ Error executing workflow ${workflow.name}:`, error);
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
