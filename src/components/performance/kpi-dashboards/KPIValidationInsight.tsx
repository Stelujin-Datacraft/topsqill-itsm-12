import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, TrendingUp, TrendingDown, FileSearch, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type FormulaBreakdown } from './FormulaBreakdownDialog';

type HierarchyLevel = 'project' | 'wbs' | 'activity' | 'task' | 'resource';

interface ValidationContext {
  level: HierarchyLevel;
  record: any;
  childRecords: any[];
  allTasks?: any[];
  allActivities?: any[];
  allResources?: any[];
}

interface KPIValidationInsightProps {
  kpiLabel: string;
  breakdown: FormulaBreakdown;
  context: ValidationContext;
  onClose: () => void;
}

// ========================
// HELPERS
// ========================
function asNum(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') return Number(v.amount || v.value || 0) || 0;
  return Number(v) || 0;
}

function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') return String(v.label || v.value || '');
  return String(v);
}

const FIELDS = {
  plannedBudget: 'b1000001-0011-0000-0000-000000000001',
  actualCost: 'b1000001-0012-0000-0000-000000000001',
  earnedValue: 'b1000001-0014-0000-0000-000000000001',
  plannedValue: 'b1000001-0015-0000-0000-000000000001',
  actualCostValue: 'b1000001-0016-0000-0000-000000000001',
  endDatePlanned: 'b1000001-0008-0000-0000-000000000001',
  endDateActual: 'b1000001-0009-0000-0000-000000000001',
  wbsName: 'b2000001-0004-0000-0000-000000000001',
  wbsStatus: 'b2000001-0011-0000-0000-000000000001',
  activityName: 'b3000001-0003-0000-0000-000000000001',
  activityStatus: 'b3000001-0010-0000-0000-000000000001',
  taskName: 'b4000001-0003-0000-0000-000000000001',
  taskStatus: 'b4000001-0005-0000-0000-000000000001',
  taskPlannedEnd: 'b4000001-0007-0000-0000-000000000001',
  taskActualEnd: 'b4000001-0009-0000-0000-000000000001',
  taskPlannedHours: 'b4000001-0010-0000-0000-000000000001',
  taskActualHours: 'b4000001-0011-0000-0000-000000000001',
  taskDefectCount: 'b4000001-0015-0000-0000-000000000001',
  resourceName: 'b5000001-0004-0000-0000-000000000001',
  plannedHours: 'b5000001-0008-0000-0000-000000000001',
  actualHours: 'b5000001-0009-0000-0000-000000000001',
};

function getChildName(child: any, level: HierarchyLevel): string {
  const d = child.submission_data || {};
  const nameMap: Partial<Record<HierarchyLevel, string>> = {
    wbs: FIELDS.wbsName,
    activity: FIELDS.activityName,
    task: FIELDS.taskName,
    resource: FIELDS.resourceName,
  };
  return asText(d[nameMap[level] || '']) || child.submission_ref_id || 'Unknown';
}

interface InsightItem {
  icon: 'check' | 'warn' | 'error';
  text: string;
}

export function KPIValidationInsight({ kpiLabel, breakdown, context, onClose }: KPIValidationInsightProps) {
  const { level, record, childRecords, allTasks = [], allActivities = [], allResources = [] } = context;
  const d = record.submission_data || {};

  const analysis = useMemo(() => {
    const consistencyChecks: { label: string; childValues: string; sum: string; displayed: string; match: boolean }[] = [];
    const comparisons: InsightItem[] = [];
    const healthIndicators: { metric: string; value: number; status: 'good' | 'neutral' | 'poor'; label: string }[] = [];
    const rootCauses: { child: string; reason: string; severity: 'high' | 'medium' | 'low' }[] = [];
    let summary = '';

    const lowerLabel = kpiLabel.toLowerCase();

    // ========================
    // A. DATA CONSISTENCY CHECK
    // ========================
    if (level === 'project' && childRecords.length > 0) {
      // Check hours roll-up
      if (lowerLabel.includes('planned hours') || lowerLabel.includes('actual hours')) {
        const isPlanned = lowerLabel.includes('planned');
        let childSum = 0;
        const childParts: string[] = [];

        // Roll up from tasks → resources
        allTasks.forEach(t => {
          const td = t.submission_data || {};
          const val = isPlanned ? asNum(td[FIELDS.taskPlannedHours]) : asNum(td[FIELDS.taskActualHours]);
          childSum += val;
          if (val > 0) childParts.push(String(val));
        });

        const displayedVal = parseFloat(String(breakdown.result).replace(/[^\d.-]/g, '')) || 0;
        const diff = Math.abs(childSum - displayedVal);
        consistencyChecks.push({
          label: `Task ${isPlanned ? 'Planned' : 'Actual'} Hours Roll-up`,
          childValues: childParts.length > 0 ? childParts.slice(0, 8).join(' + ') + (childParts.length > 8 ? ' + ...' : '') : '0',
          sum: `${childSum}`,
          displayed: `${displayedVal}`,
          match: diff < 0.5,
        });
      }
    }

    // Generic roll-up checks for count-based KPIs
    if (lowerLabel.includes('total') && (lowerLabel.includes('task') || lowerLabel.includes('activit') || lowerLabel.includes('wbs') || lowerLabel.includes('resource'))) {
      const displayedVal = typeof breakdown.result === 'number' ? breakdown.result : parseInt(String(breakdown.result)) || 0;
      let actualCount = 0;
      if (lowerLabel.includes('task')) actualCount = allTasks.length;
      else if (lowerLabel.includes('activit')) actualCount = allActivities.length;
      else if (lowerLabel.includes('resource')) actualCount = allResources.length;
      else if (lowerLabel.includes('wbs')) actualCount = childRecords.length;

      if (actualCount > 0) {
        consistencyChecks.push({
          label: `${kpiLabel} Count Verification`,
          childValues: `COUNT = ${actualCount}`,
          sum: String(actualCount),
          displayed: String(displayedVal),
          match: actualCount === displayedVal,
        });
      }
    }

    // ========================
    // B. PERFORMANCE COMPARISON (with linked record field details)
    // ========================
    const comparisonDetails: { label: string; fields: { name: string; source: string; value: string }[] }[] = [];

    if (level === 'project') {
      const budget = asNum(d[FIELDS.plannedBudget]);
      const actual = asNum(d[FIELDS.actualCost]);
      const ev = asNum(d[FIELDS.earnedValue]);
      const ac = asNum(d[FIELDS.actualCostValue]);
      const pv = asNum(d[FIELDS.plannedValue]);
      const endPlanned = asText(d[FIELDS.endDatePlanned]);
      const endActual = asText(d[FIELDS.endDateActual]);

      // Cost comparisons
      if (lowerLabel.includes('cost') || lowerLabel.includes('budget') || lowerLabel.includes('cpi') || lowerLabel.includes('eac') || lowerLabel.includes('variance')) {
        if (budget > 0 && actual > 0) {
          comparisons.push({
            icon: actual <= budget ? 'check' : 'error',
            text: actual <= budget
              ? `✔ Under Budget — Actual ₹${actual.toLocaleString('en-IN')} vs Planned ₹${budget.toLocaleString('en-IN')} (${((budget - actual) / budget * 100).toFixed(1)}% savings)`
              : `❌ Over Budget — Actual ₹${actual.toLocaleString('en-IN')} vs Planned ₹${budget.toLocaleString('en-IN')} (${((actual - budget) / budget * 100).toFixed(1)}% overrun)`,
          });
          comparisonDetails.push({
            label: 'Budget vs Actual Cost',
            fields: [
              { name: 'Planned_Budget', source: 'Project Record', value: `₹${budget.toLocaleString('en-IN')}` },
              { name: 'Actual_Cost', source: 'Project Record', value: `₹${actual.toLocaleString('en-IN')}` },
              { name: 'Difference', source: 'Calculated', value: `₹${Math.abs(budget - actual).toLocaleString('en-IN')} ${actual <= budget ? '(Savings)' : '(Overrun)'}` },
            ],
          });
        }
        if (ev > 0 && ac > 0) {
          const cpi = ev / ac;
          comparisons.push({
            icon: cpi >= 1 ? 'check' : cpi >= 0.9 ? 'warn' : 'error',
            text: cpi >= 1
              ? `✔ Cost Efficient — CPI ${cpi.toFixed(2)} (EV ₹${ev.toLocaleString('en-IN')} > AC ₹${ac.toLocaleString('en-IN')})`
              : `⚠️ Cost Overrun — CPI ${cpi.toFixed(2)} (EV ₹${ev.toLocaleString('en-IN')} < AC ₹${ac.toLocaleString('en-IN')})`,
          });
          comparisonDetails.push({
            label: 'CPI Comparison (EV vs AC)',
            fields: [
              { name: 'Earned_Value (EV)', source: 'Project Record', value: `₹${ev.toLocaleString('en-IN')}` },
              { name: 'Actual_Cost_Value (AC)', source: 'Project Record', value: `₹${ac.toLocaleString('en-IN')}` },
              { name: 'CPI (EV / AC)', source: 'Calculated', value: cpi.toFixed(4) },
            ],
          });
        }
      }

      // Schedule comparisons
      if (lowerLabel.includes('schedule') || lowerLabel.includes('spi') || lowerLabel.includes('delay') || lowerLabel.includes('progress')) {
        if (ev > 0 && pv > 0) {
          const spi = ev / pv;
          comparisons.push({
            icon: spi >= 1 ? 'check' : spi >= 0.9 ? 'warn' : 'error',
            text: spi >= 1
              ? `✔ On Schedule — SPI ${spi.toFixed(2)} (Earned Value ≥ Planned Value)`
              : `❌ Behind Schedule — SPI ${spi.toFixed(2)} (Earned Value < Planned Value)`,
          });
          comparisonDetails.push({
            label: 'SPI Comparison (EV vs PV)',
            fields: [
              { name: 'Earned_Value (EV)', source: 'Project Record', value: `₹${ev.toLocaleString('en-IN')}` },
              { name: 'Planned_Value (PV)', source: 'Project Record', value: `₹${pv.toLocaleString('en-IN')}` },
              { name: 'SPI (EV / PV)', source: 'Calculated', value: spi.toFixed(4) },
            ],
          });
        }
        if (endPlanned && endActual) {
          const diffDays = Math.round((new Date(endActual).getTime() - new Date(endPlanned).getTime()) / 86400000);
          comparisons.push({
            icon: diffDays <= 0 ? 'check' : 'error',
            text: diffDays <= 0
              ? `✔ On Time — Completed ${Math.abs(diffDays)} days early`
              : `❌ Delayed — ${diffDays} days past planned end date`,
          });
          comparisonDetails.push({
            label: 'End Date Comparison',
            fields: [
              { name: 'Planned_End_Date', source: 'Project Record', value: endPlanned },
              { name: 'Actual_End_Date', source: 'Project Record', value: endActual },
              { name: 'Difference', source: 'Calculated', value: `${Math.abs(diffDays)} days ${diffDays <= 0 ? 'early' : 'late'}` },
            ],
          });
        }
      }
    }

    // Hours-based comparisons for any level with child record details
    if (lowerLabel.includes('utilization') || lowerLabel.includes('productivity') || lowerLabel.includes('hours') || lowerLabel.includes('overtime')) {
      const vars = breakdown.variables || [];
      const plannedVar = vars.find(v => v.label.toLowerCase().includes('planned'));
      const actualVar = vars.find(v => v.label.toLowerCase().includes('actual'));
      if (plannedVar && actualVar) {
        const planned = typeof plannedVar.value === 'number' ? plannedVar.value : parseFloat(String(plannedVar.value).replace(/[^\d.-]/g, '')) || 0;
        const actual = typeof actualVar.value === 'number' ? actualVar.value : parseFloat(String(actualVar.value).replace(/[^\d.-]/g, '')) || 0;
        if (planned > 0) {
          const ratio = actual / planned;
          comparisons.push({
            icon: ratio <= 1.1 ? 'check' : ratio <= 1.3 ? 'warn' : 'error',
            text: ratio <= 1
              ? `✔ Within Budget Hours — ${actual}h used of ${planned}h planned (${((1 - ratio) * 100).toFixed(0)}% remaining)`
              : `⚠️ Hours Exceeded — ${actual}h used of ${planned}h planned (${((ratio - 1) * 100).toFixed(0)}% over)`,
          });

          // Build child-level hour details
          const childLevel: HierarchyLevel = level === 'project' ? 'wbs' : level === 'wbs' ? 'activity' : level === 'activity' ? 'task' : 'resource';
          const hourFields: { name: string; source: string; value: string }[] = [];
          
          if (childLevel === 'resource' || childLevel === 'task') {
            childRecords.slice(0, 10).forEach(child => {
              const cd = child.submission_data || {};
              const isResource = childLevel === 'resource';
              const pHrs = asNum(cd[isResource ? FIELDS.plannedHours : FIELDS.taskPlannedHours]);
              const aHrs = asNum(cd[isResource ? FIELDS.actualHours : FIELDS.taskActualHours]);
              const name = getChildName(child, childLevel);
              if (pHrs > 0 || aHrs > 0) {
                hourFields.push({ name: `${name} — Planned`, source: `${childLevel} Record`, value: `${pHrs}h` });
                hourFields.push({ name: `${name} — Actual`, source: `${childLevel} Record`, value: `${aHrs}h` });
              }
            });
          }

          if (hourFields.length > 0) {
            comparisonDetails.push({
              label: `Hours Breakdown by ${childLevel.charAt(0).toUpperCase() + childLevel.slice(1)}`,
              fields: [
                { name: 'Total Planned Hours', source: 'Roll-up Sum', value: `${planned}h` },
                { name: 'Total Actual Hours', source: 'Roll-up Sum', value: `${actual}h` },
                ...hourFields,
              ],
            });
          } else {
            comparisonDetails.push({
              label: 'Hours Comparison',
              fields: [
                { name: 'Planned_Hours', source: plannedVar.label, value: `${planned}h` },
                { name: 'Actual_Hours', source: actualVar.label, value: `${actual}h` },
                { name: 'Ratio', source: 'Calculated', value: `${(ratio * 100).toFixed(1)}%` },
              ],
            });
          }
        }
      }
    }

    // ========================
    // C. KPI HEALTH INDICATOR
    // ========================
    if (level === 'project') {
      const ev = asNum(d[FIELDS.earnedValue]);
      const ac = asNum(d[FIELDS.actualCostValue]);
      const pv = asNum(d[FIELDS.plannedValue]);

      if (ac > 0 && ev > 0) {
        const cpi = ev / ac;
        healthIndicators.push({
          metric: 'CPI (Cost Performance)',
          value: cpi,
          status: cpi > 1 ? 'good' : cpi === 1 ? 'neutral' : 'poor',
          label: cpi > 1 ? 'Good — Under Budget' : cpi === 1 ? 'Neutral — On Budget' : 'Poor — Over Budget',
        });
      }
      if (pv > 0 && ev > 0) {
        const spi = ev / pv;
        healthIndicators.push({
          metric: 'SPI (Schedule Performance)',
          value: spi,
          status: spi > 1 ? 'good' : spi === 1 ? 'neutral' : 'poor',
          label: spi > 1 ? 'Ahead of Schedule' : spi === 1 ? 'On Track' : 'Behind Schedule',
        });
      }
    }

    // ========================
    // D. ROOT CAUSE HIGHLIGHT
    // ========================
    if (childRecords.length > 0) {
      const childLevel: HierarchyLevel = level === 'project' ? 'wbs' : level === 'wbs' ? 'activity' : level === 'activity' ? 'task' : 'resource';

      if (lowerLabel.includes('delay') || lowerLabel.includes('schedule') || lowerLabel.includes('progress') || lowerLabel.includes('spi')) {
        // Find children causing delays
        if (childLevel === 'task' || level === 'activity') {
          childRecords.forEach(child => {
            const cd = child.submission_data || {};
            const pe = asText(cd[FIELDS.taskPlannedEnd]);
            const ae = asText(cd[FIELDS.taskActualEnd]);
            if (pe && ae) {
              const delay = Math.max(0, Math.round((new Date(ae).getTime() - new Date(pe).getTime()) / 86400000));
              if (delay > 0) {
                rootCauses.push({
                  child: getChildName(child, childLevel),
                  reason: `Delayed by ${delay} days (Planned: ${pe}, Actual: ${ae})`,
                  severity: delay > 10 ? 'high' : delay > 5 ? 'medium' : 'low',
                });
              }
            }
          });
        }

        // For WBS/Activity level, find children with most delayed tasks
        if (childLevel === 'wbs' || childLevel === 'activity') {
          childRecords.forEach(child => {
            const cd = child.submission_data || {};
            const status = asText(cd[childLevel === 'wbs' ? FIELDS.wbsStatus : FIELDS.activityStatus]).toLowerCase();
            if (status.includes('delay') || status.includes('overdue') || status.includes('behind')) {
              rootCauses.push({
                child: getChildName(child, childLevel),
                reason: `Status is "${asText(cd[childLevel === 'wbs' ? FIELDS.wbsStatus : FIELDS.activityStatus])}" — contributing to schedule deviation`,
                severity: 'high',
              });
            }
          });
        }
      }

      if (lowerLabel.includes('cost') || lowerLabel.includes('budget') || lowerLabel.includes('cpi') || lowerLabel.includes('overrun')) {
        // For project level, find WBS with high cost
        if (level === 'project') {
          const budget = asNum(d[FIELDS.plannedBudget]);
          const actual = asNum(d[FIELDS.actualCost]);
          if (actual > budget && budget > 0) {
            rootCauses.push({
              child: 'Project Overall',
              reason: `Actual cost ₹${actual.toLocaleString('en-IN')} exceeds budget ₹${budget.toLocaleString('en-IN')} by ₹${(actual - budget).toLocaleString('en-IN')}`,
              severity: (actual - budget) / budget > 0.15 ? 'high' : 'medium',
            });
          }
        }
      }

      if (lowerLabel.includes('hour') || lowerLabel.includes('utilization') || lowerLabel.includes('overtime')) {
        // Find resources/tasks with highest overtime
        if (childLevel === 'resource') {
          childRecords.forEach(child => {
            const cd = child.submission_data || {};
            const planned = asNum(cd[FIELDS.plannedHours]);
            const actual = asNum(cd[FIELDS.actualHours]);
            const overtime = Math.max(0, actual - planned);
            if (overtime > 0 && planned > 0) {
              rootCauses.push({
                child: getChildName(child, 'resource'),
                reason: `${overtime}h overtime (${actual}h actual vs ${planned}h planned — ${((actual / planned - 1) * 100).toFixed(0)}% over)`,
                severity: overtime > planned * 0.3 ? 'high' : overtime > planned * 0.1 ? 'medium' : 'low',
              });
            }
          });
        }
        if (childLevel === 'task') {
          childRecords.forEach(child => {
            const cd = child.submission_data || {};
            const planned = asNum(cd[FIELDS.taskPlannedHours]);
            const actual = asNum(cd[FIELDS.taskActualHours]);
            const overtime = Math.max(0, actual - planned);
            if (overtime > 0 && planned > 0) {
              rootCauses.push({
                child: getChildName(child, 'task'),
                reason: `${overtime}h overtime (${actual}h actual vs ${planned}h planned)`,
                severity: overtime > planned * 0.3 ? 'high' : 'medium',
              });
            }
          });
        }
      }

      // Sort root causes by severity
      rootCauses.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.severity] - order[b.severity];
      });
    }

    // ========================
    // E. FINAL SUMMARY
    // ========================
    const summaryParts: string[] = [];

    if (consistencyChecks.length > 0) {
      const allMatch = consistencyChecks.every(c => c.match);
      summaryParts.push(allMatch
        ? 'This KPI is correctly calculated using linked records.'
        : 'A mismatch was detected in the roll-up calculation — please verify child record data.');
    } else {
      summaryParts.push('This KPI value is derived from the linked hierarchy records.');
    }

    if (comparisons.length > 0) {
      const hasOverBudget = comparisons.some(c => c.text.includes('Over Budget') || c.text.includes('Cost Overrun'));
      const hasBehindSchedule = comparisons.some(c => c.text.includes('Behind Schedule') || c.text.includes('Delayed'));
      if (hasOverBudget && hasBehindSchedule) summaryParts.push('The project is currently over budget and behind schedule.');
      else if (hasOverBudget) summaryParts.push('The project is currently over budget but on schedule.');
      else if (hasBehindSchedule) summaryParts.push('The project is within budget but behind schedule.');
      else summaryParts.push('The project is performing well — within budget and on schedule.');
    }

    if (rootCauses.length > 0) {
      const highCount = rootCauses.filter(r => r.severity === 'high').length;
      if (highCount > 0) summaryParts.push(`${highCount} critical contributor(s) identified that require attention.`);
    }

    summary = summaryParts.join(' ');

    return { consistencyChecks, comparisons, comparisonDetails, healthIndicators, rootCauses: rootCauses.slice(0, 5), summary };
  }, [kpiLabel, breakdown, level, record, childRecords, allTasks, allActivities, allResources]);

  const hasContent = analysis.consistencyChecks.length > 0 || analysis.comparisons.length > 0 ||
    analysis.healthIndicators.length > 0 || analysis.rootCauses.length > 0;

  if (!hasContent && !analysis.summary) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm animate-in slide-in-from-top-2 duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Validation & Insight — {kpiLabel}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* A. Data Consistency Check */}
        {analysis.consistencyChecks.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileSearch className="h-3 w-3" /> Data Consistency Check
            </p>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Check</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Child Values</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8 text-right">Sum</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8 text-right">Displayed</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.consistencyChecks.map((check, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-2 text-sm font-medium">{check.label}</TableCell>
                      <TableCell className="py-2">
                        <code className="text-[11px] font-mono text-muted-foreground">{check.childValues}</code>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Badge variant="secondary" className="font-mono text-xs">{check.sum}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Badge variant="secondary" className="font-mono text-xs">{check.displayed}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {check.match ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Correct
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <XCircle className="h-3 w-3" /> Mismatch
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* B. Performance Comparison */}
        {analysis.comparisons.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" /> Performance Comparison
            </p>
            <div className="space-y-1.5">
              {analysis.comparisons.map((comp, i) => (
                <div key={i} className={cn(
                  'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                  comp.icon === 'check' ? 'bg-emerald-500/5 border-emerald-500/20' :
                  comp.icon === 'warn' ? 'bg-warning/5 border-warning/20' :
                  'bg-destructive/5 border-destructive/20'
                )}>
                  {comp.icon === 'check' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> :
                   comp.icon === 'warn' ? <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" /> :
                   <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                  <span className="text-foreground text-xs">{comp.text}</span>
                </div>
              ))}
            </div>

            {/* Field-level details from linked records */}
            {analysis.comparisonDetails.length > 0 && (
              <div className="mt-3 space-y-2">
                {analysis.comparisonDetails.map((detail, i) => (
                  <div key={i} className="rounded-md border overflow-hidden">
                    <div className="bg-muted/40 px-3 py-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{detail.label}</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-[10px] uppercase tracking-wider h-7">Field</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider h-7">Source</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider h-7 text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.fields.map((field, fi) => (
                          <TableRow key={fi} className={field.source === 'Calculated' ? 'bg-primary/5 font-medium' : ''}>
                            <TableCell className="py-1.5 text-xs">{field.name}</TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className="text-[9px] font-normal">{field.source}</Badge>
                            </TableCell>
                            <TableCell className="py-1.5 text-right">
                              <code className="text-xs font-mono">{field.value}</code>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* C. KPI Health Indicator */}
        {analysis.healthIndicators.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" /> KPI Health Indicator
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analysis.healthIndicators.map((hi, i) => (
                <div key={i} className={cn(
                  'rounded-md border px-3 py-2.5',
                  hi.status === 'good' ? 'bg-emerald-500/5 border-emerald-500/20' :
                  hi.status === 'neutral' ? 'bg-muted border-border' :
                  'bg-destructive/5 border-destructive/20'
                )}>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{hi.metric}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-bold font-mono text-foreground">{hi.value.toFixed(2)}</span>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      hi.status === 'good' ? 'text-emerald-600 border-emerald-500/30' :
                      hi.status === 'neutral' ? 'text-muted-foreground' :
                      'text-destructive border-destructive/30'
                    )}>
                      {hi.status === 'good' ? <TrendingUp className="h-3 w-3 mr-0.5" /> : hi.status === 'poor' ? <TrendingDown className="h-3 w-3 mr-0.5" /> : null}
                      {hi.label}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* D. Root Cause Highlight */}
        {analysis.rootCauses.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Root Cause Highlight
            </p>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Severity</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Record</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider h-8">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.rootCauses.map((rc, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={cn(
                          'text-[10px]',
                          rc.severity === 'high' ? 'text-destructive border-destructive/30 bg-destructive/5' :
                          rc.severity === 'medium' ? 'text-warning border-warning/30 bg-warning/5' :
                          'text-muted-foreground'
                        )}>
                          {rc.severity.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-sm font-medium text-foreground">{rc.child}</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">{rc.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* E. Final Summary */}
        {analysis.summary && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
            <div className="flex items-start gap-2">
              <MessageSquareText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">Summary</p>
                <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
