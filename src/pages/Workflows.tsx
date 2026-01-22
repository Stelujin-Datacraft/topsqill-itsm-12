
import React from 'react';
import { PageContent } from '@/components/layouts/PageContent';
import { WorkflowsList } from '@/components/workflows/WorkflowsList';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { Workflow } from '@/types/workflow';
import NoProjectSelected from '@/components/NoProjectSelected';

const Workflows = () => {
  const navigate = useNavigate();
  const { workflows, deleteWorkflow, isLoading: workflowsLoading } = useWorkflowData();
  const { hasPermission, checkPermissionWithAlert, getVisibleResources, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();

  if (!currentProject) {
    return (
      <PageContent title="Workflows">
        <NoProjectSelected />
      </PageContent>
    );
  }

  // Check if user can even see the workflows page
  const canReadWorkflows = hasPermission('workflows', 'read');
  
  if (!permissionLoading && !canReadWorkflows) {
    return (
      <PageContent title="Workflows">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view workflows in this project.
          </p>
        </div>
      </PageContent>
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

  const getWorkflowPermissions = (workflow: Workflow) => ({
    canEdit: hasPermission('workflows', 'update', workflow.id),
    canDelete: hasPermission('workflows', 'delete', workflow.id),
    canView: hasPermission('workflows', 'read', workflow.id)
  });

  // Filter workflows based on user's permissions
  const visibleWorkflows = getVisibleResources('workflows', workflows);

  // Combined loading state
  const isLoading = workflowsLoading || permissionLoading;

  return (
    <PageContent title="Workflows">
      <WorkflowsList 
        workflows={visibleWorkflows}
        isLoading={isLoading}
        onView={handleViewWorkflow}
        onEdit={handleEditWorkflow}
        onDelete={handleDeleteWorkflow}
        getPermissions={getWorkflowPermissions}
      />
    </PageContent>
  );
};

export default Workflows;
