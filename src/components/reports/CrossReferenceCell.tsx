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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  
  // Use tableDisplayFields for Dynamic Table display (this is what user configures in "Table Display Fields")
  // Fall back to displayColumns for backwards compatibility
  let tableDisplayFields = customConfig?.tableDisplayFields || [];
  if (!Array.isArray(tableDisplayFields) || tableDisplayFields.length === 0) {
    tableDisplayFields = customConfig?.displayColumns || [];
  }
  if (!Array.isArray(tableDisplayFields)) {
    tableDisplayFields = [];
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

  const { records, loading } = useCrossReferenceData(
    shouldFetch ? targetFormId : undefined,
    shouldFetch ? normalizedSubmissionRefIds : undefined,
    tableDisplayFields // Use tableDisplayFields to get field values for display
  );

  const handleViewRecord = (recordId: string) => {
    navigate(`/submission/${recordId}`);
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

  // Helper to render a single record with ID and display data
  const renderRecordContent = (record: { id: string; submission_ref_id: string; displayData?: string }) => {
    const hasDisplayData = record.displayData && record.displayData !== record.submission_ref_id;
    
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-primary">
          #{record.submission_ref_id}
        </span>
        {hasDisplayData && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {record.displayData}
          </span>
        )}
      </div>
    );
  };

  // Single record - show button with ID and display data
  if (records.length === 1) {
    const record = records[0];
    const hasDisplayData = record.displayData && record.displayData !== record.submission_ref_id;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1.5 px-2 min-w-0"
              onClick={() => handleViewRecord(record.id)}
            >
              <ExternalLink className="h-3 w-3 mr-1.5 opacity-50 flex-shrink-0" />
              <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                <span className="text-sm font-medium text-primary">
                  #{record.submission_ref_id}
                </span>
                {hasDisplayData && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {record.displayData}
                  </span>
                )}
              </div>
            </Button>
          </TooltipTrigger>
          {hasDisplayData && (
            <TooltipContent side="top" className="max-w-[300px]">
              <div className="text-xs">
                <div className="font-medium">#{record.submission_ref_id}</div>
                <div className="text-muted-foreground mt-0.5">{record.displayData}</div>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
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
            {records.length} linked records
          </span>
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto min-w-[200px]">
        {records.map((record) => {
          const hasDisplayData = record.displayData && record.displayData !== record.submission_ref_id;
          
          return (
            <DropdownMenuItem
              key={record.id}
              onClick={() => handleViewRecord(record.id)}
              className="cursor-pointer flex items-start gap-2 py-2"
            >
              <ExternalLink className="h-3 w-3 mt-0.5 opacity-50 flex-shrink-0" />
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="text-sm font-medium">#{record.submission_ref_id}</span>
                {hasDisplayData && (
                  <span className="text-xs text-muted-foreground truncate">
                    {record.displayData}
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
