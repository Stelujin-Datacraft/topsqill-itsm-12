
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { WorkflowAccessManager } from '@/components/workflows/WorkflowAccessManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LoadingScreen } from '@/components/LoadingScreen';

const WorkflowAccessManagement = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workflows, isLoading: loading } = useWorkflowData();
  
  const workflow = workflows.find(w => w.id === id);

  if (loading) {
    return (
      <DashboardLayout title="Workflow Access Management">
        <LoadingScreen message="Loading workflow access..." />
      </DashboardLayout>
    );
  }

  if (!workflow) {
    return (
      <DashboardLayout title="Workflow Access Management">
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
    <DashboardLayout title="Workflow Access Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/workflows')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Button>
        </div>

        <WorkflowAccessManager 
          workflowId={workflow.id} 
          workflowName={workflow.name}
        />
      </div>
    </DashboardLayout>
  );
};

export default WorkflowAccessManagement;
