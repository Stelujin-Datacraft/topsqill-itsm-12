
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Activity, FileText, Clock, CheckCircle, XCircle, AlertTriangle, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowNode {
  id: string;
  node_type: string;
  label: string;
  config: any;
  position_x: number;
  position_y: number;
}

interface ExecutionLog {
  id: string;
  node_id: string;
  node_type: string;
  node_label: string;
  status: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  input_data: any;
  output_data: any;
  error_message?: string;
  action_type?: string;
  action_details?: any;
  action_result?: any;
  execution_order: number;
}

interface ExecutionNodeAccordionProps {
  executionId: string;
  workflowId: string;
  currentNodeId?: string;
}

export function ExecutionNodeAccordion({ executionId, workflowId, currentNodeId }: ExecutionNodeAccordionProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<{ nodeId: string; type: 'logs' | 'action' | 'input' | 'output' | 'config' } | null>(null);

  useEffect(() => {
    loadWorkflowNodes();
    loadExecutionLogs();
  }, [workflowId, executionId]);

  const loadWorkflowNodes = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('position_x', { ascending: true });

      if (error) throw error;
      setNodes(data || []);
    } catch (error) {
      console.error('Error loading workflow nodes:', error);
    }
  };

  const loadExecutionLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_instance_logs')
        .select('*')
        .eq('execution_id', executionId)
        .order('execution_order', { ascending: true });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading execution logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNodeStatus = (nodeId: string) => {
    const log = logs.find(l => l.node_id === nodeId);
    if (!log) return 'not_started';
    // Use the actual log status from the database - don't override with 'running'
    // just because it's the current_node_id (which tracks the last node reached)
    return log.status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'not_started':
        return <Clock className="h-4 w-4 text-gray-300" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'not_started':
        return 'bg-gray-50 text-gray-400 border-gray-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getNodeOpacity = (status: string) => {
    return status === 'not_started' ? 'opacity-50' : 'opacity-100';
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  const getNodeLog = (nodeId: string) => {
    return logs.find(l => l.node_id === nodeId);
  };

  const renderDetailView = (nodeId: string, type: string) => {
    const log = getNodeLog(nodeId);
    const node = nodes.find(n => n.id === nodeId);

    if (!log && type !== 'config') return <div className="text-gray-500 text-sm">No execution data available</div>;

    switch (type) {
      case 'logs':
        return (
          <div className="space-y-2 text-sm">
            <div><strong>Node:</strong> {log?.node_label}</div>
            <div><strong>Type:</strong> {log?.node_type}</div>
            <div><strong>Status:</strong> {log?.status}</div>
            <div><strong>Started:</strong> {log?.started_at ? new Date(log.started_at).toLocaleString() : 'N/A'}</div>
            {log?.completed_at && (
              <div><strong>Completed:</strong> {new Date(log.completed_at).toLocaleString()}</div>
            )}
            <div><strong>Duration:</strong> {formatDuration(log?.duration_ms)}</div>
            {log?.error_message && (
              <div className="text-red-600">
                <strong>Error:</strong> {log.error_message}
              </div>
            )}
          </div>
        );
      case 'action':
        return (
          <div className="space-y-2 text-sm">
            {log?.action_type ? (
              <>
                <div><strong>Action Type:</strong> {log.action_type}</div>
                <div><strong>Details:</strong></div>
                <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(log.action_details, null, 2)}
                </pre>
                <div><strong>Result:</strong></div>
                <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(log.action_result, null, 2)}
                </pre>
              </>
            ) : (
              <div className="text-gray-500">No action data available</div>
            )}
          </div>
        );
      case 'input':
        return (
          <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-60">
            {JSON.stringify(log?.input_data, null, 2)}
          </pre>
        );
      case 'output':
        return (
          <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-60">
            {JSON.stringify(log?.output_data, null, 2)}
          </pre>
        );
      case 'config':
        return (
          <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-60">
            {JSON.stringify(node?.config, null, 2)}
          </pre>
        );
      default:
        return <div className="text-gray-500 text-sm">Unknown view type</div>;
    }
  };

  if (loading) {
    return <div className="text-center p-4">Loading node execution details...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Node Execution Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {nodes.map((node) => {
            const status = getNodeStatus(node.id);
            const log = getNodeLog(node.id);
            
            return (
              <AccordionItem key={node.id} value={node.id}>
                <AccordionTrigger className={`${getNodeOpacity(status)} hover:no-underline`}>
                  <div className="flex items-center justify-between w-full mr-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(status)}
                      <span className="font-medium">{node.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {node.node_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${getStatusColor(status)}`}>
                        {status === 'not_started' ? 'Not Started' : status}
                      </Badge>
                      {log && (
                        <span className="text-xs text-gray-500">
                          {formatDuration(log.duration_ms)}
                        </span>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4">
                    <div className="flex gap-2 mb-4 flex-wrap">
                      <Button
                        size="sm"
                        variant={selectedView?.nodeId === node.id && selectedView?.type === 'logs' ? 'default' : 'outline'}
                        onClick={() => setSelectedView({ nodeId: node.id, type: 'logs' })}
                        disabled={!log}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Logs
                      </Button>
                      {log?.action_type && (
                        <Button
                          size="sm"
                          variant={selectedView?.nodeId === node.id && selectedView?.type === 'action' ? 'default' : 'outline'}
                          onClick={() => setSelectedView({ nodeId: node.id, type: 'action' })}
                        >
                          <Activity className="h-3 w-3 mr-1" />
                          Action
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={selectedView?.nodeId === node.id && selectedView?.type === 'input' ? 'default' : 'outline'}
                        onClick={() => setSelectedView({ nodeId: node.id, type: 'input' })}
                        disabled={!log}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Input
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedView?.nodeId === node.id && selectedView?.type === 'output' ? 'default' : 'outline'}
                        onClick={() => setSelectedView({ nodeId: node.id, type: 'output' })}
                        disabled={!log}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Output
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedView?.nodeId === node.id && selectedView?.type === 'config' ? 'default' : 'outline'}
                        onClick={() => setSelectedView({ nodeId: node.id, type: 'config' })}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Config
                      </Button>
                    </div>

                    {selectedView?.nodeId === node.id && (
                      <ScrollArea className="h-60 border rounded p-3">
                        {renderDetailView(node.id, selectedView.type)}
                      </ScrollArea>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
