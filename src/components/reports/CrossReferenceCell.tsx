import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, ChevronDown, ChevronRight, Plus, Minus, Layers } from 'lucide-react';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';
import { useNavigate } from 'react-router-dom';
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
  const [listExpanded, setListExpanded] = useState(false);
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());
  const [drilldownRecord, setDrilldownRecord] = useState<{ id: string; refId: string } | null>(null);

  // Parse custom_config
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

  const toggleRecordExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  // Render a single record row with +/- and drilldown
  const renderRecordRow = (record: typeof records[0]) => {
    const isExpanded = expandedRecordIds.has(record.id);
    const hasDisplayData = record.displayData && record.displayData !== record.submission_ref_id;

    return (
      <div key={record.id} className="flex flex-col">
        <div className="flex items-center gap-1">
          {/* Per-record +/- expand */}
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 flex-shrink-0 border-border bg-background hover:bg-muted"
            onClick={(e) => toggleRecordExpand(record.id, e)}
            title={isExpanded ? 'Collapse' : 'Expand linked record details'}
          >
            {isExpanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>

          {/* Link button */}
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

        {/* Inline expand for this specific record */}
        {isExpanded && targetFormId && (
          <CrossReferenceInlineExpand
            submissionId={record.id}
            submissionRefId={record.submission_ref_id}
            targetFormId={targetFormId}
            targetFormName={targetFormName || undefined}
            depth={0}
          />
        )}
      </div>
    );
  };

  // Single record
  if (records.length === 1) {
    return (
      <TooltipProvider>
        <div className="flex flex-col">
          {renderRecordRow(records[0])}
        </div>
        {drilldownModal}
      </TooltipProvider>
    );
  }

  // Multiple records — inline expandable list (not a dropdown)
  return (
    <TooltipProvider>
      <div className="flex flex-col">
        {/* Toggle to show/hide record list */}
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1 px-2"
          onClick={() => setListExpanded((prev) => !prev)}
        >
          <ExternalLink className="h-3 w-3 mr-1 text-info" />
          <span className="text-sm text-primary font-medium">{records.length} linked records</span>
          {listExpanded ? (
            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
          ) : (
            <ChevronRight className="h-3 w-3 ml-1 opacity-50" />
          )}
        </Button>

        {/* Expanded list of records */}
        {listExpanded && (
          <div className="mt-1 ml-2 space-y-1">
            {records.map((record) => renderRecordRow(record))}
          </div>
        )}
      </div>
      {drilldownModal}
    </TooltipProvider>
  );
}
