
import { backend as supabase } from '@/services/api';
import { getApiBaseUrl } from '@/services/api/apiClient';
import { parseNodeConfig } from './utils';
import {
  isFormSubmissionTriggerType,
  resolveStartTriggerFormId,
  startNodeMatchesFormSubmission,
} from './triggerMatch';

// Queue configuration
const QUEUE_ENABLED = true; // Feature flag for easy rollback
const QUEUE_FUNCTION_URL = `${getApiBaseUrl()}/workflows/enqueue`;

export class WorkflowTrigger {
  static async findMatchingWorkflows(formId: string, submissionData: any) {
    if (!formId) return [];

    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('project_id')
      .eq('id', formId)
      .maybeSingle();

    if (formError || !form?.project_id) {
      console.warn('[WorkflowTrigger] Form missing or has no project_id — no workflows matched', {
        formId,
        formError,
      });
      return [];
    }

    const { data: workflows, error: workflowError } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('status', 'active')
      .eq('project_id', form.project_id)
      .limit(500);

    if (workflowError || !workflows?.length) {
      console.log('[WorkflowTrigger] No active workflows in project', form.project_id);
      return [];
    }

    const workflowIds = workflows.map((w) => w.id);
    const [{ data: startNodes, error: nodesError }, { data: triggerRows }] = await Promise.all([
      supabase
        .from('workflow_nodes')
        .select('*')
        .in('workflow_id', workflowIds)
        .eq('node_type', 'start'),
      supabase
        .from('workflow_triggers')
        .select('target_workflow_id, source_form_id, is_active, trigger_type')
        .eq('source_form_id', formId)
        .in('target_workflow_id', workflowIds),
    ]);

    if (nodesError || !startNodes?.length) {
      console.warn('[WorkflowTrigger] No start nodes for active workflows', nodesError);
      return [];
    }

    const triggerLinkedWorkflowIds = new Set(
      (triggerRows || [])
        .filter((t) => t.is_active !== false && t.source_form_id === formId)
        .map((t) => t.target_workflow_id),
    );

    const nodesByWorkflow = new Map<string, typeof startNodes>();
    for (const node of startNodes) {
      const list = nodesByWorkflow.get(node.workflow_id) || [];
      list.push(node);
      nodesByWorkflow.set(node.workflow_id, list);
    }

    const triggeredWorkflows = [];

    for (const workflow of workflows) {
      const nodes = nodesByWorkflow.get(workflow.id) || [];
      let matchingNode = nodes.find((node) =>
        startNodeMatchesFormSubmission(parseNodeConfig(node.config), formId),
      );

      // Fallback: Start config missing triggerFormId but workflow_triggers links this form
      // (common after AI apply / hydrate-only designer display).
      if (!matchingNode && triggerLinkedWorkflowIds.has(workflow.id)) {
        matchingNode = nodes.find((node) => {
          const config = parseNodeConfig(node.config);
          const boundFormId = resolveStartTriggerFormId(config);
          // Accept empty or matching form id; skip if bound to a different form
          return isFormSubmissionTriggerType(config.triggerType)
            && (!boundFormId || boundFormId === formId);
        }) || nodes[0];
        console.log(
          '[WorkflowTrigger] Matched via workflow_triggers fallback',
          { workflowId: workflow.id, formId },
        );
      }

      if (matchingNode) {
        triggeredWorkflows.push({
          workflow,
          matchingNode,
          matchingConfig: parseNodeConfig(matchingNode.config),
        });
      }
    }

    if (!triggeredWorkflows.length) {
      console.log('[WorkflowTrigger] No matching workflows for form', {
        formId,
        activeWorkflowCount: workflows.length,
        startNodeFormIds: startNodes.map((n) => ({
          workflowId: n.workflow_id,
          triggerFormId: resolveStartTriggerFormId(parseNodeConfig(n.config)),
          triggerType: parseNodeConfig(n.config).triggerType,
        })),
      });
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
  /**
   * Enqueue a workflow for server-side processing
   * Returns queue_id on success, null on failure
   */
  private static async enqueueWorkflow(
    workflowId: string,
    submissionId: string,
    triggerData: Record<string, any>,
    triggerSource: 'form_submission' | 'manual' | 'api' | 'bulk' = 'form_submission'
  ): Promise<{ success: boolean; queueId?: string; error?: string }> {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(QUEUE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          workflow_id: workflowId,
          submission_id: submissionId,
          trigger_data: triggerData,
          trigger_source: triggerSource,
          trigger_ref: `${workflowId}-${submissionId}-${Date.now()}`, // Unique per submit so Closed updates re-enqueue after completed Draft runs
          priority: 5
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WorkflowExecutionService] Enqueue failed:', errorText);
        return { success: false, error: errorText };
      }

      const result = await response.json();
      if (result?.success === false || result?.enrollment_blocked) {
        console.warn('[WorkflowExecutionService] Enqueue rejected:', result);
        return {
          success: false,
          queueId: result.queue_id,
          error: result.error || result.enrollment_reason || 'Enqueue rejected',
        };
      }

      console.log('[WorkflowExecutionService] ✅ Workflow enqueued:', result);
      
      return { 
        success: true, 
        queueId: result.queue_id 
      };
    } catch (error) {
      console.error('[WorkflowExecutionService] Enqueue error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async triggerWorkflowsForFormSubmission(
    formId: string,
    submissionData: any,
    submissionId: string,
    submitterId: string,
    options: { useQueue?: boolean; triggerSource?: 'form_submission' | 'manual' | 'bulk' } = {}
  ) {
    const useQueue = options.useQueue ?? QUEUE_ENABLED;
    const triggerSource = options.triggerSource ?? 'form_submission';
    
    // Find matching workflows
    const matchingWorkflows = await WorkflowTrigger.findMatchingWorkflows(formId, submissionData);
    
    if (matchingWorkflows.length === 0) {
      return [];
    }

    const executionResults = [];
    const formOwnerId = await WorkflowTrigger.resolveFormOwner(formId);

    // Execute each matching workflow
    for (const { workflow, matchingNode } of matchingWorkflows) {
      try {
        const triggerData = {
          formId,
          submissionData,
          submissionId,
          submitterId,
          formOwnerId,
          startNodeId: matchingNode.id,
          userEmail: submissionData.userEmail || submissionData.email,
          submitterName: submissionData.submitterName || `${submissionData.firstName || ''} ${submissionData.lastName || ''}`.trim()
        };

        if (useQueue) {
          // Server-side queue execution (reliable, browser-independent)
          const enqueueResult = await this.enqueueWorkflow(
            workflow.id,
            submissionId,
            triggerData,
            triggerSource
          );

          if (enqueueResult.success) {
            executionResults.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              queueId: enqueueResult.queueId,
              success: true,
              queued: true,
            });
            continue;
          }

          console.warn(
            '[WorkflowExecutionService] Queue enqueue failed — falling back to direct execution',
            enqueueResult.error,
          );
        }

        // Direct browser-side execution (legacy path + queue fallback)
        const { WorkflowOrchestrator } = await import('./workflowOrchestrator');
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
          success: executionResult.success,
          queued: false,
          error: executionResult.success ? undefined : (executionResult as any).error,
          fellBackFromQueue: useQueue || undefined,
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

  /**
   * Direct execution without queue - useful for testing or specific use cases
   * This preserves the old behavior for backward compatibility
   */
  static async triggerWorkflowsDirectly(
    formId: string,
    submissionData: any,
    submissionId: string,
    submitterId: string
  ) {
    return this.triggerWorkflowsForFormSubmission(
      formId,
      submissionData,
      submissionId,
      submitterId,
      { useQueue: false }
    );
  }
}
