 import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkflowsList } from '@/components/workflows/WorkflowsList';
import { CreateWorkflowDialog } from '@/components/workflows/CreateWorkflowDialog';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { Workflow } from '@/types/workflow';
import NoProjectSelected from '@/components/NoProjectSelected';
 import { useToast } from '@/hooks/use-toast';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { WorkflowQueueMonitor } from '@/components/workflows/WorkflowQueueMonitor';
 import { ListTree, Inbox } from 'lucide-react';

const Workflows = () => {
  const navigate = useNavigate();
  const { workflows, deleteWorkflow } = useWorkflowData();
  const { hasPermission, checkPermissionWithAlert, getVisibleResources, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();
  const { toast } = useToast();
 const [activeTab, setActiveTab] = useState('workflows');

  const handleWorkflowCreated = (workflowId: string) => {
    toast({
      title: "Success",
      description: "Workflow created successfully",
    });
  };

  if (!currentProject) {
    return (
      <DashboardLayout title="Workflows">
        <NoProjectSelected />
      </DashboardLayout>
    );
  }

  // Check if user can even see the workflows page
  const canReadWorkflows = hasPermission('workflows', 'read');
  
  if (!permissionLoading && !canReadWorkflows) {
    return (
      <DashboardLayout title="Workflows">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view workflows in this project.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleViewWorkflow = (workflow: Workflow) => {
    navigate(`/workflow-view/${workflow.id}`);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    if (checkPermissionWithAlert('workflows', 'update', workflow.id)) {
      navigate(`/workflow-designer/${workflow.id}`);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (checkPermissionWithAlert('workflows', 'delete', workflowId)) {
      try {
        await deleteWorkflow(workflowId);
      } catch (error) {
        console.error('Error deleting workflow:', error);
      }
    }
  };

  // Filter workflows based on user's permissions
  const visibleWorkflows = getVisibleResources('workflows', workflows);

 return (
   <DashboardLayout 
     title="Workflows"
     description="Design and manage automated workflows and business processes"
     actions={activeTab === 'workflows' ? <CreateWorkflowDialog onWorkflowCreated={handleWorkflowCreated} /> : undefined}
   >
     <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
       <TabsList>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <ListTree className="h-4 w-4 text-primary" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-orange-600" />
            Queue Monitor
          </TabsTrigger>
       </TabsList>
 
       <TabsContent value="workflows">
         <WorkflowsList
           workflows={visibleWorkflows}
           onView={handleViewWorkflow}
           onEdit={handleEditWorkflow}
           onDelete={handleDeleteWorkflow}
         />
       </TabsContent>
 
       <TabsContent value="queue">
         <WorkflowQueueMonitor />
       </TabsContent>
     </Tabs>
   </DashboardLayout>
 );
};

export default Workflows;
