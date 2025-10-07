import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';
import { Loader2 } from 'lucide-react';

interface CrossReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionIds: string[];
  parentFormId?: string;
  fieldName?: string;
  targetFormId?: string;
  displayFieldIds?: string[];
}

export function CrossReferenceDialog({ 
  open, 
  onOpenChange, 
  submissionIds,
  parentFormId,
  fieldName = 'Cross Reference',
  targetFormId,
  displayFieldIds = []
}: CrossReferenceDialogProps) {
  const navigate = useNavigate();
  
  const { records, loading } = useCrossReferenceData(
    targetFormId,
    submissionIds,
    displayFieldIds
  );

  const handleSubmissionClick = (submissionId: string) => {
    // Navigate to the submission by finding it using submission_ref_id
    navigate(`/form-submissions?submissionRef=${submissionId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{fieldName} - Referenced Submissions ({submissionIds.length})</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading records...</span>
            </div>
          ) : (
            <div className="space-y-2 p-1">
              {(records.length > 0 ? records : submissionIds.map(id => ({ 
                submission_ref_id: id, 
                displayData: id,
                id: id,
                form_id: '',
                submission_data: {}
              }))).map((record, index) => (
                <Button
                  key={`${record.submission_ref_id}-${index}`}
                  variant="outline"
                  className="w-full justify-start text-left hover:bg-accent p-4 h-auto"
                  onClick={() => handleSubmissionClick(record.submission_ref_id)}
                >
                  <div className="flex items-start gap-2 w-full">
                    <Badge variant="secondary" className="font-mono shrink-0">
                      #{record.submission_ref_id}
                    </Badge>
                    {record.displayData && record.displayData !== record.submission_ref_id && (
                      <span className="text-sm text-muted-foreground truncate">
                        {record.displayData}
                      </span>
                    )}
                  </div>
                </Button>
              ))}
              {submissionIds.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No referenced submissions found
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}