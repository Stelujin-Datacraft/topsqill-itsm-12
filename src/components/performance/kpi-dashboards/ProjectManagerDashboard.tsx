import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchyPMKPIs } from '@/hooks/useHierarchyKPI';
import { Clock, AlertTriangle, IndianRupee, Target, Flame, TrendingUp, Calendar, ListChecks } from 'lucide-react';

interface Props {
  kpis: HierarchyPMKPIs;
  hasHierarchy?: boolean;
}

export function ProjectManagerDashboard({ kpis, hasHierarchy }: Props) {
  return (
    <div className="space-y-6">
      {/* Progress & Tasks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Progress & Tasks</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Project Progress (%)" value={`${kpis.projectProgress.toFixed(1)}%`} icon={Target}
            subtitle={`${kpis.totalTasks} total tasks`}
            variant={kpis.projectProgress >= 80 ? 'success' : kpis.projectProgress >= 50 ? 'warning' : 'danger'}
            formula="(Completed_Tasks / Total_Tasks) × 100"
            formulaBreakdown={{
              formula: '(Completed_Tasks / Total_Tasks) × 100',
              variables: [
                { label: 'Total Tasks', fieldName: 'COUNT(Task_ID)', value: kpis.totalTasks },
                { label: 'Delayed Tasks', fieldName: 'COUNT_IF(Actual_End > Planned_End)', value: kpis.delayedTasks },
                { label: 'Progress', value: `${kpis.projectProgress.toFixed(1)}%`, highlight: true },
              ],
              result: `${kpis.projectProgress.toFixed(1)}%`,
            }}
          />
          <KPIMetricCard title="Delayed Tasks" value={kpis.delayedTasks} icon={Clock}
            subtitle={`of ${kpis.totalTasks} tasks`}
            variant={kpis.delayedTasks > 0 ? 'danger' : 'default'}
            formula="COUNT_IF(Actual_End > Planned_End)" />
          <KPIMetricCard title="Schedule Variance (%)" value={`${kpis.scheduleVariancePercent.toFixed(1)}%`}
            subtitle={kpis.scheduleVariancePercent >= 0 ? 'Ahead of schedule' : 'Behind schedule'}
            variant={kpis.scheduleVariancePercent >= 0 ? 'success' : 'danger'} icon={Calendar}
            formula="((EV - PV) / PV) × 100"
            formulaBreakdown={{
              formula: '((Earned_Value - Planned_Value) / Planned_Value) × 100',
              description: 'Positive = ahead of schedule, Negative = behind schedule',
              variables: [
                { label: 'Schedule Variance %', value: `${kpis.scheduleVariancePercent.toFixed(1)}%`, highlight: true },
              ],
              result: `${kpis.scheduleVariancePercent.toFixed(1)}%`,
            }}
          />
          <KPIMetricCard title="Total Tasks" value={kpis.totalTasks} icon={ListChecks}
            subtitle={hasHierarchy ? 'From linked hierarchy' : 'No hierarchy loaded'}
            formula="COUNT(Task_ID)" />
        </div>
      </div>

      {/* Cost Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cost Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Cost Variance" value={`₹${kpis.costVariance.toLocaleString('en-IN')}`}
            subtitle={kpis.costVariance >= 0 ? 'Under budget' : 'Over budget'}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'} icon={IndianRupee}
            formula="EV - AC"
            formulaBreakdown={{
              formula: 'Earned_Value - Actual_Cost_Value',
              variables: [
                { label: 'Cost Variance', value: `₹${kpis.costVariance.toLocaleString('en-IN')}`, highlight: true },
                { label: 'Cost Variance %', value: `${kpis.costVariancePercent.toFixed(1)}%` },
              ],
              result: `₹${kpis.costVariance.toLocaleString('en-IN')}`,
            }}
          />
          <KPIMetricCard title="Cost Variance (%)" value={`${kpis.costVariancePercent.toFixed(1)}%`}
            variant={kpis.costVariancePercent >= 0 ? 'success' : 'danger'}
            formula="((EV - AC) / AC) × 100" />
          <KPIMetricCard title="CPI" value={kpis.cpi.toFixed(2)}
            subtitle={kpis.cpi >= 1 ? 'Cost efficient' : 'Cost overrun'}
            variant={kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger'} icon={IndianRupee}
            formula="Earned_Value / Actual_Cost_Value"
            formulaBreakdown={{
              formula: 'Earned_Value / Actual_Cost_Value',
              description: 'Cost Performance Index — values ≥ 1.0 indicate cost efficiency',
              variables: [
                { label: 'CPI', value: kpis.cpi.toFixed(2), highlight: true },
              ],
              result: kpis.cpi.toFixed(2),
            }}
          />
          <KPIMetricCard title="SPI" value={kpis.spi.toFixed(2)}
            subtitle={kpis.spi >= 1 ? 'Ahead of schedule' : 'Behind schedule'}
            variant={kpis.spi >= 1 ? 'success' : kpis.spi >= 0.9 ? 'warning' : 'danger'} icon={TrendingUp}
            formula="Earned_Value / Planned_Value"
            formulaBreakdown={{
              formula: 'Earned_Value / Planned_Value',
              description: 'Schedule Performance Index — values ≥ 1.0 indicate ahead of schedule',
              variables: [
                { label: 'SPI', value: kpis.spi.toFixed(2), highlight: true },
              ],
              result: kpis.spi.toFixed(2),
            }}
          />
        </div>
      </div>

      {/* Expenditure & Predictions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Expenditure & Predictions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Burn Rate" value={`${kpis.burnRate.toFixed(0)}/day`} icon={Flame}
            subtitle="Actual Cost / Days Since Actual Start"
            formula="Actual_Cost / DAYS_BETWEEN(Current_Date, Actual_Start_Date)"
            formulaBreakdown={{
              formula: 'Actual_Cost / DAYS_BETWEEN(Current_Date, Actual_Start_Date)',
              description: 'Daily spend rate based on elapsed project time from actual start',
              variables: [
                { label: 'Burn Rate', value: `₹${kpis.burnRate.toFixed(0)}/day`, highlight: true },
              ],
              result: `₹${kpis.burnRate.toFixed(0)}/day`,
            }}
          />
          <KPIMetricCard title="Predicted Delay Days" value={`${kpis.predictedDelayDays.toFixed(1)} days`}
            variant={kpis.predictedDelayDays > 5 ? 'warning' : 'default'}
            formula="MAX(0, DAYS(Actual_End - Planned_End))" />
          <KPIMetricCard title="Predicted Cost Overrun (%)" value={`${kpis.predictedCostOverrunPercent.toFixed(1)}%`}
            variant={kpis.predictedCostOverrunPercent > 10 ? 'danger' : 'default'} icon={AlertTriangle}
            formula="((Forecast - Budget) / Budget) × 100"
            formulaBreakdown={{
              formula: '((Forecast - Budget) / Budget) × 100',
              variables: [
                { label: 'Predicted Overrun', value: `${kpis.predictedCostOverrunPercent.toFixed(1)}%`, highlight: true },
              ],
              result: `${kpis.predictedCostOverrunPercent.toFixed(1)}%`,
            }}
          />
        </div>
      </div>

      {/* No hierarchy warning */}
      {!hasHierarchy && (
        <Card className="border-dashed border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">
              ⚠️ Task-based metrics (Progress, Delayed Tasks) require a specific project selection to load linked data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
