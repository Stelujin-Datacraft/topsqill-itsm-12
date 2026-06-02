import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  compact?: boolean; // For table row usage - smaller buttons without text
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
  compact = false,
}: ManualWorkflowTriggerProps) {
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, 'success' | 'failed'>>({});
  const { userProfile } = useAuth();

  // Shared, cached fetch across all rows in the table — only one network request per formId.
  const { data: workflows = [], isLoading: loading } = useQuery<AvailableWorkflow[]>({
    queryKey: ['manual-workflow-trigger', formId],
    enabled: !!formId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
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
      if (!workflowsWithNodes || workflowsWithNodes.length === 0) return [];

      const available: AvailableWorkflow[] = [];
      for (const workflow of workflowsWithNodes as any[]) {
        const nodes = workflow.workflow_nodes || [];
        for (const node of nodes) {
          let cfg: any = {};
          try {
            cfg = typeof node.config === 'string' ? JSON.parse(node.config) : node.config || {};
          } catch {
            cfg = {};
          }
          const triggerType = cfg.triggerType || 'form_submission';
          const triggerFormId = cfg.triggerFormId;
          if (
            (triggerType === 'form_submission' || triggerType === 'form_completion') &&
            triggerFormId === formId
          ) {
            available.push({
              id: workflow.id,
              name: workflow.name,
              description: workflow.description || undefined,
              startNodeId: node.id,
            });
            break;
          }
        }
      }
      return available;
    },
  });

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

  // While the (shared) workflow list is loading, render nothing instead of
  // a per-row spinner. Avoids the "multiple loading circles" across the table.
  if (loading) return null;

  if (workflows.length === 0) {
    return null; // Don't show button if no workflows available
  }

  if (workflows.length === 1) {
    // Single workflow - show direct button
    const workflow = workflows[0];
    const isExecuting = executing === workflow.id;
    const result = executionResults[workflow.id];

    if (compact) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleTriggerWorkflow(workflow);
          }}
          disabled={isExecuting}
          className={`h-6 w-6 p-0 hover:bg-emerald-500/10 ${
            result === 'success'
              ? 'text-green-600'
              : result === 'failed'
              ? 'text-red-600'
              : 'text-emerald-500'
          }`}
          title={`Run workflow: ${workflow.name}`}
        >
          {isExecuting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : result === 'success' ? (
            <CheckCircle className="h-3 w-3" />
          ) : result === 'failed' ? (
            <XCircle className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
        </Button>
      );
    }

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
        <Button 
          variant={compact ? "ghost" : "outline"} 
          size="sm" 
          disabled={executing !== null}
          className={compact ? "h-6 w-6 p-0 hover:bg-emerald-500/10 text-emerald-500" : ""}
          title={compact ? "Run workflow" : undefined}
          onClick={(e) => compact && e.stopPropagation()}
        >
          {executing ? (
            <Loader2 className={`${compact ? 'h-3 w-3' : 'h-4 w-4 mr-1'} animate-spin`} />
          ) : (
            <GitBranch className={compact ? 'h-3 w-3' : 'h-4 w-4 mr-1'} />
          )}
          {!compact && (
            <>
              Run Workflow
              <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-background">
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
