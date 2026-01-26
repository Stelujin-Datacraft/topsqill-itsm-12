import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Play, Loader2, GitBranch, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { WorkflowExecutionService } from '@/services/workflow/workflowTrigger';
import { useAuth } from '@/contexts/AuthContext';

interface ManualWorkflowTriggerProps {
  formId: string;
  submissionId: string;
  submissionData: Record<string, any>;
  submissionRefId?: string;
}

interface AvailableWorkflow {
  id: string;
  name: string;
  description?: string;
  startNodeId: string;
}

export function ManualWorkflowTrigger({
  formId,
  submissionId,
  submissionData,
  submissionRefId,
}: ManualWorkflowTriggerProps) {
  const [workflows, setWorkflows] = useState<AvailableWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, 'success' | 'failed'>>({});
  const { userProfile } = useAuth();

  // Load available workflows for this form
  useEffect(() => {
    loadAvailableWorkflows();
  }, [formId]);

  const loadAvailableWorkflows = async () => {
    setLoading(true);
    try {
      // Find all active workflows that can be triggered by this form
      const { data: workflowsData, error: workflowError } = await supabase
        .from('workflows')
        .select('id, name, description')
        .eq('status', 'active');

      if (workflowError) throw workflowError;

      if (!workflowsData || workflowsData.length === 0) {
        setWorkflows([]);
        return;
      }

      const availableWorkflows: AvailableWorkflow[] = [];

      // Check each workflow for start nodes that match this form
      for (const workflow of workflowsData) {
        const { data: nodes } = await supabase
          .from('workflow_nodes')
          .select('id, config')
          .eq('workflow_id', workflow.id)
          .eq('node_type', 'start');

        if (nodes && nodes.length > 0) {
          for (const node of nodes) {
            let config: any = {};
            try {
              config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config || {};
            } catch {
              config = {};
            }

            const triggerType = config.triggerType || 'form_submission';
            const triggerFormId = config.triggerFormId;

            // Include workflows that trigger on this form's submission/completion
            if (
              (triggerType === 'form_submission' || triggerType === 'form_completion') &&
              triggerFormId === formId
            ) {
              availableWorkflows.push({
                id: workflow.id,
                name: workflow.name,
                description: workflow.description || undefined,
                startNodeId: node.id,
              });
              break; // Only add workflow once even if multiple start nodes match
            }
          }
        }
      }

      setWorkflows(availableWorkflows);
    } catch (error) {
      console.error('Error loading available workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerWorkflow = async (workflow: AvailableWorkflow) => {
    setExecuting(workflow.id);
    
    try {
      // Prepare enhanced submission data
      const enhancedData = {
        ...submissionData,
        userEmail: userProfile?.email || submissionData.email,
        submittedBy: userProfile?.id,
        submitterName: userProfile
          ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
          : '',
        submissionRefId,
        manualTrigger: true,
        triggeredAt: new Date().toISOString(),
      };

      // Trigger the workflow
      const results = await WorkflowExecutionService.triggerWorkflowsForFormSubmission(
        formId,
        enhancedData,
        submissionId,
        userProfile?.id || ''
      );

      // Check results for this specific workflow
      const workflowResult = results.find((r) => r.workflowId === workflow.id);
      
      if (workflowResult?.success) {
        setExecutionResults((prev) => ({ ...prev, [workflow.id]: 'success' }));
        toast({
          title: 'Workflow Started',
          description: `"${workflow.name}" has been triggered for this record.`,
        });
      } else {
        setExecutionResults((prev) => ({ ...prev, [workflow.id]: 'failed' }));
        toast({
          title: 'Workflow Failed',
          description: workflowResult?.error || 'Failed to start workflow.',
          variant: 'destructive',
        });
      }

      // Clear result status after 5 seconds
      setTimeout(() => {
        setExecutionResults((prev) => {
          const updated = { ...prev };
          delete updated[workflow.id];
          return updated;
        });
      }, 5000);
    } catch (error) {
      console.error('Error triggering workflow:', error);
      setExecutionResults((prev) => ({ ...prev, [workflow.id]: 'failed' }));
      toast({
        title: 'Error',
        description: 'Failed to trigger workflow. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExecuting(null);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (workflows.length === 0) {
    return null; // Don't show button if no workflows available
  }

  if (workflows.length === 1) {
    // Single workflow - show direct button
    const workflow = workflows[0];
    const isExecuting = executing === workflow.id;
    const result = executionResults[workflow.id];

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleTriggerWorkflow(workflow)}
        disabled={isExecuting}
        className={
          result === 'success'
            ? 'border-green-500 text-green-600'
            : result === 'failed'
            ? 'border-red-500 text-red-600'
            : ''
        }
      >
        {isExecuting ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : result === 'success' ? (
          <CheckCircle className="h-4 w-4 mr-1" />
        ) : result === 'failed' ? (
          <XCircle className="h-4 w-4 mr-1" />
        ) : (
          <Play className="h-4 w-4 mr-1" />
        )}
        Run Workflow
      </Button>
    );
  }

  // Multiple workflows - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={executing !== null}>
          {executing ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <GitBranch className="h-4 w-4 mr-1" />
          )}
          Run Workflow
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Available Workflows
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workflows.map((workflow) => {
          const isExecuting = executing === workflow.id;
          const result = executionResults[workflow.id];

          return (
            <DropdownMenuItem
              key={workflow.id}
              onClick={() => handleTriggerWorkflow(workflow)}
              disabled={isExecuting}
              className="flex items-center gap-2 cursor-pointer"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : result === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : result === 'failed' ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <Play className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{workflow.name}</span>
                {workflow.description && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {workflow.description}
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
