
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus } from 'lucide-react';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';

interface CreateWorkflowDialogProps {
  onWorkflowCreated: (workflowId: string) => void;
}

export function CreateWorkflowDialog({ onWorkflowCreated }: CreateWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createWorkflow } = useWorkflowData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { getButtonState, checkPermissionWithAlert, hasPermission } = useUnifiedAccessControl();

  const buttonState = getButtonState('workflows', 'create');

  const handleCreate = async () => {
    console.log('🚀 Create workflow button clicked');
    
    if (!hasPermission('workflows', 'create')) {
      console.log('❌ No permission to create workflow');
      checkPermissionWithAlert('workflows', 'create');
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Workflow name is required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      console.log('🔨 Creating workflow with data:', { name: name.trim(), description: description.trim() });
      
      const newWorkflow = await createWorkflow({
        name: name.trim(),
        description: description.trim(),
        status: 'draft'
      });

      console.log('✅ Workflow created successfully:', newWorkflow);
      
      toast({
        title: "Success",
        description: "Workflow created successfully",
      });
      
      // Reset form
      setName('');
      setDescription('');
      setOpen(false);
      
      // Navigate to workflow designer
      navigate(`/workflow-designer/${newWorkflow.id}`);
      
      // Call the callback
      onWorkflowCreated(newWorkflow.id);
    } catch (error) {
      console.error('❌ Error creating workflow:', error);
      toast({
        title: "Error",
        description: "Failed to create workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenDialog = () => {
    console.log('🔍 Opening create workflow dialog, checking permissions...');
    if (!hasPermission('workflows', 'create')) {
      console.log('❌ User does not have create permission');
      checkPermissionWithAlert('workflows', 'create');
      return;
    }
    console.log('✅ User has create permission, opening dialog');
    setOpen(true);
  };

  const CreateButton = () => (
    <Button 
      disabled={buttonState.disabled}
      onClick={buttonState.disabled ? () => checkPermissionWithAlert('workflows', 'create') : handleOpenDialog}
    >
      <Plus className="h-4 w-4 mr-2" />
      Create Workflow
    </Button>
  );

  if (buttonState.disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <CreateButton />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{buttonState.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CreateButton />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
          <DialogDescription>
            Create a new workflow to automate your processes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter workflow name"
              disabled={isCreating}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter workflow description (optional)"
              rows={3}
              disabled={isCreating}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating ? 'Creating...' : 'Create Workflow'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
