import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, ChevronDown, Layers, Plus, Minus } from 'lucide-react';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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

interface CrossReferenceCellProps {
  submissionRefIds: string[] | string;
  field: any;
}

interface FieldMeta {
  id: string;
  label: string;
}

export function CrossReferenceCell({ submissionRefIds, field }: CrossReferenceCellProps) {
  const navigate = useNavigate();
  const [drilldownRecord, setDrilldownRecord] = useState<{ id: string; refId: string } | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [fieldsMeta, setFieldsMeta] = useState<FieldMeta[]>([]);
  const [fieldsMetaLoaded, setFieldsMetaLoaded] = useState(false);

  let customConfig: any = field?.customConfig;
  if (!customConfig && field?.custom_config) {
    try {
      customConfig = typeof field.custom_config === 'string'
        ? JSON.parse(field.custom_config)
        : field.custom_config;
    } catch (e) {
      customConfig = null;
    }
  }

  const targetFormId = customConfig?.targetFormId;
  let tableDisplayFields: string[] = [];
  if (customConfig?.tableDisplayFields && Array.isArray(customConfig.tableDisplayFields)) {
    tableDisplayFields = customConfig.tableDisplayFields;
  }

  let normalizedSubmissionRefIds: string[] = [];
  if (typeof submissionRefIds === 'string') {
    normalizedSubmissionRefIds = submissionRefIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
  } else if (Array.isArray(submissionRefIds)) {
    if (submissionRefIds.length === 1 && submissionRefIds[0].includes(',')) {
      normalizedSubmissionRefIds = submissionRefIds[0].split(',').map(id => id.trim()).filter(id => id.length > 0);
    } else {
      normalizedSubmissionRefIds = submissionRefIds.filter(id => id && id.length > 0);
    }
  }

  const shouldFetch = targetFormId && normalizedSubmissionRefIds.length > 0;

  const { records, targetFormName, loading } = useCrossReferenceData(
    shouldFetch ? targetFormId : undefined,
    shouldFetch ? normalizedSubmissionRefIds : undefined,
    tableDisplayFields
  );

  // Fetch field labels when any record is expanded
  useEffect(() => {
    if (expandedRecords.size > 0 && !fieldsMetaLoaded && tableDisplayFields.length > 0 && targetFormId) {
      supabase
        .from('form_fields')
        .select('id, label')
        .in('id', tableDisplayFields)
        .then(({ data }) => {
          if (data) setFieldsMeta(data as FieldMeta[]);
          setFieldsMetaLoaded(true);
        });
    }
  }, [expandedRecords.size, fieldsMetaLoaded, tableDisplayFields.join(','), targetFormId]);

  const handleViewRecord = (recordId: string) => {
    navigate(`/submission/${recordId}`);
  };

  const toggleExpand = (recordId: string) => {
    setExpandedRecords(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
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

  const formatValue = (val: any): string => {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'object') {
      if (Array.isArray(val)) return val.join(', ');
      return JSON.stringify(val);
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  // Render expanded detail for a record
  const renderExpandedDetail = (record: { id: string; submission_data?: any }) => {
    const fields = tableDisplayFields.length > 0
      ? tableDisplayFields.map(fId => {
          const meta = fieldsMeta.find(m => m.id === fId);
          return { id: fId, label: meta?.label || fId, value: record.submission_data?.[fId] };
        })
      : Object.entries(record.submission_data || {}).slice(0, 6).map(([key, val]) => ({
          id: key, label: key, value: val
        }));

    return (
      <div className="mt-1 ml-6 p-2 rounded-md bg-muted/40 border border-border/50 space-y-1">
        {fields.map(f => (
          <div key={f.id} className="flex items-baseline gap-2 text-xs">
            <span className="font-medium text-muted-foreground min-w-[80px]">{f.label}:</span>
            <span className="text-foreground">{formatValue(f.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render a single record row with +/- toggle
  const renderRecordRow = (record: { id: string; submission_ref_id: string; displayData?: string; submission_data?: any }) => {
    const isExpanded = expandedRecords.has(record.id);
    const hasDisplayData = record.displayData && record.displayData !== record.submission_ref_id;

    return (
      <div key={record.id} className="space-y-0">
        <div className="flex items-center gap-1">
          {/* +/- Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(record.id);
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>

          {/* Record link */}
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer text-left justify-start h-auto py-1 px-1.5 min-w-0 hover:bg-accent/10"
            onClick={() => handleViewRecord(record.id)}
          >
            <ExternalLink className="h-3 w-3 mr-1 text-info flex-shrink-0" />
            <SubmissionRefDisplay
              submissionRefId={record.submission_ref_id}
              submissionId={record.id}
              formName={targetFormName || undefined}
              variant="compact"
            />
          </Button>

          {hasDisplayData && (
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              {record.displayData}
            </span>
          )}

          {/* Layers drill-down */}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 flex-shrink-0 text-accent hover:text-accent/80"
            onClick={(e) => {
              e.stopPropagation();
              setDrilldownRecord({ id: record.id, refId: record.submission_ref_id });
            }}
            title="Drill down"
          >
            <Layers className="h-3 w-3" />
          </Button>
        </div>

        {/* Expanded detail */}
        {isExpanded && renderExpandedDetail(record)}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {records.map(record => renderRecordRow(record))}
      {drilldownModal}
    </div>
  );
}
