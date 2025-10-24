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
  console.log('CrossReferenceCell: submissionRefIds (raw):', submissionRefIds);
  
  // Parse and extract ref_ids from the data
  let refIds: string[] = [];
  if (Array.isArray(submissionRefIds)) {
    refIds = submissionRefIds.map((item: any) => {
      if (typeof item === 'string') {
        return item;
      } else if (typeof item === 'object' && item !== null && 'submission_ref_id' in item) {
        return item.submission_ref_id;
      }
      return null;
    }).filter((id): id is string => id !== null && id !== '');
  }
  
  console.log('CrossReferenceCell: extracted refIds:', refIds);
  
  // Fetch if we have targetFormId and valid ref_ids
  const shouldFetch = targetFormId && refIds && refIds.length > 0;
  const displayFieldIds = displayColumns;
  
  console.log('CrossReferenceCell: shouldFetch:', shouldFetch);
  console.log('CrossReferenceCell: displayFieldIds being passed:', displayFieldIds);
  
  const { records, loading } = useCrossReferenceData(
    shouldFetch ? targetFormId : undefined,
    shouldFetch ? refIds : undefined,
    displayFieldIds
  );

  const handleClick = () => {
    console.log('Cross-reference button clicked', { refIds, field });
    const dynamicTable = document.querySelector('[data-dynamic-table="main"]');
    console.log('Dynamic table element found:', dynamicTable);
    if (dynamicTable) {
      const event = new CustomEvent('showCrossReference', { 
        detail: { 
          submissionIds: refIds,
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

  // Display each submission_ref_id as a separate badge
  if (!refIds || refIds.length === 0) {
    return <span className="text-muted-foreground text-sm">No references</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {refIds.map((refId, index) => (
        <Badge
          key={`${refId}-${index}`}
          variant="outline"
          className="cursor-pointer hover:bg-accent text-xs px-2 py-0.5"
          onClick={handleClick}
        >
          #{refId}
        </Badge>
      ))}
    </div>
  );
}
