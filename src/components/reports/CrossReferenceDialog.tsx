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
  
  // Helper to safely extract value from potentially nested object structures
  const extractValue = (val: any): any => {
    if (!val) return val;
    if (typeof val !== 'object') return val;
    // Handle nested object structures like {_type: "...", value: "..."}
    if (val.value !== undefined) return extractValue(val.value);
    return val;
  };
  
  // Validate and normalize targetFormId
  let normalizedTargetFormId = extractValue(targetFormId);
  if (
    !normalizedTargetFormId || 
    typeof normalizedTargetFormId !== 'string' ||
    normalizedTargetFormId === 'undefined' || 
    normalizedTargetFormId === 'null' || 
    normalizedTargetFormId.trim() === ''
  ) {
    normalizedTargetFormId = undefined;
  }
  
  const { records, loading } = useCrossReferenceData(
    normalizedTargetFormId,
    submissionIds,
    displayFieldIds
  );

  const handleSubmissionClick = (recordId: string) => {
    // Navigate directly to the submission detail page
    navigate(`/submission/${recordId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[100vh]">
        <DialogHeader>
          <DialogTitle>{fieldName} - Referenced Submissions ({submissionIds.length})</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading records...</span>
            </div>
          ) : (
            <div className="space-y-2 p-1">
              {(records.length > 0 ? records : submissionIds.map(id => ({ 
                submission_ref_id: id, 
                displayData: '',
                id: id,
                form_id: '',
                submission_data: {}
              }))).map((record, index) => (
               <Button
                key={`${record.submission_ref_id}-${index}`}
                variant="outline"
                className="w-full justify-start text-left p-4 h-auto hover:bg-accent"
                onClick={() => handleSubmissionClick(record.id)}
              >
                <div className="flex flex-col items-start w-full">
                  <Badge variant="secondary" className="font-mono mb-1">
                    #{record.submission_ref_id}
                  </Badge>
                  {record.displayData && record.displayData !== record.submission_ref_id && (
                    <div className="w-full overflow-auto">
                      <span className="text-sm text-muted-foreground break-words break-all">
                        {record.displayData}
                      </span>
                    </div>
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