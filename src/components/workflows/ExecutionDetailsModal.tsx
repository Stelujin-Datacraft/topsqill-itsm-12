
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, FileText, Activity, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExecutionLog {
  id: string;
  node_id: string;
  node_type: string;
  node_label: string;
  status: string; // Changed from union type to string
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

interface ExecutionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  executionId: string;
  executionLogs: ExecutionLog[];
}

export function ExecutionDetailsModal({ isOpen, onClose, executionId, executionLogs }: ExecutionDetailsModalProps) {
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);
  const [viewType, setViewType] = useState<'logs' | 'action' | 'input' | 'output'>('logs');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
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

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  const sortedLogs = [...executionLogs].sort((a, b) => a.execution_order - b.execution_order);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Execution Details - {executionId}</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4 h-[60vh]">
          {/* Node Execution List */}
          <div className="w-1/2 border-r pr-4">
            <h3 className="font-semibold mb-3">Node Executions</h3>
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {sortedLogs.map((log) => (
                  <Card 
                    key={log.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedLog?.id === log.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="font-medium text-sm">{log.node_label}</span>
                        </div>
                        <Badge className={getStatusColor(log.status)}>
                          {log.status}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Type: {log.node_type}</div>
                        {log.action_type && <div>Action: {log.action_type}</div>}
                        <div>Duration: {formatDuration(log.duration_ms)}</div>
                      </div>
                      
                      <div className="flex gap-1 mt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-6 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                            setViewType('logs');
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Logs
                        </Button>
                        {log.action_type && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                              setViewType('action');
                            }}
                          >
                            <Activity className="h-3 w-3 mr-1" />
                            Action
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-6 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                            setViewType('input');
                          }}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Input
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Details Panel */}
          <div className="w-1/2">
            {selectedLog ? (
              <div>
                <div className="flex gap-2 mb-3">
                  <Button 
                    size="sm" 
                    variant={viewType === 'logs' ? 'default' : 'outline'}
                    onClick={() => setViewType('logs')}
                  >
                    Logs
                  </Button>
                  {selectedLog.action_type && (
                    <Button 
                      size="sm" 
                      variant={viewType === 'action' ? 'default' : 'outline'}
                      onClick={() => setViewType('action')}
                    >
                      Action
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant={viewType === 'input' ? 'default' : 'outline'}
                    onClick={() => setViewType('input')}
                  >
                    Input
                  </Button>
                  <Button 
                    size="sm" 
                    variant={viewType === 'output' ? 'default' : 'outline'}
                    onClick={() => setViewType('output')}
                  >
                    Output
                  </Button>
                </div>

                <ScrollArea className="h-[45vh]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {viewType === 'logs' && 'Execution Logs'}
                        {viewType === 'action' && 'Action Details'}
                        {viewType === 'input' && 'Input Data'}
                        {viewType === 'output' && 'Output Data'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {viewType === 'logs' && (
                        <div className="space-y-2 text-xs">
                          <div><strong>Node:</strong> {selectedLog.node_label}</div>
                          <div><strong>Type:</strong> {selectedLog.node_type}</div>
                          <div><strong>Status:</strong> {selectedLog.status}</div>
                          <div><strong>Started:</strong> {new Date(selectedLog.started_at).toLocaleString()}</div>
                          {selectedLog.completed_at && (
                            <div><strong>Completed:</strong> {new Date(selectedLog.completed_at).toLocaleString()}</div>
                          )}
                          <div><strong>Duration:</strong> {formatDuration(selectedLog.duration_ms)}</div>
                          {selectedLog.error_message && (
                            <div className="text-red-600">
                              <strong>Error:</strong> {selectedLog.error_message}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {viewType === 'action' && (
                        <div className="space-y-2 text-xs">
                          {selectedLog.action_type ? (
                            <>
                              <div><strong>Action Type:</strong> {selectedLog.action_type}</div>
                              <div><strong>Details:</strong></div>
                              <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                                {JSON.stringify(selectedLog.action_details, null, 2)}
                              </pre>
                              <div><strong>Result:</strong></div>
                              <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                                {JSON.stringify(selectedLog.action_result, null, 2)}
                              </pre>
                            </>
                          ) : (
                            <div className="text-gray-500">No action data available</div>
                          )}
                        </div>
                      )}
                      
                      {viewType === 'input' && (
                        <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                          {JSON.stringify(selectedLog.input_data, null, 2)}
                        </pre>
                      )}
                      
                      {viewType === 'output' && (
                        <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                          {JSON.stringify(selectedLog.output_data, null, 2)}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center text-gray-500 mt-8">
                Select a node execution to view details
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
