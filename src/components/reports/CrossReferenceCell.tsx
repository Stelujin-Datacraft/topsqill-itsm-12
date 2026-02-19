import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, ChevronDown, Plus, Minus, Layers } from 'lucide-react';
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
import { SubmissionRefDisplay } from '@/components/SubmissionRefDisplay';
import { CrossReferenceDrilldownModal } from './CrossReferenceDrilldownModal';
import { CrossReferenceInlineExpand } from './CrossReferenceInlineExpand';

interface CrossReferenceCellProps {
  submissionRefIds: string[] | string;
  field: any;
}

export function CrossReferenceCell({ submissionRefIds, field }: CrossReferenceCellProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [drilldownRecord, setDrilldownRecord] = useState<{ id: string; refId: string } | null>(null);

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

  const targetFormId = customConfig?.targetFormId;

  let tableDisplayFields: string[] = [];
  if (customConfig?.tableDisplayFields && Array.isArray(customConfig.tableDisplayFields)) {
    tableDisplayFields = customConfig.tableDisplayFields;
  }

  // Normalize submissionRefIds
  let normalizedSubmissionRefIds: string[] = [];
  if (typeof submissionRefIds === 'string') {
    normalizedSubmissionRefIds = submissionRefIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
  } else if (Array.isArray(submissionRefIds)) {
    if (submissionRefIds.length === 1 && submissionRefIds[0].includes(',')) {
      normalizedSubmissionRefIds = submissionRefIds[0].split(',').map((id) => id.trim()).filter((id) => id.length > 0);
    } else {
      normalizedSubmissionRefIds = submissionRefIds.filter((id) => id && id.length > 0);
    }
  }

  const shouldFetch = targetFormId && normalizedSubmissionRefIds.length > 0;

  const { records, targetFormName, loading } = useCrossReferenceData(
    shouldFetch ? targetFormId : undefined,
    shouldFetch ? normalizedSubmissionRefIds : undefined,
    tableDisplayFields
  );

  const handleViewRecord = (recordId: string) => {
    navigate(`/submission/${recordId}`);
  };

  if (!targetFormId) {
    return <div className="text-xs text-muted-foreground italic">Configuration needed</div>;
  }

  if (loading && shouldFetch) {
    return (
      <Button variant="outline" size="sm" disabled className="cursor-pointer text-left justify-start h-auto py-1 px-2 min-w-[100px]">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span className="text-xs">Loading...</span>
      </Button>
    );
  }

  if (records.length === 0 && !loading) {
    return <div className="text-xs text-muted-foreground italic">No linked records</div>;
  }

  // Drilldown modal (kept as before)
  const drilldownModal = drilldownRecord && targetFormId ? (
    <CrossReferenceDrilldownModal
      open={!!drilldownRecord}
      onClose={() => setDrilldownRecord(null)}
      submissionId={drilldownRecord.id}
      submissionRefId={drilldownRecord.refId}
      formId={targetFormId}
      formName={targetFormName || 'Linked Form'}
    />
  ) : null;

  // Inline expand content
  const inlineExpand = expanded && targetFormId ? (
    <CrossReferenceInlineExpand
      records={records}
      targetFormId={targetFormId}
      targetFormName={targetFormName || undefined}
    />
  ) : null;

  // Single record
  if (records.length === 1) {
    const record = records[0];
    const hasDisplayData = record.displayData && record.displayData !== record.submission_ref_id;

    return (
      <TooltipProvider>
        <div className="flex flex-col relative">
          <div className="flex items-center gap-1">
            {/* +/- expand button */}
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6 flex-shrink-0 border-border bg-background hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); setExpanded((prev) => !prev); }}
              title={expanded ? 'Collapse' : 'Expand linked records'}
            >
              {expanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Button>

            {/* Main link button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1.5 px-2 min-w-0"
                  onClick={() => handleViewRecord(record.id)}
                >
                  <ExternalLink className="h-3 w-3 mr-1.5 text-info flex-shrink-0" />
                  <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                    <SubmissionRefDisplay
                      submissionRefId={record.submission_ref_id}
                      submissionId={record.id}
                      formName={targetFormName || undefined}
                      variant="compact"
                    />
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
                    <SubmissionRefDisplay submissionRefId={record.submission_ref_id} submissionId={record.id} formName={targetFormName || undefined} variant="compact" />
                    <div className="text-muted-foreground mt-0.5">{record.displayData}</div>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Drilldown button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 text-accent hover:text-accent/80"
                  onClick={(e) => { e.stopPropagation(); setDrilldownRecord({ id: record.id, refId: record.submission_ref_id }); }}
                >
                  <Layers className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">Drill down into linked records</span>
              </TooltipContent>
            </Tooltip>
          </div>
          {inlineExpand}
        </div>
        {drilldownModal}
      </TooltipProvider>
    );
  }

  // Multiple records
  return (
    <TooltipProvider>
      <div className="flex flex-col relative">
        <div className="flex items-center gap-1">
          {/* +/- expand button */}
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 flex-shrink-0 border-border bg-background hover:bg-muted"
            onClick={(e) => { e.stopPropagation(); setExpanded((prev) => !prev); }}
            title={expanded ? 'Collapse' : 'Expand linked records'}
          >
            {expanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>

          {/* Dropdown for multiple records */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1 px-2">
                <ExternalLink className="h-3 w-3 mr-1 text-info" />
                <span className="text-sm text-primary font-medium">{records.length} linked records</span>
                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto min-w-[250px] bg-popover z-50">
              {records.map((record) => {
                const hasDisplayData = record.displayData && record.displayData !== record.submission_ref_id;
                return (
                  <DropdownMenuItem
                    key={record.id}
                    className="cursor-pointer flex items-center justify-between gap-2 py-2"
                    onClick={() => handleViewRecord(record.id)}
                  >
                    <div className="flex items-start gap-2 flex-1 overflow-hidden">
                      <ExternalLink className="h-3 w-3 mt-0.5 text-info flex-shrink-0" />
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <SubmissionRefDisplay submissionRefId={record.submission_ref_id} submissionId={record.id} formName={targetFormName || undefined} variant="compact" />
                        {hasDisplayData && (
                          <span className="text-xs text-muted-foreground truncate">{record.displayData}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-accent hover:text-accent/80"
                      onClick={(e) => { e.stopPropagation(); setDrilldownRecord({ id: record.id, refId: record.submission_ref_id }); }}
                    >
                      <Layers className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {inlineExpand}
      </div>
      {drilldownModal}
    </TooltipProvider>
  );
}
