
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { ExecutionNodeAccordion } from './ExecutionNodeAccordion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkflowExecution {
  id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  trigger_data: any;
  current_node_id?: string;
}

interface WorkflowInstancesProps {
  workflowId?: string;
}

export function WorkflowInstances({ workflowId }: WorkflowInstancesProps) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (workflowId) {
      loadExecutions();
    }
  }, [workflowId]);

  const loadExecutions = async () => {
    if (!workflowId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false });

      if (error) throw error;

      setExecutions(data || []);
    } catch (error) {
      console.error('Error loading workflow executions:', error);
      toast({
        title: "Error",
        description: "Failed to load workflow executions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (executionId: string) => {
    setSelectedExecution(executionId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatDuration = (started: string, completed?: string) => {
    if (!completed) return 'In progress';
    const start = new Date(started);
    const end = new Date(completed);
    const duration = end.getTime() - start.getTime();
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading executions...</div>
        </CardContent>
      </Card>
    );
  }

  if (!workflowId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Select a workflow to view execution history
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Execution History</CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No executions found for this workflow
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        <Badge className={getStatusColor(execution.status)}>
                          {execution.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(execution.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {formatDuration(execution.started_at, execution.completed_at)}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-500">
                        {execution.trigger_data?.triggerType || 'Unknown'}
                        {execution.trigger_data?.formId && (
                          <div>Form: {execution.trigger_data.formId}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(execution.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedExecution && workflowId && (
        <ExecutionNodeAccordion
          executionId={selectedExecution}
          workflowId={workflowId}
          currentNodeId={executions.find(e => e.id === selectedExecution)?.current_node_id}
        />
      )}
    </div>
  );
}
