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
  const tableDisplayField = field?.customConfig?.tableDisplayField;
  
  // Only fetch if we have a display field configured
  const shouldFetch = targetFormId && tableDisplayField;
  const displayFieldIds = tableDisplayField ? [tableDisplayField] : [];
  
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

  // If we have records with field values, display them
  if (records && records.length > 0 && shouldFetch) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1 px-2 max-w-md"
        onClick={handleClick}
      >
        <div className="flex items-start gap-1 flex-col">
          {records.slice(0, 2).map((record, index) => (
            <div key={record.id} className="text-xs truncate max-w-full">
              <span className="font-mono text-primary">#{record.submission_ref_id}</span>
              {record.displayData && record.displayData !== record.submission_ref_id && (
                <span className="ml-1 text-muted-foreground">- {record.displayData}</span>
              )}
            </div>
          ))}
          {records.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{records.length - 2} more
            </Badge>
          )}
        </div>
        <ExternalLink className="h-3 w-3 ml-2 flex-shrink-0 opacity-50" />
      </Button>
    );
  }

  // Fallback: just show count button
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
