import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Network, ChevronRight, Home } from 'lucide-react';
import { CROSSREF_FIELDS, type HierarchySeniorKPIs, type HierarchyPMKPIs, type HierarchyEngineerKPIs, type HierarchyFinanceKPIs, type HierarchyRiskKPIs } from '@/hooks/useHierarchyKPI';
import { RecordDetailView } from './RecordDetailView';

type HierarchyLevel = 'project' | 'wbs' | 'activity' | 'task' | 'resource';

interface BreadcrumbItem {
  record: any;
  level: HierarchyLevel;
  label: string;
}

interface KPISet {
  seniorKPIs: HierarchySeniorKPIs;
  pmKPIs: HierarchyPMKPIs;
  engineerKPIs: HierarchyEngineerKPIs;
  financeKPIs: HierarchyFinanceKPIs;
  riskKPIs: HierarchyRiskKPIs;
}

type RoleType = 'senior_management' | 'project_manager' | 'discipline_engineer' | 'finance_contract' | 'risk_governance';

interface Props {
  selectedProject: any | null;
  hierarchy: { wbs: any[]; activities: any[]; tasks: any[]; resources: any[] } | null;
  loading: boolean;
  kpis?: KPISet | null;
  selectedRole?: RoleType;
}

const FIELDS = {
  projectName: 'b1000001-0002-0000-0000-000000000001',
  wbsName: 'b2000001-0004-0000-0000-000000000001',
  activityName: 'b3000001-0003-0000-0000-000000000001',
  taskName: 'b4000001-0003-0000-0000-000000000001',
  resourceName: 'b5000001-0004-0000-0000-000000000001',
};

function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') return String(v.label || v.value || '');
  return String(v);
}

function extractRefIds(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((i: any) => i?.submission_ref_id || (typeof i === 'string' ? i : null)).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

const LEVEL_LABELS: Record<HierarchyLevel, string> = {
  project: 'Project',
  wbs: 'WBS',
  activity: 'Activity',
  task: 'Task',
  resource: 'Resource',
};

const NAME_FIELDS: Record<HierarchyLevel, string> = {
  project: FIELDS.projectName,
  wbs: FIELDS.wbsName,
  activity: FIELDS.activityName,
  task: FIELDS.taskName,
  resource: FIELDS.resourceName,
};

const CHILD_LEVEL: Record<HierarchyLevel, HierarchyLevel | null> = {
  project: 'wbs',
  wbs: 'activity',
  activity: 'task',
  task: 'resource',
  resource: null,
};

const CROSSREF_MAP: Record<string, string> = {
  'project-wbs': CROSSREF_FIELDS.PROJECT_TO_WBS,
  'wbs-activity': CROSSREF_FIELDS.WBS_TO_ACTIVITIES,
  'activity-task': CROSSREF_FIELDS.ACTIVITY_TO_TASKS,
  'task-resource': CROSSREF_FIELDS.TASK_TO_RESOURCES,
};

function getRecordLabel(record: any, level: HierarchyLevel): string {
  const d = record.submission_data || {};
  const name = asText(d[NAME_FIELDS[level]]);
  const ref = record.submission_ref_id || record.id?.slice(0, 8);
  return name ? `${ref} — ${name}` : ref;
}

export function HierarchyDrilldownPanel({ selectedProject, hierarchy, loading, kpis, selectedRole }: Props) {
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);

  // Build lookup maps
  const lookups = useMemo(() => {
    if (!hierarchy) return { wbs: new Map(), activities: new Map(), tasks: new Map(), resources: new Map() };
    return {
      wbs: new Map(hierarchy.wbs.map(r => [r.submission_ref_id, r])),
      activities: new Map(hierarchy.activities.map(r => [r.submission_ref_id, r])),
      tasks: new Map(hierarchy.tasks.map(r => [r.submission_ref_id, r])),
      resources: new Map(hierarchy.resources.map(r => [r.submission_ref_id, r])),
    };
  }, [hierarchy]);

  // Get children for a given record at a given level
  const getChildren = useCallback((record: any, level: HierarchyLevel): any[] => {
    const childLvl = CHILD_LEVEL[level];
    if (!childLvl || !hierarchy) return [];

    const crossRefKey = `${level}-${childLvl}`;
    const crossRefField = CROSSREF_MAP[crossRefKey];
    if (!crossRefField) return [];

    const d = record.submission_data || {};
    const refIds = extractRefIds(d[crossRefField]);

    const lookupMap = childLvl === 'wbs' ? lookups.wbs
      : childLvl === 'activity' ? lookups.activities
      : childLvl === 'task' ? lookups.tasks
      : lookups.resources;

    return refIds.map(ref => lookupMap.get(ref)).filter(Boolean);
  }, [hierarchy, lookups]);

  // Navigate to a child record
  const handleSelectChild = useCallback((record: any, level: HierarchyLevel) => {
    setBreadcrumb(prev => [...prev, { record, level, label: getRecordLabel(record, level) }]);
  }, []);

  // Navigate via breadcrumb
  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index < 0) {
      setBreadcrumb([]);
    } else {
      setBreadcrumb(prev => prev.slice(0, index + 1));
    }
  }, []);

  // Reset when project changes
  const prevProjectId = React.useRef(selectedProject?.id);
  React.useEffect(() => {
    if (prevProjectId.current !== selectedProject?.id) {
      setBreadcrumb([]);
      prevProjectId.current = selectedProject?.id;
    }
  }, [selectedProject?.id]);

  if (!selectedProject) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Select a specific Project above to open the hierarchy drill-down with per-level KPI calculations and inline reports.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading linked hierarchy...
        </CardContent>
      </Card>
    );
  }

  if (!hierarchy || hierarchy.wbs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No linked WBS records found for this project. Add cross-reference links in the Project record to enable drill-down.
        </CardContent>
      </Card>
    );
  }

  // Determine current view
  const currentItem = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1] : null;
  const currentRecord = currentItem ? currentItem.record : selectedProject;
  const currentLevel: HierarchyLevel = currentItem ? currentItem.level : 'project';
  const childLevel = CHILD_LEVEL[currentLevel];
  const childRecords = getChildren(currentRecord, currentLevel);

  const projectLabel = getRecordLabel(selectedProject, 'project');

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <Card className="bg-muted/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-1 flex-wrap text-sm">
            <Button
              variant={breadcrumb.length === 0 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => handleBreadcrumbClick(-1)}
            >
              <Home className="h-3 w-3" />
              {projectLabel}
            </Button>
            {breadcrumb.map((item, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Button
                  variant={index === breadcrumb.length - 1 ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleBreadcrumbClick(index)}
                >
                  <Badge variant="outline" className="text-[9px] px-1 py-0 mr-1">{LEVEL_LABELS[item.level]}</Badge>
                  {item.label}
                </Button>
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-[10px]">{hierarchy.wbs.length} WBS</Badge>
            <Badge variant="outline" className="text-[10px]">{hierarchy.activities.length} Activities</Badge>
            <Badge variant="outline" className="text-[10px]">{hierarchy.tasks.length} Tasks</Badge>
            <Badge variant="outline" className="text-[10px]">{hierarchy.resources.length} Resources</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Current Level Header */}
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {LEVEL_LABELS[currentLevel]} Detail
        </h3>
        <span className="text-xs text-muted-foreground">—</span>
        <span className="text-xs text-muted-foreground">
          {asText(currentRecord.submission_data?.[NAME_FIELDS[currentLevel]]) || currentRecord.submission_ref_id}
        </span>
      </div>

      {/* Record Detail View */}
      <RecordDetailView
        record={currentRecord}
        level={currentLevel}
        childRecords={childRecords}
        childLevel={childLevel}
        onSelectChild={handleSelectChild}
        allActivities={hierarchy.activities}
        allTasks={hierarchy.tasks}
        allResources={hierarchy.resources}
      />
    </div>
  );
}
