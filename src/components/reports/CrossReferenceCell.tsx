// import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';

interface CrossReferenceCellProps {
  submissionRefIds: string[] | string; // can be string (comma-separated) or array
  field: any;
}

export function CrossReferenceCell({ submissionRefIds, field }: CrossReferenceCellProps) {
  const targetFormId = field?.customConfig?.targetFormId;
  const displayColumns = field?.customConfig?.displayColumns || [];

  // ✅ Normalize submissionRefIds: handle both array and comma-separated string
  let normalizedSubmissionRefIds: string[] = [];
  if (typeof submissionRefIds === 'string') {
    normalizedSubmissionRefIds = submissionRefIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  } else if (Array.isArray(submissionRefIds)) {
    // In case you accidentally have a single item array like ['id1,id2']
    if (submissionRefIds.length === 1 && submissionRefIds[0].includes(',')) {
      normalizedSubmissionRefIds = submissionRefIds[0]
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    } else {
      normalizedSubmissionRefIds = submissionRefIds.filter((id) => id && id.length > 0);
    }
  }

  console.log('CrossReferenceCell: field.customConfig:', field?.customConfig);
  console.log('CrossReferenceCell: displayColumns:', displayColumns);
  console.log('CrossReferenceCell: normalizedSubmissionRefIds:', normalizedSubmissionRefIds);

  // Fetch only if valid targetFormId and submissionRefIds exist
  const shouldFetch = targetFormId && normalizedSubmissionRefIds.length > 0;
  const displayFieldIds = displayColumns;

  const { records, loading } = useCrossReferenceData(
    shouldFetch ? targetFormId : undefined,
    shouldFetch ? normalizedSubmissionRefIds : undefined,
    displayFieldIds
  );

  const handleClick = () => {
    console.log('Cross-reference button clicked', { normalizedSubmissionRefIds, field });

    const dynamicTable = document.querySelector('[data-dynamic-table="main"]');
    console.log('Dynamic table element found:', dynamicTable);

    if (dynamicTable) {
      const event = new CustomEvent('showCrossReference', {
        detail: {
          submissionIds: normalizedSubmissionRefIds,
          fieldName: field?.label || 'Cross Reference',
          targetFormId,
          displayFieldIds,
        },
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

  // Display clickable links for each submission ref ID
  return (
    <div className="flex flex-wrap gap-1">
      {records.map((record) => (
        <a
          key={record.id}
          href={`/submission/${record.id}`}
          className="text-primary hover:underline text-sm font-medium"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = `/submission/${record.id}`;
          }}
        >
          {record.submission_ref_id}
        </a>
      ))}
      {records.length === 0 && normalizedSubmissionRefIds.length > 0 && (
        <span className="text-xs text-muted-foreground">No records found</span>
      )}
    </div>
  );
}
