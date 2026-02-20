import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Download } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CrossReferenceInlineExpand } from './CrossReferenceInlineExpand';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';
import { exportCrossRefHierarchyToExcel } from '@/utils/crossRefExcelExport';
import { useToast } from '@/hooks/use-toast';

interface CrossRefFieldInfo {
  fieldId: string;
  label: string;
  targetFormId: string;
  tableDisplayFields: string[];
  displayColumns: string[];
  submissionRefIds: string[];
}

interface RowCrossRefExpandButtonProps {
  row: any;
  crossRefFields: any[];
}

function CrossRefPopoverContent({ fieldInfo, row }: { fieldInfo: CrossRefFieldInfo; row: any }) {
  const { records, targetFormName, loading } = useCrossReferenceData(
    fieldInfo.targetFormId,
    fieldInfo.submissionRefIds,
    fieldInfo.tableDisplayFields
  );
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Build parent-like submissions from the linked records for hierarchical export
      const parentSubs = records.map(r => ({
        id: r.id,
        submission_ref_id: r.submission_ref_id,
        submission_data: (r as any).submission_data || {},
      }));
      await exportCrossRefHierarchyToExcel(parentSubs, fieldInfo.targetFormId, targetFormName || fieldInfo.label);
      toast({ title: 'Exported', description: `Hierarchical Excel exported successfully` });
    } catch (err) {
      console.error('Export error:', err);
      toast({ title: 'Export failed', description: 'Could not export data', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading linked records...</div>;
  }

  if (records.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground italic">No linked records found</div>;
  }

  return (
    <div className="space-y-2">
      <div className="px-3 pt-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{fieldInfo.label}</span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download className="h-3 w-3" />
          {exporting ? 'Exporting...' : 'Export Excel'}
        </Button>
      </div>
      <CrossReferenceInlineExpand
        records={records}
        targetFormId={fieldInfo.targetFormId}
        targetFormName={targetFormName || undefined}
        tableDisplayFields={fieldInfo.tableDisplayFields}
        displayColumns={fieldInfo.displayColumns}
      />
    </div>
  );
}

export function RowCrossRefExpandButton({ row, crossRefFields }: RowCrossRefExpandButtonProps) {
  const [expanded, setExpanded] = useState(false);

  // Build cross-ref field info from the row's submission data
  const crossRefFieldInfos = useMemo(() => {
    const infos: CrossRefFieldInfo[] = [];

    for (const field of crossRefFields) {
      const value = row.submission_data?.[field.id];
      if (!value) continue;

      // Parse custom_config
      let customConfig: any = field.customConfig || field.custom_config;
      if (typeof customConfig === 'string') {
        try { customConfig = JSON.parse(customConfig); } catch { customConfig = null; }
      }

      const targetFormId = customConfig?.targetFormId;
      if (!targetFormId) continue;

      // Extract submission ref IDs
      let refIds: string[] = [];
      if (Array.isArray(value)) {
        refIds = value
          .map((item: any) => item?.submission_ref_id || (typeof item === 'string' ? item : null))
          .filter(Boolean);
      } else if (typeof value === 'string') {
        refIds = value.split(',').map(s => s.trim()).filter(Boolean);
      }

      if (refIds.length === 0) continue;

      infos.push({
        fieldId: field.id,
        label: field.label,
        targetFormId,
        tableDisplayFields: customConfig?.tableDisplayFields || [],
        displayColumns: customConfig?.displayColumns || [],
        submissionRefIds: refIds,
      });
    }

    return infos;
  }, [row, crossRefFields]);

  if (crossRefFieldInfos.length === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <Popover open={expanded} onOpenChange={setExpanded}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 flex-shrink-0 border-border bg-background hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
              >
                {expanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className="w-auto max-w-[1100px] p-0 border-border shadow-xl"
            sideOffset={4}
          >
            <div className="max-h-[400px] overflow-y-auto">
              {crossRefFieldInfos.map((info) => (
                <CrossRefPopoverContent key={info.fieldId} fieldInfo={info} row={row} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <TooltipContent side="top">
          <span className="text-xs">Expand linked records</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
