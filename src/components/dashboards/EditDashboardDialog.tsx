import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDashboards } from '@/hooks/useDashboards';
import { useToast } from '@/hooks/use-toast';
import { DashboardWithReports } from '@/types/dashboard';

interface EditDashboardDialogProps {
  dashboard: DashboardWithReports | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditDashboardDialog({ 
  dashboard, 
  isOpen, 
  onClose, 
  onSuccess 
}: EditDashboardDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { updateDashboard } = useDashboards();
  const { toast } = useToast();

  useEffect(() => {
    if (dashboard) {
      setName(dashboard.name);
      setDescription(dashboard.description || '');
    }
  }, [dashboard]);

  const handleSave = async () => {
    if (!dashboard) return;
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Dashboard name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      await updateDashboard(dashboard.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      
      toast({
        title: "Success",
        description: "Dashboard updated successfully"
      });
      
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error updating dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to update dashboard",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Dashboard</DialogTitle>
          <DialogDescription>
            Update the dashboard name and description.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter dashboard name"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description for your dashboard"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
