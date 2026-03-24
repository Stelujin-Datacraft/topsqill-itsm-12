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
            variant={kpis.projectProgress >= 80 ? 'success' : kpis.projectProgress >= 50 ? 'warning' : 'danger'} />
          <KPIMetricCard title="Delayed Tasks" value={kpis.delayedTasks} icon={Clock}
            subtitle={`of ${kpis.totalTasks} tasks`}
            variant={kpis.delayedTasks > 0 ? 'danger' : 'default'} />
          <KPIMetricCard title="Schedule Variance (%)" value={`${kpis.scheduleVariancePercent.toFixed(1)}%`}
            subtitle={kpis.scheduleVariancePercent >= 0 ? 'Ahead of schedule' : 'Behind schedule'}
            variant={kpis.scheduleVariancePercent >= 0 ? 'success' : 'danger'} icon={Calendar} />
          <KPIMetricCard title="Total Tasks" value={kpis.totalTasks} icon={ListChecks}
            subtitle={hasHierarchy ? 'From linked hierarchy' : 'No hierarchy loaded'} />
        </div>
      </div>

      {/* Cost Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cost Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Cost Variance" value={kpis.costVariance.toLocaleString()}
            subtitle={kpis.costVariance >= 0 ? 'Under budget' : 'Over budget'}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'} icon={IndianRupee} />
          <KPIMetricCard title="Cost Variance (%)" value={`${kpis.costVariancePercent.toFixed(1)}%`}
            variant={kpis.costVariancePercent >= 0 ? 'success' : 'danger'} />
          <KPIMetricCard title="CPI" value={kpis.cpi.toFixed(2)}
            subtitle={kpis.cpi >= 1 ? 'Cost efficient' : 'Cost overrun'}
            variant={kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger'} icon={IndianRupee} />
          <KPIMetricCard title="SPI" value={kpis.spi.toFixed(2)}
            subtitle={kpis.spi >= 1 ? 'Ahead of schedule' : 'Behind schedule'}
            variant={kpis.spi >= 1 ? 'success' : kpis.spi >= 0.9 ? 'warning' : 'danger'} icon={TrendingUp} />
        </div>
      </div>

      {/* Expenditure & Predictions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Expenditure & Predictions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Burn Rate" value={`${kpis.burnRate.toFixed(0)}/day`} icon={Flame}
            subtitle="Actual Cost / Project Duration" />
          <KPIMetricCard title="Predicted Delay Days" value={`${kpis.predictedDelayDays.toFixed(1)} days`}
            variant={kpis.predictedDelayDays > 5 ? 'warning' : 'default'} />
          <KPIMetricCard title="Predicted Cost Overrun (%)" value={`${kpis.predictedCostOverrunPercent.toFixed(1)}%`}
            variant={kpis.predictedCostOverrunPercent > 10 ? 'danger' : 'default'} icon={AlertTriangle} />
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
