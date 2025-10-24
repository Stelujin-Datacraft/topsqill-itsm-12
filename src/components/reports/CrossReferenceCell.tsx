import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2 } from 'lucide-react';
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

  const handleClick = () => {
    console.log('Cross-reference button clicked', { submissionRefIds, field });
    const dynamicTable = document.querySelector('[data-dynamic-table="main"]');
    console.log('Dynamic table element found:', dynamicTable);
    if (dynamicTable) {
      const event = new CustomEvent('showCrossReference', { 
        detail: { 
          submissionIds: submissionRefIds,
          fieldName: field?.label || 'Cross Reference',
          targetFormId: targetFormId,
          displayFieldIds: displayFieldIds
        } 
      });
      console.log('Dispatching event with data:', event.detail);
      dynamicTable.dispatchEvent(event);
    } else {
      console.error('Dynamic table element not found');
    }
  };

  // If loading, show a loading indicator
  if (loading && shouldFetch) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="cursor-pointer text-left justify-start h-auto py-1 px-2 min-w-[100px]"
      >
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span className="text-xs">Loading...</span>
      </Button>
    );
  }

  // Display all submission_ref_ids (from fetched records or from the raw data)
  return (
    <Button
      variant="outline"
      size="sm"
      className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1 px-2"
      onClick={handleClick}
    >
      <div className="text-sm">
        <span className="text-primary font-medium">View ({submissionRefIds.length})</span>
      </div>
      <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
    </Button>
  );
}
