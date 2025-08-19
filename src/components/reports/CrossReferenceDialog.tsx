import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';

interface CrossReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionIds: string[];
  parentFormId?: string;
}

export function CrossReferenceDialog({ 
  open, 
  onOpenChange, 
  submissionIds,
  parentFormId 
}: CrossReferenceDialogProps) {
  const navigate = useNavigate();

  const handleSubmissionClick = (submissionId: string) => {
    navigate(`/submissions/${submissionId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Cross-Referenced Submissions ({submissionIds.length})</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          <div className="space-y-2 p-1">
            {submissionIds.map((submissionId, index) => (
              <Button
                key={submissionId}
                variant="outline"
                className="w-full justify-start text-left"
                onClick={() => handleSubmissionClick(submissionId)}
              >
                <span className="font-mono text-sm">#{submissionId}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}