import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, ArrowRight, FolderOpen } from 'lucide-react';
import { HierarchyRecord, HierarchyLevel, useHierarchyRecords, useHierarchyFields, calculateHierarchyKPIs } from '@/hooks/useHierarchyData';
import { HierarchyKPICards } from './HierarchyKPICards';

interface Props {
  level: HierarchyLevel;
  parentSubmissionId?: string;
  onDrillDown: (record: HierarchyRecord) => void;
  hasChildren: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  'completed': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'in progress': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  'planned': 'bg-muted text-muted-foreground border-border',
  'not started': 'bg-muted text-muted-foreground border-border',
  'on hold': 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  'blocked': 'bg-red-500/10 text-red-700 border-red-500/20',
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status?.toLowerCase()] || 'bg-muted text-muted-foreground border-border';
}

function getDisplayColumns(levelKey: string): string[] {
  switch (levelKey) {
    case 'projects':
      return ['Project_ID', 'Project_Name', 'Project_Manager', 'Project_Status', 'Planned_Budget', 'Actual_Cost', 'Risk_Score'];
    case 'wbs':
      return ['WBS_Code', 'WBS_Name', 'WBS_Manager', 'WBS_Status', 'Planned_Budget', 'Actual_Cost'];
    case 'activities':
      return ['Activity_ID', 'Activity_Name', 'Activity_Status', 'Planned_Hours', 'Actual_Hours', 'Risk_Score'];
    case 'tasks':
      return ['Task_ID', 'Task_Name', 'Task_Status', 'Planned_Hours', 'Actual_Hours', 'Productivity_Score', 'Quality_Score'];
    case 'resources':
      return ['Resource_Name', 'Role', 'Allocation', 'Planned_Hours', 'Actual_Hours', 'Utilization', 'Productivity_Score'];
    default:
      return [];
  }
}

function formatCellValue(val: any, label: string): string {
  if (val === null || val === undefined || val === '') return '-';
  if (typeof val === 'object') {
    if ('amount' in val) return `$${Number(val.amount).toLocaleString()}`;
    if ('value' in val) return String(val.value);
    return JSON.stringify(val);
  }
  // Currency fields
  if (['Planned_Budget', 'Actual_Cost', 'Forecasted_Cost', 'Earned_Value', 'Planned_Value', 'Actual_Cost_Value', 'Cost_Per_Task'].includes(label)) {
    const n = Number(val);
    if (!isNaN(n)) return `$${n.toLocaleString()}`;
  }
  // Percentage fields
  if (['Allocation', 'Utilization'].includes(label)) {
    return `${val}%`;
  }
  return String(val);
}

const LEVEL_LABELS: Record<string, string> = {
  projects: 'Projects',
  wbs: 'WBS Elements',
  activities: 'Activities',
  tasks: 'Tasks',
  resources: 'Resource Assignments',
};

const CHILD_LABELS: Record<string, string> = {
  projects: 'WBS',
  wbs: 'Activities',
  activities: 'Tasks',
  tasks: 'Resources',
};

export function HierarchyLevelView({ level, parentSubmissionId, onDrillDown, hasChildren }: Props) {
  const { data: records = [], isLoading } = useHierarchyRecords(level, parentSubmissionId);
  const { data: fields = [] } = useHierarchyFields(level.formId);
  const displayCols = getDisplayColumns(level.key);

  const fieldMap = useMemo(() => {
    const map = new Map<string, string>();
    fields.forEach(f => map.set(f.label, f.id));
    return map;
  }, [fields]);

  const kpis = useMemo(() => calculateHierarchyKPIs(records, fields, level.key), [records, fields, level.key]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading {level.name}...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      {records.length > 0 && (
        <HierarchyKPICards kpis={kpis} levelKey={level.key} />
      )}

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            {LEVEL_LABELS[level.key] || level.name}
            <Badge variant="secondary" className="ml-1">{records.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {level.name.toLowerCase()} found</p>
              <p className="text-sm mt-1">Create records in the {level.name} form to see them here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayCols.map(col => (
                      <TableHead key={col} className="text-xs whitespace-nowrap">
                        {col.replace(/_/g, ' ')}
                      </TableHead>
                    ))}
                    {hasChildren && (
                      <TableHead className="text-xs text-right w-[100px]">Drill Down</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow
                      key={record.id}
                      className={hasChildren ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => hasChildren && onDrillDown(record)}
                    >
                      {displayCols.map(col => {
                        const fieldId = fieldMap.get(col);
                        const val = fieldId ? record.data[fieldId] : undefined;
                        const isStatus = col.toLowerCase().includes('status');
                        const formatted = formatCellValue(val, col);

                        return (
                          <TableCell key={col} className="text-sm whitespace-nowrap">
                            {isStatus && formatted !== '-' ? (
                              <Badge variant="outline" className={`text-xs ${getStatusStyle(formatted)}`}>
                                {formatted}
                              </Badge>
                            ) : (
                              formatted
                            )}
                          </TableCell>
                        );
                      })}
                      {hasChildren && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-primary hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); onDrillDown(record); }}
                          >
                            {CHILD_LABELS[level.key]}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
