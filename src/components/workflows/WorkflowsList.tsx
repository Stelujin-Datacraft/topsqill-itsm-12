
import React, { useState } from 'react';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { Workflow } from '@/types/workflow';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, FileText, Calendar, User, Eye, Edit, Trash2, Play, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { CreateWorkflowDialog } from './CreateWorkflowDialog';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';

export interface WorkflowsListProps {
  workflows: Workflow[];
  onView: (workflow: Workflow) => void;
  onEdit: (workflow: Workflow) => void;
  onDelete: (workflowId: string) => void;
  getPermissions?: (workflow: Workflow) => { canEdit: boolean; canDelete: boolean; canView: boolean };
}

export function WorkflowsList({ workflows, onEdit, onDelete, onView, getPermissions }: WorkflowsListProps) {
  const { createWorkflow, updateWorkflow } = useWorkflowData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { getButtonState, checkPermissionWithAlert } = useUnifiedAccessControl();

  const handleCreateWorkflow = async (workflowId: string) => {
    try {
      // Workflow creation is handled by the dialog
      toast({
        title: "Success",
        description: "Workflow created successfully",
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: "Error", 
        description: "Failed to create workflow",
        variant: "destructive",
      });
    }
  };

  const handleActivateWorkflow = async (workflow: Workflow) => {
    if (!checkPermissionWithAlert('workflows', 'update', workflow.id)) {
      return;
    }

    try {
      await updateWorkflow({
        ...workflow,
        status: 'active'
      });
      toast({
        title: "Success",
        description: "Workflow activated successfully",
      });
    } catch (error) {
      console.error('Error activating workflow:', error);
      toast({
        title: "Error",
        description: "Failed to activate workflow",
        variant: "destructive",
      });
    }
  };

  const handleAccessManagement = (workflow: Workflow) => {
    navigate(`/workflow-access/${workflow.id}`);
  };

  const handleEditClick = (workflow: Workflow) => {
    if (!checkPermissionWithAlert('workflows', 'update', workflow.id)) {
      return;
    }
    onEdit(workflow);
  };

  const handleDeleteClick = (workflow: Workflow) => {
    if (!checkPermissionWithAlert('workflows', 'delete', workflow.id)) {
      return;
    }
    onDelete(workflow.id);
  };

  const createButtonState = getButtonState('workflows', 'create');

  if (!workflows) {
    return <LoadingScreen message="Loading workflows..." />;
  }

  const CreateWorkflowButton = () => (
    <Button 
      disabled={createButtonState.disabled}
      onClick={() => createButtonState.disabled ? checkPermissionWithAlert('workflows', 'create') : undefined}
    >
      <Plus className="h-4 w-4 mr-2" />
      Create Your First Workflow
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflows</h2>
          <p className="text-muted-foreground">
            Automate your processes with visual workflows
          </p>
        </div>
        <CreateWorkflowDialog onWorkflowCreated={handleCreateWorkflow} />
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">No workflows yet</h3>
                <p className="text-muted-foreground">
                  Get started by creating your first workflow to automate your
                  processes.
                </p>
              </div>
              {createButtonState.disabled ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <CreateWorkflowButton />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{createButtonState.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <CreateWorkflowDialog onWorkflowCreated={handleCreateWorkflow} />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => {
            const editButtonState = getButtonState('workflows', 'update', workflow.id);
            const deleteButtonState = getButtonState('workflows', 'delete', workflow.id);
            
            return (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      {workflow.description && (
                        <CardDescription>{workflow.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(workflow)}
                        title="View Workflow"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(workflow)}
                              disabled={editButtonState.disabled}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Workflow"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAccessManagement(workflow)}
                        title="Manage Access"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(workflow)}
                              disabled={deleteButtonState.disabled}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{deleteButtonState.disabled ? deleteButtonState.tooltip : "Delete Workflow"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(workflow.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                    <Badge 
                      variant={workflow.status === 'active' ? 'default' : 'secondary'}
                    >
                      {workflow.status}
                    </Badge>
                  </div>
                  
                  {workflow.status === 'draft' && !editButtonState.disabled && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleActivateWorkflow(workflow)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Activate Workflow
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
