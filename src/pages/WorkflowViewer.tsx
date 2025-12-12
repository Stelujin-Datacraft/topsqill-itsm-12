import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import DashboardLayout from '@/components/DashboardLayout';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Calendar, 
  Copy,
  Edit,
  Eye,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Workflow, WorkflowNode, WorkflowConnection } from '@/types/workflow';
import { WorkflowInstances } from '@/components/workflows/WorkflowInstances';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StartNode } from '@/components/workflows/nodes/StartNode';
import { ConditionNode } from '@/components/workflows/nodes/ConditionNode';
import { WaitNode } from '@/components/workflows/nodes/WaitNode';
import { EndNode } from '@/components/workflows/nodes/EndNode';
import { ActionNode } from '@/components/workflows/nodes/ActionNode';
import { ApprovalNode } from '@/components/workflows/nodes/ApprovalNode';
import { LabeledEdge } from '@/components/workflows/edges/LabeledEdge';

const nodeTypes: NodeTypes = {
  'start': StartNode,
  'action': ActionNode,
  'approval': ApprovalNode,
  'condition': ConditionNode,
  'wait': WaitNode,
  'end': EndNode,
};

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

const WorkflowViewerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workflows, loadWorkflowNodes } = useWorkflowData();
  const { toast } = useToast();
  
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<WorkflowConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Empty ref for read-only mode (nodes won't be selectable)
  const emptySelectRef = useRef(() => {});

  useEffect(() => {
    if (id) {
      loadWorkflowData();
    }
  }, [id, workflows]);

  const loadWorkflowData = async () => {
    try {
      setLoading(true);
      
      const foundWorkflow = workflows.find(w => w.id === id);
      if (foundWorkflow) {
        setWorkflow(foundWorkflow);
        
        // Load workflow nodes and connections
        const { nodes: workflowNodes, connections: workflowConnections } = await loadWorkflowNodes(foundWorkflow.id);
        setNodes(workflowNodes);
        setConnections(workflowConnections);
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
      toast({
        title: "Error",
        description: "Failed to load workflow data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const workflowUrl = `${window.location.origin}/workflow-view/${id}`;
    navigator.clipboard.writeText(workflowUrl);
    toast({
      title: "Link copied",
      description: "Workflow link copied to clipboard",
    });
  };

  // Convert workflow nodes to React Flow format
  const reactFlowNodes: Node[] = useMemo(() => {
    return nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      data: {
        label: node.label,
        config: node.data?.config || {},
        nodeId: node.id,
        onSelect: emptySelectRef,
      },
      draggable: false,
      selectable: false,
      connectable: false,
    }));
  }, [nodes]);

  // Convert workflow connections to React Flow edges
  const reactFlowEdges: Edge[] = useMemo(() => {
    return connections.map(conn => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle,
      targetHandle: conn.targetHandle,
      type: 'labeled',
      data: { label: conn.label || '' },
    }));
  }, [connections]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'inactive':
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Workflow Viewer">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading workflow...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!workflow) {
    return (
      <DashboardLayout title="Workflow Viewer">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Workflow not found</p>
          <Button onClick={() => navigate('/workflows')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title=""
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/workflow-designer/${id}`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Workflow
          </Button>
          <Button variant="outline" onClick={() => navigate('/workflows')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{workflow.name}</h1>
              {getStatusBadge(workflow.status)}
            </div>
            {workflow.description && (
              <p className="text-muted-foreground">{workflow.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Created {format(new Date(workflow.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">
              <Eye className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="history">
              <Activity className="h-4 w-4 mr-2" />
              Execution History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Workflow Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Nodes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{nodes.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{connections.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {getStatusBadge(workflow.status)}
                </CardContent>
              </Card>
            </div>

            {/* Workflow Canvas - Read-only React Flow */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Diagram</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {nodes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No nodes configured in this workflow
                  </div>
                ) : (
                  <div className="h-[500px] w-full border-t">
                    <ReactFlowProvider>
                      <ReactFlow
                        nodes={reactFlowNodes}
                        edges={reactFlowEdges}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={false}
                        panOnDrag={true}
                        zoomOnScroll={true}
                        preventScrolling={false}
                      >
                        <Controls showInteractive={false} />
                        <MiniMap 
                          nodeColor={(node) => {
                            switch (node.type) {
                              case 'start': return '#22c55e';
                              case 'action': return '#3b82f6';
                              case 'condition': return '#eab308';
                              case 'end': return '#ef4444';
                              case 'approval': return '#a855f7';
                              default: return '#6b7280';
                            }
                          }}
                        />
                        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                      </ReactFlow>
                    </ReactFlowProvider>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <WorkflowInstances workflowId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default WorkflowViewerPage;
