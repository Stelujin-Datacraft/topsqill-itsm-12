
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContent } from '@/components/layouts/PageContent';
import { WorkflowDesigner } from '@/components/workflows/WorkflowDesigner';
import { WorkflowInstances } from '@/components/workflows/WorkflowInstances';

import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useAuth } from '@/contexts/AuthContext';
import { TriggerService } from '@/services/triggerService';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, ArrowLeft, Activity, Play, Loader2 } from 'lucide-react';
import { WorkflowNode, WorkflowConnection } from '@/types/workflow';
import { useToast } from '@/hooks/use-toast';

const WorkflowDesignerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadWorkflowNodes, saveWorkflowNodes, workflows } = useWorkflowData();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [workflowData, setWorkflowData] = useState<{
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  }>({
    nodes: [],
    connections: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('designer');

  const currentWorkflow = workflows.find(w => w.id === id);

  const isManualTrigger = workflowData.nodes.some(
    node => node.type === 'start' && node.data?.config?.triggerType === 'manual'
  );

  const handleRunWorkflow = async () => {
    if (!id || !user?.id) return;
    
    setRunning(true);
    try {
      const executionId = await TriggerService.handleManualTrigger(id, {
        triggeredAt: new Date().toISOString(),
        triggeredFrom: 'workflow_designer'
      }, user.id);
      
      toast({
        title: "Workflow Started",
        description: `Workflow execution started. ID: ${executionId?.slice(0, 8)}...`,
      });
      
      setActiveTab('instances');
    } catch (error) {
      console.error('Error running workflow:', error);
      toast({
        title: "Failed to run workflow",
        description: "Could not start workflow execution. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadWorkflowData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        console.log('Loading workflow data for ID:', id);
        const { nodes, connections } = await loadWorkflowNodes(id);
        
        if (!isMounted) return;

        console.log('Loaded workflow data:', { nodes: nodes.length, connections: connections.length });
        
        setWorkflowData({ nodes, connections });
      } catch (error) {
        console.error('Error loading workflow data:', error);
        if (isMounted) {
          toast({
            title: "Error loading workflow",
            description: "Failed to load workflow data. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadWorkflowData();
    
    return () => {
      isMounted = false;
    };
  }, [id, loadWorkflowNodes, toast]);

  const handleSave = async (nodes: WorkflowNode[], connections: WorkflowConnection[]) => {
    if (!id) return;
    
    setSaving(true);
    console.log('Saving workflow to database...');
    
    try {
      const success = await saveWorkflowNodes(id, nodes, connections);
      
      if (success) {
        toast({
          title: "Workflow saved",
          description: "Your workflow has been saved successfully.",
        });
        
        setWorkflowData({ nodes: [...nodes], connections: [...connections] });
      } else {
        toast({
          title: "Save failed",
          description: "Failed to save workflow. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: "Save failed",
        description: "Failed to save workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBackToList = () => {
    navigate('/workflows');
  };

  const headerActions = (
    <div className="flex space-x-2">
      {isManualTrigger && (
        <Button 
          variant="default" 
          onClick={handleRunWorkflow}
          disabled={running}
        >
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {running ? 'Running...' : 'Run Workflow'}
        </Button>
      )}
      <Button variant="outline" onClick={handleBackToList}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Workflows
      </Button>
    </div>
  );

  if (loading) {
    return (
      <PageContent title="Workflow Designer">
        <div className="flex items-center justify-center h-full">
          <div>Loading workflow...</div>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent 
      title={`Workflow Designer${currentWorkflow ? ` - ${currentWorkflow.name}` : ''}`}
      actions={headerActions}
    >
      <div className="h-[calc(100vh-140px)] flex flex-col">
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="designer" className="flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Designer</span>
            </TabsTrigger>
            <TabsTrigger value="instances" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Execution History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="designer" className="flex-1">
            <WorkflowDesigner
              workflowId={id}
              projectId={currentWorkflow?.projectId}
              initialNodes={workflowData.nodes}
              initialConnections={workflowData.connections}
              onSave={handleSave}
            />
          </TabsContent>

          <TabsContent value="instances" className="flex-1">
            <WorkflowInstances workflowId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </PageContent>
  );
};

export default WorkflowDesignerPage;
