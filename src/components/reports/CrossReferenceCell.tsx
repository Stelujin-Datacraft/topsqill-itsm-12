import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, ChevronDown } from 'lucide-react';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CrossReferenceCellProps {
  submissionRefIds: string[] | string; // can be string (comma-separated) or array
  field: any;
}

export function CrossReferenceCell({ submissionRefIds, field }: CrossReferenceCellProps) {
  const navigate = useNavigate();
  
  // Parse custom_config if it's a JSON string (from database)
  let customConfig: any = field?.customConfig;
  if (!customConfig && field?.custom_config) {
    try {
      customConfig = typeof field.custom_config === 'string' 
        ? JSON.parse(field.custom_config) 
        : field.custom_config;
    } catch (e) {
      console.error('Failed to parse custom_config:', e);
      customConfig = null;
    }
  }
  
  // Extract targetFormId - handle plain strings and ensure it's valid
  const targetFormId = customConfig?.targetFormId;
  
  // Extract displayColumns - ensure it's an array
  let displayColumns = customConfig?.displayColumns || [];
  if (!Array.isArray(displayColumns)) {
    displayColumns = [];
  }

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

  // Fetch only if valid targetFormId and submissionRefIds exist
  const shouldFetch = targetFormId && normalizedSubmissionRefIds.length > 0;
  const displayFieldIds = displayColumns;

  const { records, loading } = useCrossReferenceData(
    shouldFetch ? targetFormId : undefined,
    shouldFetch ? normalizedSubmissionRefIds : undefined,
    displayFieldIds
  );

  const handleViewRecord = (recordId: string) => {
    navigate(`/submission/${recordId}`);
  };

  const handleClick = () => {
    // If we have exactly one record, navigate directly
    if (records.length === 1) {
      handleViewRecord(records[0].id);
      return;
    }
    
    // For multiple records, the dropdown will handle it
    // This is a fallback for when dropdown doesn't work
    if (records.length > 0) {
      handleViewRecord(records[0].id);
    }
  };

  // If no valid targetFormId, show configuration needed message
  if (!targetFormId) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Configuration needed
      </div>
    );
  }

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

  // No records found
  if (records.length === 0 && !loading) {
    return (
      <div className="text-xs text-muted-foreground italic">
        No linked records
      </div>
    );
  }

  // Single record - show simple View button that navigates directly
  if (records.length === 1) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1 px-2"
        onClick={() => handleViewRecord(records[0].id)}
      >
        <ExternalLink className="h-3 w-3 mr-1 opacity-50" />
        <span className="text-sm text-primary font-medium">
          #{records[0].submission_ref_id}
        </span>
      </Button>
    );
  }

  // Multiple records - show dropdown with all linked records
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1 px-2"
        >
          <ExternalLink className="h-3 w-3 mr-1 opacity-50" />
          <span className="text-sm text-primary font-medium">
            View ({records.length})
          </span>
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
        {records.map((record) => (
          <DropdownMenuItem
            key={record.id}
            onClick={() => handleViewRecord(record.id)}
            className="cursor-pointer"
          >
            <ExternalLink className="h-3 w-3 mr-2 opacity-50" />
            <span>#{record.submission_ref_id}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
