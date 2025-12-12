import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Share2, 
  Calendar, 
  User, 
  Eye,
  Copy,
  Edit,
  Play,
  Circle,
  Square,
  Diamond,
  CheckCircle,
  XCircle,
  Clock,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Workflow, WorkflowNode, WorkflowConnection } from '@/types/workflow';
import { WorkflowInstances } from '@/components/workflows/WorkflowInstances';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'start':
        return <Circle className="h-4 w-4 text-green-500" />;
      case 'action':
        return <Square className="h-4 w-4 text-blue-500" />;
      case 'condition':
        return <Diamond className="h-4 w-4 text-yellow-500" />;
      case 'end':
        return <CheckCircle className="h-4 w-4 text-red-500" />;
      case 'approval':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

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

            {/* Workflow Nodes */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Nodes</CardTitle>
                <CardDescription>Visual representation of workflow steps</CardDescription>
              </CardHeader>
              <CardContent>
                {nodes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No nodes configured in this workflow
                  </div>
                ) : (
                  <div className="space-y-3">
                    {nodes.map((node, index) => (
                      <div 
                        key={node.id} 
                        className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border">
                          {getNodeIcon(node.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{node.label}</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {node.type}
                            </Badge>
                          </div>
                          {node.data && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {node.type === 'start' && node.data.triggerType && (
                                <span>Trigger: {node.data.triggerType}</span>
                              )}
                              {node.type === 'action' && node.data.actionType && (
                                <span>Action: {node.data.actionType.replace(/_/g, ' ')}</span>
                              )}
                              {node.type === 'condition' && (
                                <span>Condition evaluation</span>
                              )}
                            </div>
                          )}
                        </div>
                        {index < nodes.length - 1 && (
                          <div className="text-muted-foreground">→</div>
                        )}
                      </div>
                    ))}
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
