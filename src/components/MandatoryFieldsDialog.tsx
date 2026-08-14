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
import { AlertCircle, ChevronRight } from 'lucide-react';
import type { MandatoryFieldIssue } from '@/lib/formMandatoryValidation';

interface MandatoryFieldsDialogProps {
  open: boolean;
  issues: MandatoryFieldIssue[];
  onClose: () => void;
  onNavigateToField: (issue: MandatoryFieldIssue) => void;
}

export function MandatoryFieldsDialog({
  open,
  issues,
  onClose,
  onNavigateToField,
}: MandatoryFieldsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Incomplete mandatory fields
          </DialogTitle>
          <DialogDescription>
            Please complete the following mandatory fields:
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-72 space-y-1 overflow-y-auto py-2">
          {issues.map((issue) => (
            <li key={issue.fieldId}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onNavigateToField(issue)}
              >
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{issue.fieldName}</span>
                  <span className="text-muted-foreground"> — {issue.locationLabel}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
