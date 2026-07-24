import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, Calculator, X, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type FormulaBreakdown, type FormulaVariable, type ContributingRecord } from './FormulaBreakdownDialog';

interface FormulaBreakdownTableProps {
  title: string;
  breakdown: FormulaBreakdown;
  onClose: () => void;
}

function VariableRow({ variable, depth = 0 }: { variable: FormulaVariable; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasSub = !!variable.subBreakdown;
  const sub = variable.subBreakdown;

  return (
    <>
      <TableRow
        className={cn(
          hasSub && 'cursor-pointer hover:bg-primary/5',
          variable.highlight && 'bg-primary/5',
        )}
        onClick={hasSub ? () => setExpanded(!expanded) : undefined}
      >
        <TableCell className="py-2">
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
            {hasSub && (
              expanded
                ? <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground">{variable.label}</span>
            {hasSub && !expanded && (
              <Badge variant="outline" className="text-[9px] ml-1 h-4 px-1">has formula</Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="py-2">
          {variable.fieldName && (
            <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
              {variable.fieldName}
            </code>
          )}
        </TableCell>
        <TableCell className="py-2 text-right">
          <Badge variant={variable.highlight ? 'default' : 'secondary'} className="font-mono text-xs">
            {typeof variable.value === 'number' ? variable.value.toLocaleString('en-IN') : variable.value}
          </Badge>
        </TableCell>
      </TableRow>
      {/* Sub-breakdown rows when expanded */}
      {expanded && sub && (
        <>
          {/* Sub-formula row */}
          <TableRow className="bg-muted/30">
            <TableCell colSpan={3} className="py-1.5" style={{ paddingLeft: (depth + 1) * 20 + 8 }}>
              <div className="flex items-center gap-2">
                <Calculator className="icon-xs text-primary" />
                <code className="text-[11px] font-mono text-primary">{sub.formula}</code>
                {sub.description && (
                  <span className="text-[10px] text-muted-foreground">— {sub.description}</span>
                )}
              </div>
            </TableCell>
          </TableRow>
          {sub.variables.map((sv, si) => (
            <VariableRow key={si} variable={sv} depth={depth + 1} />
          ))}
          {sub.steps && sub.steps.map((step, si) => (
            <TableRow key={`step-${si}`} className="bg-muted/20">
              <TableCell className="py-1.5" style={{ paddingLeft: (depth + 1) * 20 + 8 }}>
                <span className="text-xs text-muted-foreground">Step {si + 1}: {step.label}</span>
              </TableCell>
              <TableCell className="py-1.5">
                <code className="text-[11px] font-mono text-foreground">{step.expression}</code>
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <span className="text-xs font-bold font-mono text-foreground">{step.result}</span>
              </TableCell>
            </TableRow>
          ))}
          {/* Sub result */}
          <TableRow className="bg-primary/5">
            <TableCell className="py-1.5" style={{ paddingLeft: (depth + 1) * 20 + 8 }}>
              <span className="text-xs font-semibold text-primary">= Result</span>
            </TableCell>
            <TableCell className="py-1.5" />
            <TableCell className="py-1.5 text-right">
              <Badge variant="default" className="font-mono text-xs">
                {typeof sub.result === 'number' ? sub.result.toLocaleString('en-IN') : sub.result}
              </Badge>
            </TableCell>
          </TableRow>
        </>
      )}
    </>
  );
}

// Field label mapping for readable display
const FIELD_LABELS: Record<string, string> = {
  'b1000001-0002-0000-0000-000000000001': 'Project Name',
  'b1000001-0010-0000-0000-000000000001': 'Project Status',
  'b1000001-0011-0000-0000-000000000001': 'Planned Budget',
  'b1000001-0012-0000-0000-000000000001': 'Actual Cost',
  'b1000001-0013-0000-0000-000000000001': 'Forecasted Cost',
  'b1000001-0014-0000-0000-000000000001': 'Earned Value',
  'b1000001-0015-0000-0000-000000000001': 'Planned Value',
  'b1000001-0016-0000-0000-000000000001': 'Actual Cost Value',
  'b1000001-0017-0000-0000-000000000001': 'Risk Score',
  'b1000001-0018-0000-0000-000000000001': 'Predicted Delay Days',
  'b1000001-0007-0000-0000-000000000001': 'Start Date',
  'b1000001-0008-0000-0000-000000000001': 'End Date (Planned)',
  'b1000001-0009-0000-0000-000000000001': 'End Date (Actual)',
  'b2000001-0004-0000-0000-000000000001': 'WBS Name',
  'b2000001-0011-0000-0000-000000000001': 'WBS Status',
  'b2000001-0012-0000-0000-000000000001': 'Planned Hours',
  'b2000001-0013-0000-0000-000000000001': 'Actual Hours',
  'b2000001-0014-0000-0000-000000000001': 'Earned Value',
  'b2000001-0015-0000-0000-000000000001': 'Planned Value',
  'b3000001-0003-0000-0000-000000000001': 'Activity Name',
  'b3000001-0010-0000-0000-000000000001': 'Activity Status',
  'b3000001-0011-0000-0000-000000000001': 'Planned Hours',
  'b3000001-0012-0000-0000-000000000001': 'Actual Hours',
  'b3000001-0014-0000-0000-000000000001': 'Cost Per Task',
  'b4000001-0003-0000-0000-000000000001': 'Task Name',
  'b4000001-0005-0000-0000-000000000001': 'Task Status',
  'b4000001-0007-0000-0000-000000000001': 'Planned End Date',
  'b4000001-0009-0000-0000-000000000001': 'Actual End Date',
  'b4000001-0010-0000-0000-000000000001': 'Planned Hours',
  'b4000001-0011-0000-0000-000000000001': 'Actual Hours',
  'b4000001-0015-0000-0000-000000000001': 'Defect Count',
  'b5000001-0004-0000-0000-000000000001': 'Resource Name',
  'b5000001-0005-0000-0000-000000000001': 'Role',
  'b5000001-0008-0000-0000-000000000001': 'Planned Hours',
  'b5000001-0009-0000-0000-000000000001': 'Actual Hours',
  'b5000001-0010-0000-0000-000000000001': 'Overtime Hours',
};

function formatRawValue(val: any): string {
  if (val == null || val === '') return '-';
  if (typeof val === 'number') return val.toLocaleString('en-IN');
  if (Array.isArray(val)) return val.map(v => v?.submission_ref_id || JSON.stringify(v)).join(', ');
  if (typeof val === 'object') return val.label || val.value || val.name || JSON.stringify(val);
  return String(val);
}

function ContributingRecordRow({ rec }: { rec: ContributingRecord }) {
  const [expanded, setExpanded] = useState(false);
  const hasRawData = rec.rawData && Object.keys(rec.rawData).length > 0;
  const hasChildren = rec.childRecords && rec.childRecords.length > 0;
  const canExpand = hasRawData || hasChildren;

  // Filter raw data to only show meaningful fields (skip cross-ref arrays, IDs)
  const displayFields = React.useMemo(() => {
    if (!rec.rawData) return [];
    return Object.entries(rec.rawData)
      .filter(([key, val]) => {
        if (Array.isArray(val) && val.length > 0 && val[0]?.submission_ref_id) return false; // skip cross-refs
        if (key.length > 30 && !FIELD_LABELS[key]) return false; // skip unknown UUIDs
        return val != null && val !== '';
      })
      .map(([key, val]) => ({
        label: FIELD_LABELS[key] || key,
        value: formatRawValue(val),
        isNumeric: typeof val === 'number',
      }));
  }, [rec.rawData]);

  return (
    <>
      <TableRow
        className={cn(
          'cursor-pointer transition-colors',
          rec.variant === 'danger' ? 'bg-destructive/5 hover:bg-destructive/10' :
          rec.variant === 'success' ? 'bg-emerald-500/5 hover:bg-emerald-500/10' :
          rec.variant === 'warning' ? 'bg-amber-500/5 hover:bg-amber-500/10' :
          'hover:bg-muted/50',
          expanded && 'bg-primary/5'
        )}
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <TableCell className="py-1.5 w-6 px-2">
          {canExpand && (
            expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-primary" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="py-1.5">
          <code className="text-[11px] font-mono text-primary">{rec.refId}</code>
        </TableCell>
        <TableCell className="py-1.5 text-sm">{rec.name}</TableCell>
        <TableCell className="py-1.5">
          {rec.status && (
            <Badge variant="outline" className="text-[10px]">{rec.status}</Badge>
          )}
        </TableCell>
        <TableCell className="py-1.5 text-right">
          <Badge variant={rec.variant === 'danger' ? 'destructive' : 'secondary'} className="font-mono text-xs">
            {typeof rec.value === 'number' ? rec.value.toLocaleString('en-IN') : rec.value}
          </Badge>
        </TableCell>
        <TableCell className="py-1.5 text-xs text-muted-foreground">{rec.detail || ''}</TableCell>
      </TableRow>

      {/* Expanded: Raw field values */}
      {expanded && displayFields.length > 0 && (
        <TableRow>
          <TableCell colSpan={6} className="p-0">
            <div className="bg-muted/30 border-t border-b px-4 py-2.5 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="icon-xs" />
                Source Data — {rec.refId} ({rec.name})
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                {displayFields.map((field, fi) => (
                  <div key={fi} className="flex items-baseline justify-between gap-2 text-xs border-b border-border/30 pb-1">
                    <span className="text-muted-foreground truncate">{field.label}</span>
                    <span className={cn(
                      "font-mono shrink-0 font-medium",
                      field.isNumeric ? "text-primary" : "text-foreground"
                    )}>
                      {field.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Child records if any */}
              {hasChildren && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Linked Child Records ({rec.childRecords!.length})
                  </p>
                  <div className="rounded border overflow-hidden">
                    <Table>
                      <TableBody>
                        {rec.childRecords!.map((child, ci) => (
                          <ContributingRecordRow key={ci} rec={child} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function FormulaBreakdownTable({ title, breakdown, onClose }: FormulaBreakdownTableProps) {
  return (
    <Card className="border-primary/30 shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="icon-md text-primary" />
          <CardTitle className="text-sm">{title} — Formula Breakdown</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Formula display */}
        <div className="rounded-md bg-muted/60 border px-3 py-2">
          <code className="text-sm font-mono text-foreground">{breakdown.formula}</code>
          {breakdown.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{breakdown.description}</p>
          )}
        </div>

        {/* Variables table */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="text-[11px] uppercase tracking-wider h-8">Field</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider h-8">Source</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider h-8 text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.variables.map((v, i) => (
                <VariableRow key={i} variable={v} />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Calculation steps */}
        {breakdown.steps && breakdown.steps.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-[11px] uppercase tracking-wider h-8">Step</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider h-8">Expression</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider h-8 text-right">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.steps.map((step, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] h-5 w-5 p-0 flex items-center justify-center shrink-0">
                          {i + 1}
                        </Badge>
                        <span className="text-xs text-foreground">{step.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <code className="text-xs font-mono text-foreground">{step.expression}</code>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-xs font-bold font-mono text-foreground">{step.result}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Contributing Records Drill-down */}
        {breakdown.contributingRecords && breakdown.contributingRecords.records.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {breakdown.contributingRecords.title} ({breakdown.contributingRecords.records.length} records)
              <span className="ml-2 text-primary/60 normal-case font-normal">— click any row to drill down</span>
            </p>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-[11px] uppercase tracking-wider h-8 w-6"></TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Ref ID</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Name</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Status</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8 text-right">
                      {breakdown.contributingRecords.valueLabel || 'Value'}
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.contributingRecords.records.map((rec, i) => (
                    <ContributingRecordRow key={i} rec={rec} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Final result */}
        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5">
          <span className="text-sm font-semibold text-foreground">Result</span>
          <span className="text-lg font-bold text-primary font-mono">
            {typeof breakdown.result === 'number' ? breakdown.result.toLocaleString('en-IN') : breakdown.result}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
