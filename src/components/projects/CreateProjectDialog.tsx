import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateProjectDialogProps {
  onProjectCreated?: (projectId: string) => void;
  trigger?: React.ReactNode;
}

const NAME_MIN = 3;
const NAME_MAX = 60;
const DESC_MAX = 250;

export function CreateProjectDialog({ onProjectCreated, trigger }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createProject } = useProject();
  const { userProfile } = useAuth();

  const trimmedName = name.trim();
  const nameLen = trimmedName.length;
  const descLen = description.length;

  const nameError =
    nameLen === 0
      ? null
      : nameLen < NAME_MIN
      ? `Name must be at least ${NAME_MIN} characters`
      : nameLen > NAME_MAX
      ? `Name cannot exceed ${NAME_MAX} characters`
      : null;

  const descError = descLen > DESC_MAX ? `Description cannot exceed ${DESC_MAX} characters` : null;

  const isValid = nameLen >= NAME_MIN && nameLen <= NAME_MAX && !descError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast({
        title: 'Validation error',
        description: nameError || descError || 'Please fix the form errors',
        variant: 'destructive',
      });
      return;
    }

    if (userProfile?.role !== 'admin') {
      toast({
        title: 'Error',
        description: 'Only administrators can create projects',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const project = await createProject({
        name: trimmedName,
        description: description.trim(),
      });

      if (project) {
        toast({
          title: 'Success',
          description: `Project "${project.name}" created successfully`,
        });

        setName('');
        setDescription('');
        setOpen(false);
        onProjectCreated?.(project.id);
      } else {
        throw new Error('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Create Project
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a new project to organize your forms, workflows, and reports.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="name">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    nameLen > NAME_MAX ? 'text-destructive font-medium' : 'text-muted-foreground'
                  )}
                >
                  {nameLen}/{NAME_MAX}
                </span>
              </div>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                placeholder="Enter project name"
                maxLength={NAME_MAX}
                aria-invalid={!!nameError}
                className={cn(nameError && 'border-destructive focus-visible:ring-destructive/30')}
                required
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description (Optional)</Label>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    descLen > DESC_MAX ? 'text-destructive font-medium' : 'text-muted-foreground'
                  )}
                >
                  {descLen}/{DESC_MAX}
                </span>
              </div>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                placeholder="Briefly describe what this project is about"
                rows={3}
                maxLength={DESC_MAX}
                aria-invalid={!!descError}
                className={cn(descError && 'border-destructive focus-visible:ring-destructive/30')}
              />
              {descError && <p className="text-xs text-destructive">{descError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !isValid}>
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
