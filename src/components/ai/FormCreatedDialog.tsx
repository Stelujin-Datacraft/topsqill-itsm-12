import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText } from 'lucide-react';

interface FormCreatedDialogProps {
  open: boolean;
  formName?: string;
  onClose: () => void;
  onViewForms: () => void;
}

export function FormCreatedDialog({
  open,
  formName,
  onClose,
  onViewForms,
}: FormCreatedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            {formName ? `"${formName}" is ready` : 'Your form is ready'}
          </DialogTitle>
          <DialogDescription className="text-center">
            Form created successfully. Click View Form to open your forms list and explore more features.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Keep building
          </Button>
          <Button onClick={onViewForms} className="gap-1.5">
            <FileText className="h-4 w-4" />
            View Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
