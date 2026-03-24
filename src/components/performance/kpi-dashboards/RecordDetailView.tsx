import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronRight, TrendingUp, TrendingDown, DollarSign, Clock, Users, CheckCircle2, AlertTriangle, BarChart3, Info, Target, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, LineChart, Line } from 'recharts';
import { CROSSREF_FIELDS } from '@/hooks/useHierarchyKPI';

// ========================
// FIELD IDS
// ========================
const FIELDS = {
  projectName: 'b1000001-0002-0000-0000-000000000001',
  projectStatus: 'b1000001-0010-0000-0000-000000000001',
  plannedBudget: 'b1000001-0011-0000-0000-000000000001',
  actualCost: 'b1000001-0012-0000-0000-000000000001',
  forecastedCost: 'b1000001-0013-0000-0000-000000000001',
  earnedValue: 'b1000001-0014-0000-0000-000000000001',
  plannedValue: 'b1000001-0015-0000-0000-000000000001',
  actualCostValue: 'b1000001-0016-0000-0000-000000000001',
  riskScore: 'b1000001-0017-0000-0000-000000000001',
  predictedDelay: 'b1000001-0018-0000-0000-000000000001',
  startDate: 'b1000001-0007-0000-0000-000000000001',
  endDatePlanned: 'b1000001-0008-0000-0000-000000000001',
  endDateActual: 'b1000001-0009-0000-0000-000000000001',
  wbsName: 'b2000001-0004-0000-0000-000000000001',
  wbsStatus: 'b2000001-0011-0000-0000-000000000001',
  activityName: 'b3000001-0003-0000-0000-000000000001',
  activityStatus: 'b3000001-0010-0000-0000-000000000001',
  activityPlannedHours: 'b3000001-0011-0000-0000-000000000001',
  activityActualHours: 'b3000001-0012-0000-0000-000000000001',
  activityCostPerTask: 'b3000001-0014-0000-0000-000000000001',
  taskName: 'b4000001-0003-0000-0000-000000000001',
  taskStatus: 'b4000001-0005-0000-0000-000000000001',
  taskPlannedEnd: 'b4000001-0007-0000-0000-000000000001',
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

type HierarchyLevel = 'project' | 'wbs' | 'activity' | 'task' | 'resource';

interface RecordDetailViewProps {
  record: any;
  level: HierarchyLevel;
  childRecords: any[];
  childLevel: HierarchyLevel | null;
  onSelectChild: (record: any, level: HierarchyLevel) => void;
  allActivities?: any[];
  allTasks?: any[];
  allResources?: any[];
}

// ========================
// HELPERS
// ========================
function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') return String(v.label || v.value || '');
  return String(v);
}

function asNum(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') return Number(v.amount || v.value || 0) || 0;
  return Number(v) || 0;
}

function isCompleted(s: any): boolean {
  const n = asText(s).toLowerCase().replace(/[\s_-]+/g, '');
  return n === 'completed' || n === 'complete' || n === 'done' || n === 'closed';
}

function isDelayed(s: any): boolean {
  const n = asText(s).toLowerCase().replace(/[\s_-]+/g, '');
  return n === 'delayed' || n === 'overdue' || n === 'behindschedule';
}

function dateDiff(a: string, b: string): number {
  if (!a || !b) return 0;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

function extractRefIds(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((i: any) => i?.submission_ref_id || (typeof i === 'string' ? i : null)).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 150 60% 45%))',
  'hsl(var(--chart-3, 45 90% 55%))',
  'hsl(var(--chart-4, 0 70% 55%))',
  'hsl(var(--chart-5, 270 60% 55%))',
  'hsl(var(--accent))',
];

// ========================
// KPI CARD with formula tooltip
// ========================
interface KPICardData {
  label: string;
  value: string | number;
  unit?: string;
  icon?: any;
  trend?: 'up' | 'down' | 'neutral';
  formula?: string; // Formula description
  hideIfZero?: boolean;
}

function KPICard({ label, value, unit, icon: Icon, trend, formula }: KPICardData) {
  const displayValue = typeof value === 'number'
    ? (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2))
    : value;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
              {formula && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 shrink-0 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px]">
                      <p className="text-xs font-mono">{formula}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              {displayValue}
              {unit && <span className="text-sm font-normal text-muted-foreground ml-0.5">{unit}</span>}
            </p>
          </div>
          {Icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
        {trend && (
          <div className={`absolute top-0 left-0 w-1 h-full ${trend === 'up' ? 'bg-emerald-500' : trend === 'down' ? 'bg-destructive' : 'bg-muted'}`} />
        )}
      </CardContent>
    </Card>
  );
}

// ========================
// CHILD RECORD ROW
// ========================
function ChildRecordRow({ record, level, onClick, metrics }: {
  record: any; level: HierarchyLevel; onClick: () => void;
  metrics: { label: string; value: string; variant?: string }[];
}) {
  const d = record.submission_data || {};
  const nameFieldMap: Record<HierarchyLevel, string> = {
    project: FIELDS.projectName,
    wbs: FIELDS.wbsName,
    activity: FIELDS.activityName,
    task: FIELDS.taskName,
    resource: FIELDS.resourceName,
  };
  const statusFieldMap: Record<HierarchyLevel, string> = {
    project: FIELDS.projectStatus,
    wbs: FIELDS.wbsStatus,
    activity: FIELDS.activityStatus,
    task: FIELDS.taskStatus,
    resource: FIELDS.resourceRole,
  };

  const name = asText(d[nameFieldMap[level]]) || record.submission_ref_id || 'Record';
  const status = asText(d[statusFieldMap[level]]);
  const isLeaf = level === 'resource';

  return (
    <div
      className={`group flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors ${isLeaf ? '' : 'cursor-pointer'}`}
      onClick={isLeaf ? undefined : onClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            <span className="text-muted-foreground font-mono text-xs mr-1.5">{record.submission_ref_id}</span>
            {name}
          </p>
          {status && <Badge variant="outline" className="w-fit mt-1 text-[10px]">{status}</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {metrics.map((m, i) => (
          <div key={i} className={`text-right ${m.variant === 'danger' ? 'text-destructive' : m.variant === 'success' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            <p className="text-[10px] text-muted-foreground">{m.label}</p>
            <p className="text-xs font-bold">{m.value}</p>
          </div>
        ))}
        {!isLeaf && (
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </div>
    </div>
  );
}

// ========================
// MAIN COMPONENT
// ========================
export function RecordDetailView({
  record, level, childRecords, childLevel, onSelectChild,
  allActivities = [], allTasks = [], allResources = [],
}: RecordDetailViewProps) {
  const d = record.submission_data || {};

  const { kpiCards, charts, childMetrics } = useMemo(() => {
    const kpiCards: KPICardData[] = [];
    const charts: { title: string; type: string; data: any[]; dataKeys?: string[] }[] = [];

    if (level === 'project') {
      // Read direct fields
      const budget = asNum(d[FIELDS.plannedBudget]);
      const actual = asNum(d[FIELDS.actualCost]);
      const ev = asNum(d[FIELDS.earnedValue]);
      const pv = asNum(d[FIELDS.plannedValue]);
      const ac = asNum(d[FIELDS.actualCostValue]);
      const forecast = asNum(d[FIELDS.forecastedCost]);
      const predDelay = asNum(d[FIELDS.predictedDelay]);
      const endPlanned = asText(d[FIELDS.endDatePlanned]);
      const endActual = asText(d[FIELDS.endDateActual]);

      // Aggregated from children
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => isCompleted(t.submission_data?.[FIELDS.taskStatus])).length;
      const delayedTasks = allTasks.filter(t => {
        const pe = asText(t.submission_data?.[FIELDS.taskPlannedEnd]);
        const ae = asText(t.submission_data?.[FIELDS.taskActualEnd]);
        return pe && ae && dateDiff(ae, pe) > 0;
      }).length;

      // Aggregated hours from all tasks
      let totalPlannedHours = 0, totalActualHours = 0;
      allTasks.forEach(t => {
        totalPlannedHours += asNum(t.submission_data?.[FIELDS.taskPlannedHours]);
        totalActualHours += asNum(t.submission_data?.[FIELDS.taskActualHours]);
      });

      // Calculated KPIs
      const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      const cpi = ac > 0 ? ev / ac : 0;
      const spi = pv > 0 ? ev / pv : 0;
      const budgetUtil = budget > 0 ? (actual / budget) * 100 : 0;
      const eac = cpi > 0 ? budget / cpi : 0;
      const etc = eac > 0 ? eac - actual : 0;
      const vac = eac > 0 ? budget - eac : 0;
      const costVariance = ev - ac;
      const costVariancePct = budget > 0 ? ((ev - ac) / budget) * 100 : 0;
      const scheduleVariancePct = pv > 0 ? ((ev - pv) / pv) * 100 : 0;
      const onTimeRate = totalTasks > 0 ? ((totalTasks - delayedTasks) / totalTasks) * 100 : 0;
      const predictedCostOverrun = budget > 0 && forecast > 0 ? ((forecast - budget) / budget) * 100 : 0;

      // Formula-based Risk Score
      let riskScore = 0;
      if (cpi > 0 && cpi < 1) riskScore += Math.min((1 - cpi) * 100, 30) * 0.3;
      if (spi > 0 && spi < 1) riskScore += Math.min((1 - spi) * 100, 30) * 0.3;
      if (totalTasks > 0) riskScore += (delayedTasks / totalTasks) * 100 * 0.2;
      if (predDelay > 0) riskScore += Math.min(predDelay * 3, 100) * 0.1;
      if (predictedCostOverrun > 0) riskScore += Math.min(predictedCostOverrun, 100) * 0.1;
      riskScore = Math.round(Math.min(riskScore, 100));

      kpiCards.push(
        { label: 'Progress', value: progress, unit: '%', icon: Target, trend: progress >= 75 ? 'up' : progress >= 50 ? 'neutral' : 'down',
          formula: '(Completed_Tasks / Total_Tasks) × 100' },
        { label: 'Planned Budget', value: budget, icon: DollarSign, formula: 'SUM(Planned_Budget)' },
        { label: 'Actual Cost', value: actual, icon: DollarSign, trend: actual > budget ? 'down' : 'up',
          formula: 'SUM(Actual_Cost)' },
        { label: 'Budget Utilization', value: budgetUtil, unit: '%', icon: BarChart3,
          formula: '(Actual_Cost / Planned_Budget) × 100' },
        { label: 'CPI', value: cpi, icon: TrendingUp, trend: cpi >= 1 ? 'up' : cpi >= 0.9 ? 'neutral' : 'down',
          formula: 'Earned_Value / Actual_Cost_Value' },
        { label: 'SPI', value: spi, icon: TrendingUp, trend: spi >= 1 ? 'up' : spi >= 0.9 ? 'neutral' : 'down',
          formula: 'Earned_Value / Planned_Value' },
        { label: 'Cost Variance', value: costVariance, icon: DollarSign, trend: costVariance >= 0 ? 'up' : 'down',
          formula: 'EV - AC' },
        { label: 'Schedule Var.', value: scheduleVariancePct, unit: '%', icon: Clock,
          trend: scheduleVariancePct >= 0 ? 'up' : 'down', formula: '((EV - PV) / PV) × 100' },
        { label: 'EAC', value: eac, icon: DollarSign, formula: 'Budget / CPI' },
        { label: 'ETC', value: etc, icon: DollarSign, formula: 'EAC - Actual_Cost', hideIfZero: true },
        { label: 'VAC', value: vac, icon: DollarSign, trend: vac >= 0 ? 'up' : 'down',
          formula: 'Budget - EAC', hideIfZero: true },
        { label: 'On-Time Rate', value: onTimeRate, unit: '%', icon: CheckCircle2,
          trend: onTimeRate >= 80 ? 'up' : onTimeRate >= 60 ? 'neutral' : 'down',
          formula: '(Tasks_On_Time / Total_Tasks) × 100' },
        { label: 'Delayed Tasks', value: delayedTasks, icon: AlertTriangle,
          trend: delayedTasks > 0 ? 'down' : 'up',
          formula: 'COUNT_IF(Actual_End > Planned_End)' },
        { label: 'Risk Score', value: riskScore, icon: AlertTriangle,
          trend: riskScore > 70 ? 'down' : riskScore > 40 ? 'neutral' : 'up',
          formula: 'Weighted: CPI(30%) + SPI(30%) + Delays(20%) + Pred(10%) + Overrun(10%)' },
        { label: 'Pred. Delay', value: predDelay, unit: 'd', icon: Clock,
          formula: 'Predicted_Delay_Days', hideIfZero: true },
        { label: 'Pred. Overrun', value: predictedCostOverrun, unit: '%', icon: TrendingDown,
          trend: predictedCostOverrun > 0 ? 'down' : 'up',
          formula: '((Forecast - Budget) / Budget) × 100', hideIfZero: true },
      );

      // Charts
      if (budget > 0 || actual > 0) {
        charts.push({
          title: 'Budget vs Actual vs Forecast',
          type: 'bar',
          data: [
            { name: 'Planned', value: budget },
            { name: 'Actual', value: actual },
            { name: 'Forecast', value: forecast },
            { name: 'EAC', value: eac },
          ].filter(d => d.value > 0),
        });
      }

      if (ev > 0 || pv > 0 || ac > 0) {
        charts.push({
          title: 'Earned Value Analysis',
          type: 'area',
          data: [
            { name: 'Planned Value', EV: 0, PV: 0, AC: 0 },
            { name: 'Current', EV: ev, PV: pv, AC: ac },
            { name: 'At Completion', EV: budget, PV: budget, AC: eac },
          ],
          dataKeys: ['EV', 'PV', 'AC'],
        });
      }

      // Health Radar
      charts.push({
        title: 'Project Health Radar',
        type: 'radar',
        data: [
          { metric: 'CPI', value: Math.min(cpi * 50, 100) },
          { metric: 'SPI', value: Math.min(spi * 50, 100) },
          { metric: 'On-Time', value: onTimeRate },
          { metric: 'Budget', value: Math.max(0, 100 - budgetUtil + 100) > 100 ? 100 : Math.max(0, 200 - budgetUtil) },
          { metric: 'Quality', value: totalTasks > 0 ? Math.max(0, 100 - (allTasks.reduce((s, t) => s + asNum(t.submission_data?.[FIELDS.taskDefectCount]), 0) / totalTasks) * 100) : 100 },
          { metric: 'Risk', value: Math.max(0, 100 - riskScore) },
        ],
      });

      // Cost Variance breakdown
      charts.push({
        title: 'Cost & Schedule Variance',
        type: 'bar',
        data: [
          { name: 'Cost Var', value: costVariance },
          { name: 'Schedule Var %', value: scheduleVariancePct },
          { name: 'Budget Util %', value: budgetUtil },
          { name: 'Overrun %', value: predictedCostOverrun },
        ],
      });

      if (childRecords.length > 0) {
        const activitiesByRef = new Map(allActivities.map(a => [a.submission_ref_id, a]));
        const wbsChartData = childRecords.map(wbs => {
          const wd = wbs.submission_data || {};
          const refs = extractRefIds(wd[CROSSREF_FIELDS.WBS_TO_ACTIVITIES]);
          const linked = refs.map(r => activitiesByRef.get(r)).filter(Boolean);
          const comp = linked.filter(a => isCompleted(a.submission_data?.[FIELDS.activityStatus])).length;
          return {
            name: asText(wd[FIELDS.wbsName]) || wbs.submission_ref_id || 'WBS',
            completed: comp,
            total: linked.length,
            progress: linked.length > 0 ? Math.round((comp / linked.length) * 100) : 0,
          };
        });
        charts.push({ title: 'WBS Progress', type: 'progress-bar', data: wbsChartData, dataKeys: ['progress'] });
      }

      if (allTasks.length > 0) {
        const statusMap: Record<string, number> = {};
        allTasks.forEach(t => {
          const s = asText(t.submission_data?.[FIELDS.taskStatus]) || 'Unknown';
          statusMap[s] = (statusMap[s] || 0) + 1;
        });
        charts.push({
          title: 'Task Status Distribution',
          type: 'pie',
          data: Object.entries(statusMap).map(([name, value]) => ({ name, value })),
        });
      }

      // Resource utilization pie
      if (allResources.length > 0) {
        const resData = allResources.map(r => ({
          name: asText(r.submission_data?.[FIELDS.resourceName]) || r.submission_ref_id,
          value: asNum(r.submission_data?.[FIELDS.actualHours]),
        })).filter(d => d.value > 0).slice(0, 10);
        if (resData.length > 0) {
          charts.push({ title: 'Resource Hours Distribution', type: 'pie', data: resData });
        }
      }
    }

    if (level === 'wbs') {
      // WBS aggregates from its linked activities and deeper children
      const completedAct = childRecords.filter(a => isCompleted(a.submission_data?.[FIELDS.activityStatus])).length;
      const progress = childRecords.length > 0 ? (completedAct / childRecords.length) * 100 : 0;

      let totalPlanned = 0, totalActual = 0;
      childRecords.forEach(a => {
        totalPlanned += asNum(a.submission_data?.[FIELDS.activityPlannedHours]);
        totalActual += asNum(a.submission_data?.[FIELDS.activityActualHours]);
      });
      const util = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
      const productivity = totalActual > 0 ? totalPlanned / totalActual : 0;

      // Aggregate tasks under this WBS's activities
      const activityRefs = new Set(childRecords.map(a => a.submission_ref_id));
      const wbsTasks = allTasks.filter(t => {
        // Find if this task's parent activity is under this WBS
        for (const act of childRecords) {
          const refs = extractRefIds(act.submission_data?.[CROSSREF_FIELDS.ACTIVITY_TO_TASKS]);
          if (refs.includes(t.submission_ref_id)) return true;
        }
        return false;
      });
      const completedTasks = wbsTasks.filter(t => isCompleted(t.submission_data?.[FIELDS.taskStatus])).length;
      const taskProgress = wbsTasks.length > 0 ? (completedTasks / wbsTasks.length) * 100 : 0;
      let totalDefects = 0, totalDelay = 0;
      wbsTasks.forEach(t => {
        totalDefects += asNum(t.submission_data?.[FIELDS.taskDefectCount]);
        const pe = asText(t.submission_data?.[FIELDS.taskPlannedEnd]);
        const ae = asText(t.submission_data?.[FIELDS.taskActualEnd]);
        if (pe && ae) { const diff = dateDiff(ae, pe); if (diff > 0) totalDelay += diff; }
      });

      kpiCards.push(
        { label: 'Activities', value: childRecords.length, icon: BarChart3, formula: 'COUNT(Activity_ID)' },
        { label: 'Completed', value: completedAct, icon: CheckCircle2, trend: 'up',
          formula: 'COUNT_IF(Activity_Status = "Completed")' },
        { label: 'Activity Progress', value: progress, unit: '%', icon: TrendingUp,
          trend: progress >= 75 ? 'up' : 'neutral',
          formula: '(Completed_Activities / Total_Activities) × 100' },
        { label: 'Task Progress', value: taskProgress, unit: '%', icon: Target,
          trend: taskProgress >= 75 ? 'up' : 'neutral',
          formula: '(Completed_Tasks / Total_Tasks) × 100' },
        { label: 'Planned Hours', value: totalPlanned, icon: Clock, formula: 'SUM(Activity_Planned_Hours)' },
        { label: 'Actual Hours', value: totalActual, icon: Clock,
          trend: totalActual > totalPlanned ? 'down' : 'up',
          formula: 'SUM(Activity_Actual_Hours)' },
        { label: 'Utilization', value: util, unit: '%', icon: Users,
          formula: '(Actual_Hours / Planned_Hours) × 100' },
        { label: 'Productivity', value: productivity, icon: Zap,
          trend: productivity >= 1 ? 'up' : 'down',
          formula: 'Planned_Hours / Actual_Hours' },
        { label: 'Total Delay', value: totalDelay, unit: 'd', icon: Clock,
          trend: totalDelay > 0 ? 'down' : 'up',
          formula: 'SUM(Task_Delay_Days)', hideIfZero: true },
        { label: 'Defects', value: totalDefects, icon: AlertTriangle,
          trend: totalDefects > 0 ? 'down' : 'up',
          formula: 'SUM(Task_Defect_Count)', hideIfZero: true },
      );

      if (childRecords.length > 0) {
        charts.push({
          title: 'Activity Hours: Planned vs Actual',
          type: 'bar-compare',
          data: childRecords.map(a => ({
            name: asText(a.submission_data?.[FIELDS.activityName]) || a.submission_ref_id,
            planned: asNum(a.submission_data?.[FIELDS.activityPlannedHours]),
            actual: asNum(a.submission_data?.[FIELDS.activityActualHours]),
          })),
          dataKeys: ['planned', 'actual'],
        });

        // Activity status pie
        const actStatusMap: Record<string, number> = {};
        childRecords.forEach(a => {
          const s = asText(a.submission_data?.[FIELDS.activityStatus]) || 'Unknown';
          actStatusMap[s] = (actStatusMap[s] || 0) + 1;
        });
        charts.push({ title: 'Activity Status', type: 'pie', data: Object.entries(actStatusMap).map(([name, value]) => ({ name, value })) });
      }

      // WBS Health Radar
      charts.push({
        title: 'WBS Health Overview',
        type: 'radar',
        data: [
          { metric: 'Activity %', value: progress },
          { metric: 'Task %', value: taskProgress },
          { metric: 'Utilization', value: Math.min(util, 100) },
          { metric: 'Productivity', value: Math.min(productivity * 50, 100) },
          { metric: 'Quality', value: wbsTasks.length > 0 ? Math.max(0, 100 - (totalDefects / wbsTasks.length) * 100) : 100 },
        ],
      });
    }

    if (level === 'activity') {
      const completedTasks = childRecords.filter(t => isCompleted(t.submission_data?.[FIELDS.taskStatus])).length;
      const progress = childRecords.length > 0 ? (completedTasks / childRecords.length) * 100 : 0;
      let totalDefects = 0, totalDelay = 0, tPlanned = 0, tActual = 0;
      childRecords.forEach(t => {
        const td = t.submission_data || {};
        totalDefects += asNum(td[FIELDS.taskDefectCount]);
        tPlanned += asNum(td[FIELDS.taskPlannedHours]);
        tActual += asNum(td[FIELDS.taskActualHours]);
        const pe = asText(td[FIELDS.taskPlannedEnd]);
        const ae = asText(td[FIELDS.taskActualEnd]);
        if (pe && ae) { const diff = dateDiff(ae, pe); if (diff > 0) totalDelay += diff; }
      });
      const quality = childRecords.length > 0 ? Math.max(0, 100 - (totalDefects / childRecords.length) * 100) : 100;
      const util = tPlanned > 0 ? (tActual / tPlanned) * 100 : 0;
      const productivity = tActual > 0 ? tPlanned / tActual : 0;
      const delayedCount = childRecords.filter(t => {
        const pe = asText(t.submission_data?.[FIELDS.taskPlannedEnd]);
        const ae = asText(t.submission_data?.[FIELDS.taskActualEnd]);
        return pe && ae && dateDiff(ae, pe) > 0;
      }).length;

      // Activity's own hours
      const actPlanned = asNum(d[FIELDS.activityPlannedHours]);
      const actActual = asNum(d[FIELDS.activityActualHours]);

      kpiCards.push(
        { label: 'Tasks', value: childRecords.length, icon: BarChart3, formula: 'COUNT(Task_ID)' },
        { label: 'Completed', value: completedTasks, icon: CheckCircle2, trend: 'up',
          formula: 'COUNT_IF(Task_Status = "Completed")' },
        { label: 'Task Completion', value: progress, unit: '%', icon: TrendingUp,
          formula: '(Completed_Tasks / Total_Tasks) × 100' },
        { label: 'Delayed Tasks', value: delayedCount, icon: AlertTriangle,
          trend: delayedCount > 0 ? 'down' : 'up',
          formula: 'COUNT_IF(Actual_End > Planned_End)' },
        { label: 'Planned Hours', value: actPlanned > 0 ? actPlanned : tPlanned, icon: Clock,
          formula: actPlanned > 0 ? 'Activity_Planned_Hours' : 'SUM(Task_Planned_Hours)' },
        { label: 'Actual Hours', value: actActual > 0 ? actActual : tActual, icon: Clock,
          trend: (actActual > 0 ? actActual : tActual) > (actPlanned > 0 ? actPlanned : tPlanned) ? 'down' : 'up',
          formula: actActual > 0 ? 'Activity_Actual_Hours' : 'SUM(Task_Actual_Hours)' },
        { label: 'Utilization', value: util, unit: '%', icon: Users,
          formula: '(Actual_Hours / Planned_Hours) × 100' },
        { label: 'Productivity', value: productivity, icon: Zap,
          trend: productivity >= 1 ? 'up' : 'down',
          formula: 'Planned_Hours / Actual_Hours' },
        { label: 'Quality Score', value: quality, unit: '%', icon: CheckCircle2,
          trend: quality >= 90 ? 'up' : 'neutral',
          formula: '100 - (Defects / Tasks × 100)' },
        { label: 'Total Delay', value: totalDelay, unit: 'd', icon: Clock,
          trend: totalDelay > 0 ? 'down' : 'up',
          formula: 'SUM(DAYS(Actual_End - Planned_End))' },
        { label: 'Defects', value: totalDefects, icon: AlertTriangle,
          trend: totalDefects > 0 ? 'down' : 'up', formula: 'SUM(Defect_Count)' },
      );

      if (childRecords.length > 0) {
        charts.push({
          title: 'Task Hours: Planned vs Actual',
          type: 'bar-compare',
          data: childRecords.map(t => ({
            name: asText(t.submission_data?.[FIELDS.taskName]) || t.submission_ref_id,
            planned: asNum(t.submission_data?.[FIELDS.taskPlannedHours]),
            actual: asNum(t.submission_data?.[FIELDS.taskActualHours]),
          })),
          dataKeys: ['planned', 'actual'],
        });

        const defectData = childRecords
          .map(t => ({ name: asText(t.submission_data?.[FIELDS.taskName]) || t.submission_ref_id, defects: asNum(t.submission_data?.[FIELDS.taskDefectCount]) }))
          .filter(d => d.defects > 0);
        if (defectData.length > 0) {
          charts.push({ title: 'Defects by Task', type: 'bar', data: defectData.map(d => ({ name: d.name, value: d.defects })) });
        }

        // Task status pie
        const taskStatusMap: Record<string, number> = {};
        childRecords.forEach(t => {
          const s = asText(t.submission_data?.[FIELDS.taskStatus]) || 'Unknown';
          taskStatusMap[s] = (taskStatusMap[s] || 0) + 1;
        });
        charts.push({ title: 'Task Status', type: 'pie', data: Object.entries(taskStatusMap).map(([name, value]) => ({ name, value })) });
      }

      // Activity Health Radar
      charts.push({
        title: 'Activity Health',
        type: 'radar',
        data: [
          { metric: 'Completion', value: progress },
          { metric: 'Utilization', value: Math.min(util, 100) },
          { metric: 'Quality', value: quality },
          { metric: 'Productivity', value: Math.min(productivity * 50, 100) },
          { metric: 'On-Time', value: childRecords.length > 0 ? ((childRecords.length - delayedCount) / childRecords.length) * 100 : 100 },
        ],
      });
    }

    if (level === 'task') {
      const tPlanned = asNum(d[FIELDS.taskPlannedHours]);
      const tActual = asNum(d[FIELDS.taskActualHours]);
      const tDefects = asNum(d[FIELDS.taskDefectCount]);
      const pe = asText(d[FIELDS.taskPlannedEnd]);
      const ae = asText(d[FIELDS.taskActualEnd]);
      const delay = pe && ae ? Math.max(0, dateDiff(ae, pe)) : 0;
      const util = tPlanned > 0 ? (tActual / tPlanned) * 100 : 0;
      const productivity = tActual > 0 ? tPlanned / tActual : 0;
      const overtime = Math.max(0, tActual - tPlanned);
      const quality = Math.max(0, 100 - tDefects * 10); // Each defect costs 10 points

      // Aggregate resource hours
      let rPlanned = 0, rActual = 0, rOvertime = 0;
      childRecords.forEach(r => {
        rPlanned += asNum(r.submission_data?.[FIELDS.plannedHours]);
        rActual += asNum(r.submission_data?.[FIELDS.actualHours]);
        rOvertime += asNum(r.submission_data?.[FIELDS.overtimeHours]);
      });

      kpiCards.push(
        { label: 'Planned Hours', value: tPlanned, icon: Clock, formula: 'Task_Planned_Hours' },
        { label: 'Actual Hours', value: tActual, icon: Clock,
          trend: tActual > tPlanned ? 'down' : 'up', formula: 'Task_Actual_Hours' },
        { label: 'Utilization', value: util, unit: '%', icon: Users,
          formula: '(Actual_Hours / Planned_Hours) × 100' },
        { label: 'Productivity', value: productivity, icon: Zap,
          trend: productivity >= 1 ? 'up' : 'down',
          formula: 'Planned_Hours / Actual_Hours' },
        { label: 'Delay', value: delay, unit: 'd', icon: Clock,
          trend: delay > 0 ? 'down' : 'up',
          formula: 'DAYS(Actual_End - Planned_End)' },
        { label: 'Overtime', value: overtime, unit: 'h', icon: AlertTriangle,
          trend: overtime > 0 ? 'down' : 'up',
          formula: 'Actual_Hours - Planned_Hours', hideIfZero: true },
        { label: 'Quality', value: quality, unit: '%', icon: CheckCircle2,
          trend: quality >= 90 ? 'up' : 'neutral',
          formula: '100 - (Defects × 10)' },
        { label: 'Defects', value: tDefects, icon: AlertTriangle,
          trend: tDefects > 0 ? 'down' : 'up', formula: 'Defect_Count' },
        { label: 'Resources', value: childRecords.length, icon: Users, formula: 'COUNT(Resource_ID)' },
      );

      // Show resource aggregate if available
      if (rPlanned > 0 || rActual > 0) {
        kpiCards.push(
          { label: 'Res. Planned Hrs', value: rPlanned, icon: Clock,
            formula: 'SUM(Resource_Planned_Hours)', hideIfZero: true },
          { label: 'Res. Actual Hrs', value: rActual, icon: Clock,
            formula: 'SUM(Resource_Actual_Hours)', hideIfZero: true },
          { label: 'Res. Overtime', value: rOvertime, unit: 'h', icon: AlertTriangle,
            trend: rOvertime > 0 ? 'down' : 'up',
            formula: 'SUM(Resource_Overtime)', hideIfZero: true },
        );
      }

      if (childRecords.length > 0) {
        charts.push({
          title: 'Resource Hours',
          type: 'bar-compare',
          data: childRecords.map(r => ({
            name: asText(r.submission_data?.[FIELDS.resourceName]) || r.submission_ref_id,
            planned: asNum(r.submission_data?.[FIELDS.plannedHours]),
            actual: asNum(r.submission_data?.[FIELDS.actualHours]),
          })),
          dataKeys: ['planned', 'actual'],
        });
      }
    }

    if (level === 'resource') {
      const rPlanned = asNum(d[FIELDS.plannedHours]);
      const rActual = asNum(d[FIELDS.actualHours]);
      const rOvertime = asNum(d[FIELDS.overtimeHours]);
      const util = rPlanned > 0 ? (rActual / rPlanned) * 100 : 0;
      const productivity = rActual > 0 ? rPlanned / rActual : 0;
      const role = asText(d[FIELDS.resourceRole]);

      kpiCards.push(
        { label: 'Planned Hours', value: rPlanned, icon: Clock, formula: 'Resource_Planned_Hours' },
        { label: 'Actual Hours', value: rActual, icon: Clock, formula: 'Resource_Actual_Hours' },
        { label: 'Overtime', value: rOvertime, unit: 'h', icon: AlertTriangle,
          trend: rOvertime > 0 ? 'down' : 'up', formula: 'Actual_Hours - Planned_Hours' },
        { label: 'Utilization', value: util, unit: '%', icon: Users,
          formula: '(Actual_Hours / Planned_Hours) × 100' },
        { label: 'Productivity', value: productivity, icon: Zap,
          trend: productivity >= 1 ? 'up' : 'down',
          formula: 'Planned_Hours / Actual_Hours' },
      );
    }

    // Per-child metrics for the list
    const childMetricsFn = (child: any): { label: string; value: string; variant?: string }[] => {
      const cd = child.submission_data || {};
      if (childLevel === 'wbs') {
        const refs = extractRefIds(cd[CROSSREF_FIELDS.WBS_TO_ACTIVITIES]);
        return [{ label: 'Activities', value: String(refs.length) }];
      }
      if (childLevel === 'activity') {
        const ph = asNum(cd[FIELDS.activityPlannedHours]);
        const ah = asNum(cd[FIELDS.activityActualHours]);
        return [
          { label: 'Hours', value: `${ah}/${ph}` },
          ...(ah > ph ? [{ label: 'Over', value: `+${ah - ph}h`, variant: 'danger' }] : []),
        ];
      }
      if (childLevel === 'task') {
        const ph = asNum(cd[FIELDS.taskPlannedHours]);
        const ah = asNum(cd[FIELDS.taskActualHours]);
        const def = asNum(cd[FIELDS.taskDefectCount]);
        return [
          { label: 'Hours', value: `${ah}/${ph}` },
          ...(def > 0 ? [{ label: 'Defects', value: String(def), variant: 'danger' }] : []),
        ];
      }
      if (childLevel === 'resource') {
        const ph = asNum(cd[FIELDS.plannedHours]);
        const ah = asNum(cd[FIELDS.actualHours]);
        const util = ph > 0 ? Math.round((ah / ph) * 100) : 0;
        return [{ label: 'Util', value: `${util}%`, variant: util > 110 ? 'danger' : util >= 80 ? 'success' : undefined }];
      }
      return [];
    };

    return { kpiCards, charts, childMetrics: childMetricsFn };
  }, [record, level, childRecords, childLevel, allActivities, allTasks, allResources]);

  // Filter out hideIfZero cards
  const visibleKPIs = kpiCards.filter(k => !(k.hideIfZero && (k.value === 0 || k.value === '0')));

  const renderChart = (chart: typeof charts[0], index: number) => {
    const tooltipStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 };

    if (chart.type === 'bar') {
      return (
        <Card key={index}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{chart.title}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    }

    if (chart.type === 'bar-compare') {
      return (
        <Card key={index}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{chart.title}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="planned" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="hsl(var(--chart-2, 150 60% 45%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    }

    if (chart.type === 'progress-bar') {
      return (
        <Card key={index}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{chart.title}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart.data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} className="fill-muted-foreground" />
                <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    }

    if (chart.type === 'pie') {
      return (
        <Card key={index}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{chart.title}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {chart.data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  const levelLabel: Record<HierarchyLevel, string> = { project: 'Project', wbs: 'WBS', activity: 'Activity', task: 'Task', resource: 'Resource' };
  const childLevelLabel: Record<HierarchyLevel, string> = { project: 'Projects', wbs: 'WBS Items', activity: 'Activities', task: 'Tasks', resource: 'Resources' };

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {visibleKPIs.map((kpi, i) => (
          <KPICard key={i} {...kpi} />
        ))}
      </div>

      {/* Charts */}
      {charts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {charts.map((chart, i) => renderChart(chart, i))}
        </div>
      )}

      {/* Child Records */}
      {childLevel && childRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {childLevelLabel[childLevel]}
                <Badge variant="secondary" className="text-[10px]">{childRecords.length}</Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {childRecords.map(child => (
              <ChildRecordRow
                key={child.id}
                record={child}
                level={childLevel}
                onClick={() => onSelectChild(child, childLevel)}
                metrics={childMetrics(child)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {childLevel && childRecords.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No {childLevelLabel[childLevel || 'project']?.toLowerCase()} linked to this {levelLabel[level]?.toLowerCase()}.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
