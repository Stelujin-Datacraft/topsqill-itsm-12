import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Save } from 'lucide-react';

interface EdgeConfigModalProps {
  isOpen: boolean;
  edgeId: string | null;
  edgeName: string;
  onClose: () => void;
  onSave: (edgeId: string, name: string) => void;
  onDelete: (edgeId: string) => void;
}

export function EdgeConfigModal({
  isOpen,
  edgeId,
  edgeName,
  onClose,
  onSave,
  onDelete,
}: EdgeConfigModalProps) {
  const [name, setName] = useState(edgeName);

  useEffect(() => {
    setName(edgeName);
  }, [edgeName, edgeId]);

  const handleSave = () => {
    if (edgeId) {
      onSave(edgeId, name);
      onClose();
    }
  };

  const handleDelete = () => {
    if (edgeId) {
      onDelete(edgeId);
      // Don't call onClose here - parent handles it
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Connection</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edge-name">Connection Name</Label>
            <Input
              id="edge-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name for this connection"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/50 characters
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-row gap-2 w-full sm:flex-row">
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
