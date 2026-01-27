import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { WorkflowExecutionService } from '@/services/workflowExecution';

interface AvailableWorkflow {
  id: string;
  name: string;
  description?: string;
  startNodeId: string;
}

interface SubmissionRecord {
  id: string;
  submission_data: Record<string, any>;
  submission_ref_id?: string;
}

export function useBulkWorkflowTrigger(formId: string) {
  const [availableWorkflows, setAvailableWorkflows] = useState<AvailableWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const { userProfile } = useAuth();

  // Load available workflows for this form
  useEffect(() => {
    if (formId) {
      loadAvailableWorkflows();
    }
  }, [formId]);

  const loadAvailableWorkflows = async () => {
    setLoading(true);
    try {
      const { data: workflowsWithNodes, error } = await supabase
        .from('workflows')
        .select(`
          id, 
          name, 
          description,
          workflow_nodes!inner (
            id,
            config
          )
        `)
        .eq('status', 'active')
        .eq('workflow_nodes.node_type', 'start');

      if (error) throw error;

      if (!workflowsWithNodes || workflowsWithNodes.length === 0) {
        setAvailableWorkflows([]);
        return;
      }

      const workflows: AvailableWorkflow[] = [];

      for (const workflow of workflowsWithNodes) {
        const nodes = workflow.workflow_nodes || [];
        
        for (const node of nodes) {
          let config: any = {};
          try {
            config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config || {};
          } catch {
            config = {};
          }

          const triggerType = config.triggerType || 'form_submission';
          const triggerFormId = config.triggerFormId;

          if (
            (triggerType === 'form_submission' || triggerType === 'form_completion') &&
            triggerFormId === formId
          ) {
            workflows.push({
              id: workflow.id,
              name: workflow.name,
              description: workflow.description || undefined,
              startNodeId: node.id,
            });
            break;
          }
        }
      }

      setAvailableWorkflows(workflows);
    } catch (error) {
      console.error('Error loading available workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerWorkflowsForRecords = useCallback(async (
    records: SubmissionRecord[],
    onProgress?: (current: number, total: number) => void
  ) => {
    if (!userProfile?.id || availableWorkflows.length === 0) {
      toast({
        title: 'No Workflows Available',
        description: 'There are no active workflows configured for this form.',
        variant: 'destructive',
      });
      return { success: 0, failed: 0 };
    }

    setExecuting(true);
    let successCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        onProgress?.(i + 1, records.length);

        try {
          const enhancedData = {
            ...record.submission_data,
            userEmail: userProfile.email || record.submission_data?.email,
            submittedBy: userProfile.id,
            submitterName: userProfile
              ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
              : '',
            submissionRefId: record.submission_ref_id,
            manualTrigger: true,
            bulkTrigger: true,
            triggeredAt: new Date().toISOString(),
          };

          const results = await WorkflowExecutionService.triggerWorkflowsForFormSubmission(
            formId,
            enhancedData,
            record.id,
            userProfile.id
          );

          const allSuccessful = results.every((r) => r.success);
          if (allSuccessful && results.length > 0) {
            successCount++;
          } else if (results.length > 0) {
            failedCount++;
          } else {
            // No workflows matched
            successCount++;
          }
        } catch (error) {
          console.error(`Error triggering workflow for record ${record.id}:`, error);
          failedCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Workflows Triggered',
          description: `Successfully triggered workflows for ${successCount} record${successCount > 1 ? 's' : ''}${failedCount > 0 ? `. ${failedCount} failed.` : '.'}`,
        });
      } else if (failedCount > 0) {
        toast({
          title: 'Workflow Trigger Failed',
          description: `Failed to trigger workflows for ${failedCount} record${failedCount > 1 ? 's' : ''}.`,
          variant: 'destructive',
        });
      }

      return { success: successCount, failed: failedCount };
    } finally {
      setExecuting(false);
    }
  }, [formId, userProfile, availableWorkflows]);

  return {
    availableWorkflows,
    hasWorkflows: availableWorkflows.length > 0,
    loading,
    executing,
    triggerWorkflowsForRecords,
    refreshWorkflows: loadAvailableWorkflows,
  };
}
