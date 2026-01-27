import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, PlayCircle, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface BulkWorkflowTriggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'selected' | 'all';
  selectedCount: number;
  totalCount: number;
  onConfirm: () => Promise<{ success: number; failed: number }>;
  executing: boolean;
}

export function BulkWorkflowTriggerDialog({
  open,
  onOpenChange,
  mode,
  selectedCount,
  totalCount,
  onConfirm,
  executing,
}: BulkWorkflowTriggerDialogProps) {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const recordCount = mode === 'selected' ? selectedCount : totalCount;

  const handleConfirm = async () => {
    setProgress(0);
    setResult(null);
    
    const res = await onConfirm();
    setResult(res);
  };

  const handleClose = () => {
    if (!executing) {
      setProgress(0);
      setResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'selected' ? (
              <Play className="h-5 w-5 text-blue-600" />
            ) : (
              <PlayCircle className="h-5 w-5 text-purple-600" />
            )}
            {mode === 'selected' ? 'Run Workflow for Selected Records' : 'Run Workflow for All Records'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'selected'
              ? `This will trigger the configured workflow(s) for ${selectedCount} selected record${selectedCount > 1 ? 's' : ''}.`
              : `This will trigger the configured workflow(s) for all ${totalCount} record${totalCount > 1 ? 's' : ''} in this form.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {result ? (
            <div className="space-y-3">
              {result.success > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{result.success} record{result.success > 1 ? 's' : ''} triggered successfully</span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>{result.failed} record{result.failed > 1 ? 's' : ''} failed</span>
                </div>
              )}
            </div>
          ) : executing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing records...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Please wait while workflows are being triggered
              </p>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">What will happen:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Active workflows configured for this form will be triggered</li>
                <li>Each record will be processed individually</li>
                <li>Workflow actions (emails, notifications, etc.) will execute</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {result ? (
            <Button onClick={handleClose}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={executing}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={executing}
                className={mode === 'selected' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}
              >
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {mode === 'selected' ? (
                      <Play className="h-4 w-4 mr-2" />
                    ) : (
                      <PlayCircle className="h-4 w-4 mr-2" />
                    )}
                    Run for {recordCount} Record{recordCount > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
