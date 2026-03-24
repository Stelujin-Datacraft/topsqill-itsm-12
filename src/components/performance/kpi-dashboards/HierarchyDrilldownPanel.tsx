import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Network, FolderTree, TrendingUp, DollarSign, Activity, Clock } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CROSSREF_FIELDS, type HierarchySeniorKPIs, type HierarchyPMKPIs, type HierarchyEngineerKPIs, type HierarchyFinanceKPIs, type HierarchyRiskKPIs } from '@/hooks/useHierarchyKPI';

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
  plannedBudget: 'b1000001-0011-0000-0000-000000000001',
  actualCost: 'b1000001-0012-0000-0000-000000000001',
  earnedValue: 'b1000001-0014-0000-0000-000000000001',
  plannedValue: 'b1000001-0015-0000-0000-000000000001',
  actualCostValue: 'b1000001-0016-0000-0000-000000000001',
  wbsName: 'b2000001-0004-0000-0000-000000000001',
  wbsStatus: 'b2000001-0011-0000-0000-000000000001',
  activityName: 'b3000001-0003-0000-0000-000000000001',
  activityStatus: 'b3000001-0010-0000-0000-000000000001',
  activityPlannedHours: 'b3000001-0011-0000-0000-000000000001',
  activityActualHours: 'b3000001-0012-0000-0000-000000000001',
  activityCostPerTask: 'b3000001-0014-0000-0000-000000000001',
  taskName: 'b4000001-0003-0000-0000-000000000001',
  taskStatus: 'b4000001-0005-0000-0000-000000000001',
  taskPlannedStart: 'b4000001-0006-0000-0000-000000000001',
  taskPlannedEnd: 'b4000001-0007-0000-0000-000000000001',
  taskActualStart: 'b4000001-0008-0000-0000-000000000001',
  taskActualEnd: 'b4000001-0009-0000-0000-000000000001',
  taskPlannedHours: 'b4000001-0010-0000-0000-000000000001',
  taskActualHours: 'b4000001-0011-0000-0000-000000000001',
  taskDefectCount: 'b4000001-0015-0000-0000-000000000001',
  resourceName: 'b5000001-0004-0000-0000-000000000001',
  resourceRole: 'b5000001-0005-0000-0000-000000000001',
  plannedHours: 'b5000001-0008-0000-0000-000000000001',
  actualHours: 'b5000001-0009-0000-0000-000000000001',
  overtimeHours: 'b5000001-0010-0000-0000-000000000001',
};

function asText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value !== null) {
    if ('label' in value) return String(value.label || '');
    if ('value' in value) return String(value.value || '');
  }
  return String(value);
}

function asNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null) {
    if ('amount' in value) return Number(value.amount) || 0;
    if ('value' in value) return Number(value.value) || 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function extractRefIds(crossRefValue: any): string[] {
  if (!crossRefValue) return [];
  if (Array.isArray(crossRefValue)) {
    return crossRefValue
      .map((item: any) => item?.submission_ref_id || (typeof item === 'string' ? item : null))
      .filter(Boolean);
  }
  if (typeof crossRefValue === 'string') {
    return crossRefValue.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function isCompleted(status: any): boolean {
  const s = asText(status).toLowerCase().replace(/[\s_-]+/g, '');
  return s === 'completed' || s === 'complete' || s === 'done' || s === 'closed';
}

function dateDiff(a: string, b: string): number {
  if (!a || !b) return 0;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

/** Inline mini metric badge */
function MetricBadge({ label, value, unit, variant }: { label: string; value: string | number; unit?: string; variant?: 'default' | 'success' | 'warning' | 'danger' }) {
  const color = variant === 'success' ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
    : variant === 'danger' ? 'text-destructive bg-destructive/10 border-destructive/20'
    : variant === 'warning' ? 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20'
    : 'text-foreground bg-muted border-border';
  return (
    <div className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${color}`}>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-bold">{value}{unit || ''}</span>
    </div>
  );
}

export function HierarchyDrilldownPanel({ selectedProject, hierarchy, loading, kpis, selectedRole }: Props) {
  const activitiesByRef = useMemo(
    () => new Map((hierarchy?.activities || []).map((item) => [item.submission_ref_id, item])),
    [hierarchy?.activities]
  );
  const tasksByRef = useMemo(
    () => new Map((hierarchy?.tasks || []).map((item) => [item.submission_ref_id, item])),
    [hierarchy?.tasks]
  );
  const resourcesByRef = useMemo(
    () => new Map((hierarchy?.resources || []).map((item) => [item.submission_ref_id, item])),
    [hierarchy?.resources]
  );

  if (!selectedProject) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Select a specific Project above to open the hierarchy drill-down tree with per-level KPI calculations.
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

  const projectData = selectedProject.submission_data || {};
  const projectLabel = asText(projectData[FIELDS.projectName]) || selectedProject.submission_ref_id || selectedProject.id?.slice(0, 8);

  // Project-level metrics
  const pBudget = asNumber(projectData[FIELDS.plannedBudget]);
  const pActual = asNumber(projectData[FIELDS.actualCost]);
  const ev = asNumber(projectData[FIELDS.earnedValue]);
  const pv = asNumber(projectData[FIELDS.plannedValue]);
  const ac = asNumber(projectData[FIELDS.actualCostValue]);
  const projCPI = ac > 0 ? ev / ac : 0;
  const projSPI = pv > 0 ? ev / pv : 0;
  const budgetUtil = pBudget > 0 ? (pActual / pBudget) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              Hierarchy Drill-Down
            </CardTitle>
            <CardDescription>
              {projectLabel} — click levels to see linked records with calculations.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline">{hierarchy.wbs.length} WBS</Badge>
            <Badge variant="outline">{hierarchy.activities.length} Activities</Badge>
            <Badge variant="outline">{hierarchy.tasks.length} Tasks</Badge>
            <Badge variant="outline">{hierarchy.resources.length} Resources</Badge>
          </div>
        </div>
        {/* Project-level KPI summary */}
        <div className="flex flex-wrap gap-2 mt-3">
          <MetricBadge label="Budget" value={pBudget.toLocaleString()} />
          <MetricBadge label="Actual Cost" value={pActual.toLocaleString()} />
          <MetricBadge label="Budget Util" value={`${budgetUtil.toFixed(1)}`} unit="%" variant={budgetUtil > 100 ? 'danger' : budgetUtil > 90 ? 'warning' : 'success'} />
          <MetricBadge label="CPI" value={projCPI.toFixed(2)} variant={projCPI < 0.9 ? 'danger' : projCPI >= 1 ? 'success' : 'warning'} />
          <MetricBadge label="SPI" value={projSPI.toFixed(2)} variant={projSPI < 0.9 ? 'danger' : projSPI >= 1 ? 'success' : 'warning'} />
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {hierarchy.wbs.map((wbs) => {
            const wbsData = wbs.submission_data || {};
            const activityRefs = extractRefIds(wbsData[CROSSREF_FIELDS.WBS_TO_ACTIVITIES]);
            const linkedActivities = activityRefs.map((ref) => activitiesByRef.get(ref)).filter(Boolean) as any[];

            // WBS-level metrics: count completed activities
            const completedActivities = linkedActivities.filter(a => isCompleted(a.submission_data?.[FIELDS.activityStatus])).length;
            const wbsProgress = linkedActivities.length > 0 ? (completedActivities / linkedActivities.length) * 100 : 0;

            // Aggregate hours from activities
            let wbsPlannedH = 0, wbsActualH = 0;
            for (const a of linkedActivities) {
              const ad = a.submission_data || {};
              wbsPlannedH += asNumber(ad[FIELDS.activityPlannedHours]);
              wbsActualH += asNumber(ad[FIELDS.activityActualHours]);
            }

            return (
              <AccordionItem key={wbs.id} value={`wbs-${wbs.id}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex w-full items-center justify-between gap-2 pr-2">
                    <div className="text-left">
                      <p className="font-medium text-foreground">
                        {wbs.submission_ref_id} — {asText(wbsData[FIELDS.wbsName]) || 'WBS Item'}
                      </p>
                      <p className="text-xs text-muted-foreground">{linkedActivities.length} activities · {completedActivities} completed</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MetricBadge label="Progress" value={`${wbsProgress.toFixed(0)}`} unit="%" variant={wbsProgress >= 80 ? 'success' : wbsProgress >= 50 ? 'warning' : 'default'} />
                      <Badge variant="outline">{asText(wbsData[FIELDS.wbsStatus]) || 'Unknown'}</Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {/* WBS aggregate metrics */}
                  <div className="flex flex-wrap gap-2 px-2 pb-2">
                    <MetricBadge label="Planned Hours" value={wbsPlannedH.toFixed(0)} />
                    <MetricBadge label="Actual Hours" value={wbsActualH.toFixed(0)} />
                    {wbsPlannedH > 0 && (
                      <MetricBadge
                        label="Utilization"
                        value={`${((wbsActualH / wbsPlannedH) * 100).toFixed(1)}`}
                        unit="%"
                        variant={(wbsActualH / wbsPlannedH) > 1.1 ? 'danger' : (wbsActualH / wbsPlannedH) >= 0.8 ? 'success' : 'warning'}
                      />
                    )}
                  </div>

                  {linkedActivities.length === 0 && (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      No activities linked to this WBS.
                    </div>
                  )}

                  <Accordion type="multiple" className="w-full pl-2">
                    {linkedActivities.map((activity) => {
                      const activityData = activity.submission_data || {};
                      const taskRefs = extractRefIds(activityData[CROSSREF_FIELDS.ACTIVITY_TO_TASKS]);
                      const linkedTasks = taskRefs.map((ref) => tasksByRef.get(ref)).filter(Boolean) as any[];

                      // Activity-level metrics
                      const completedTasks = linkedTasks.filter(t => isCompleted(t.submission_data?.[FIELDS.taskStatus])).length;
                      const actProgress = linkedTasks.length > 0 ? (completedTasks / linkedTasks.length) * 100 : 0;
                      const aPlanned = asNumber(activityData[FIELDS.activityPlannedHours]);
                      const aActual = asNumber(activityData[FIELDS.activityActualHours]);
                      let totalTaskDefects = 0, totalTaskDelay = 0;
                      for (const t of linkedTasks) {
                        const td = t.submission_data || {};
                        totalTaskDefects += asNumber(td[FIELDS.taskDefectCount]);
                        const plannedEnd = asText(td[FIELDS.taskPlannedEnd]);
                        const actualEnd = asText(td[FIELDS.taskActualEnd]);
                        if (actualEnd && plannedEnd) {
                          const diff = dateDiff(actualEnd, plannedEnd);
                          if (diff > 0) totalTaskDelay += diff;
                        }
                      }

                      return (
                        <AccordionItem key={activity.id} value={`activity-${activity.id}`} className="rounded-md border px-3">
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex w-full items-center justify-between gap-2 pr-2">
                              <div className="text-left">
                                <p className="text-sm font-medium text-foreground">
                                  {activity.submission_ref_id} — {asText(activityData[FIELDS.activityName]) || 'Activity'}
                                </p>
                                <p className="text-xs text-muted-foreground">{linkedTasks.length} tasks · {completedTasks} completed</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MetricBadge label="Tasks" value={`${actProgress.toFixed(0)}`} unit="%" variant={actProgress >= 80 ? 'success' : actProgress >= 50 ? 'warning' : 'default'} />
                                <Badge variant="secondary">{asText(activityData[FIELDS.activityStatus]) || 'Unknown'}</Badge>
                              </div>
                            </div>
                          </AccordionTrigger>

                          <AccordionContent className="space-y-2 pb-3">
                            {/* Activity aggregate metrics */}
                            <div className="flex flex-wrap gap-2 px-1 pb-2">
                              <MetricBadge label="Planned" value={`${aPlanned.toFixed(0)}h`} />
                              <MetricBadge label="Actual" value={`${aActual.toFixed(0)}h`} />
                              {totalTaskDelay > 0 && <MetricBadge label="Delay" value={`${totalTaskDelay}d`} variant="danger" />}
                              {totalTaskDefects > 0 && <MetricBadge label="Defects" value={totalTaskDefects} variant="warning" />}
                              {linkedTasks.length > 0 && (
                                <MetricBadge
                                  label="Quality"
                                  value={`${Math.max(0, 100 - (totalTaskDefects / linkedTasks.length) * 100).toFixed(0)}`}
                                  unit="%"
                                  variant={totalTaskDefects === 0 ? 'success' : 'warning'}
                                />
                              )}
                            </div>

                            {linkedTasks.length === 0 && (
                              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                No tasks linked to this activity.
                              </div>
                            )}

                            {linkedTasks.map((task) => {
                              const taskData = task.submission_data || {};
                              const resourceRefs = extractRefIds(taskData[CROSSREF_FIELDS.TASK_TO_RESOURCES]);
                              const linkedResources = resourceRefs.map((ref) => resourcesByRef.get(ref)).filter(Boolean) as any[];

                              const tPlanned = asNumber(taskData[FIELDS.taskPlannedHours]);
                              const tActual = asNumber(taskData[FIELDS.taskActualHours]);
                              const tDefects = asNumber(taskData[FIELDS.taskDefectCount]);
                              const tPlannedEnd = asText(taskData[FIELDS.taskPlannedEnd]);
                              const tActualEnd = asText(taskData[FIELDS.taskActualEnd]);
                              const taskDelay = tActualEnd && tPlannedEnd ? dateDiff(tActualEnd, tPlannedEnd) : 0;
                              const taskUtil = tPlanned > 0 ? (tActual / tPlanned) * 100 : 0;
                              const productivity = tActual > 0 ? tPlanned / tActual : 0;

                              return (
                                <div key={task.id} className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {task.submission_ref_id} — {asText(taskData[FIELDS.taskName]) || 'Task'}
                                    </p>
                                    <Badge variant="outline">{asText(taskData[FIELDS.taskStatus]) || 'Unknown'}</Badge>
                                  </div>

                                  {/* Task-level KPIs */}
                                  <div className="flex flex-wrap gap-1.5">
                                    <MetricBadge label="Planned" value={`${tPlanned.toFixed(0)}h`} />
                                    <MetricBadge label="Actual" value={`${tActual.toFixed(0)}h`} />
                                    {tPlanned > 0 && <MetricBadge label="Util" value={`${taskUtil.toFixed(0)}`} unit="%" variant={taskUtil > 110 ? 'danger' : taskUtil >= 80 ? 'success' : 'warning'} />}
                                    {tActual > 0 && <MetricBadge label="Productivity" value={productivity.toFixed(2)} variant={productivity >= 1 ? 'success' : 'warning'} />}
                                    {taskDelay > 0 && <MetricBadge label="Delay" value={`${taskDelay}d`} variant="danger" />}
                                    {tDefects > 0 && <MetricBadge label="Defects" value={tDefects} variant="warning" />}
                                    {tActual > tPlanned && <MetricBadge label="Overtime" value={`${(tActual - tPlanned).toFixed(0)}h`} variant="danger" />}
                                  </div>

                                  {linkedResources.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No resources linked.</p>
                                  ) : (
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <FolderTree className="h-3 w-3" />
                                        Resources ({linkedResources.length})
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {linkedResources.map((resource) => {
                                          const rd = resource.submission_data || {};
                                          const rPlanned = asNumber(rd[FIELDS.plannedHours]);
                                          const rActual = asNumber(rd[FIELDS.actualHours]);
                                          const rOvertime = asNumber(rd[FIELDS.overtimeHours]);
                                          const rUtil = rPlanned > 0 ? ((rActual / rPlanned) * 100).toFixed(0) : '—';
                                          return (
                                            <div key={resource.id} className="rounded-md border bg-background p-2 text-xs space-y-0.5">
                                              <p className="font-medium">{resource.submission_ref_id} · {asText(rd[FIELDS.resourceName]) || 'Resource'}</p>
                                              <p className="text-muted-foreground">{asText(rd[FIELDS.resourceRole])}</p>
                                              <div className="flex gap-1.5 mt-1">
                                                <MetricBadge label="H" value={`${rActual.toFixed(0)}/${rPlanned.toFixed(0)}`} />
                                                <MetricBadge label="Util" value={rUtil} unit="%" variant={Number(rUtil) > 110 ? 'danger' : Number(rUtil) >= 80 ? 'success' : 'warning'} />
                                                {rOvertime > 0 && <MetricBadge label="OT" value={`${rOvertime.toFixed(0)}h`} variant="danger" />}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
