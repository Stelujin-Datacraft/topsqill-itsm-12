import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';

interface CrossReferenceCellProps {
  submissionRefIds: string[];
  field: any;
}

export function CrossReferenceCell({ submissionRefIds, field }: CrossReferenceCellProps) {
  const targetFormId = field?.customConfig?.targetFormId;
  const displayColumns = field?.customConfig?.displayColumns || [];
  
  console.log('CrossReferenceCell: field customConfig:', field?.customConfig);
  console.log('CrossReferenceCell: displayColumns:', displayColumns);
  console.log('CrossReferenceCell: submissionRefIds:', submissionRefIds);
  
  // Fetch if we have targetFormId (displayColumns can be empty, we'll still show ref_ids)
  const shouldFetch = targetFormId && submissionRefIds && submissionRefIds.length > 0;
  const displayFieldIds = displayColumns;
  
  console.log('CrossReferenceCell: shouldFetch:', shouldFetch);
  console.log('CrossReferenceCell: displayFieldIds being passed:', displayFieldIds);
  
  const { records, loading } = useCrossReferenceData(
    shouldFetch ? targetFormId : undefined,
    shouldFetch ? submissionRefIds : undefined,
    displayFieldIds
  );

  // If loading, show a loading indicator
  if (loading && shouldFetch) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Display each ref_id separately
  const displayRecords = records.length > 0 
    ? records 
    : submissionRefIds.map(refId => ({
        id: refId,
        submission_ref_id: refId,
        displayData: '',
        form_id: targetFormId || '',
        submission_data: {}
      }));

  return (
    <div className="flex flex-wrap gap-1.5 py-1">
      {displayRecords.map((record, index) => (
        <Badge
          key={`${record.submission_ref_id}-${index}`}
          variant="outline"
          className="cursor-pointer hover:bg-accent text-xs font-mono px-2 py-1"
          onClick={(e) => {
            e.stopPropagation();
            // Navigate to the specific submission
            const event = new CustomEvent('navigateToSubmission', { 
              detail: { 
                submissionRefId: record.submission_ref_id,
                targetFormId: targetFormId
              } 
            });
            document.dispatchEvent(event);
          }}
        >
          #{record.submission_ref_id}
          {record.displayData && record.displayData !== record.submission_ref_id && (
            <span className="ml-1.5 text-muted-foreground font-normal">
              • {record.displayData.substring(0, 30)}{record.displayData.length > 30 ? '...' : ''}
            </span>
          )}
        </Badge>
      ))}
    </div>
  );
}
