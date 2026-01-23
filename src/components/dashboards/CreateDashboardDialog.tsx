import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDashboards } from '@/hooks/useDashboards';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface CreateDashboardDialogProps {
  children: React.ReactNode;
}

export function CreateDashboardDialog({ children }: CreateDashboardDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const { createDashboard } = useDashboards();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Dashboard name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreating(true);
      const dashboard = await createDashboard({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      
      toast({
        title: "Success",
        description: "Dashboard created successfully"
      });
      
      setIsOpen(false);
      setName('');
      setDescription('');
      
      // Navigate to the dashboard view
      navigate(`/dashboard-view/${dashboard.id}`);
    } catch (error) {
      console.error('Error creating dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to create dashboard",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Dashboard</DialogTitle>
          <DialogDescription>
            Create a dashboard to organize your reports and visualizations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter dashboard name"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description for your dashboard"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Dashboard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
