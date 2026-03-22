import React from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { ProjectManagerKPIs } from '@/hooks/usePerformanceKPI';
import { Clock, AlertTriangle, DollarSign, Target, Flame, TrendingUp, Calendar } from 'lucide-react';

interface Props {
  kpis: ProjectManagerKPIs;
}

export function ProjectManagerDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Progress & Tasks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Progress & Tasks</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Project Progress (%)" value={`${kpis.projectProgress.toFixed(1)}%`} icon={Target}
            variant={kpis.projectProgress >= 80 ? 'success' : kpis.projectProgress >= 50 ? 'warning' : 'danger'} />
          <KPIMetricCard title="Delayed Tasks" value={kpis.delayedTasks} icon={Clock}
            variant={kpis.delayedTasks > 0 ? 'danger' : 'default'} />
          <KPIMetricCard title="Schedule Variance (%)" value={`${kpis.scheduleVariancePercent.toFixed(1)}%`}
            subtitle={kpis.scheduleVariancePercent <= 0 ? 'On/Ahead of schedule' : 'Behind schedule'}
            variant={kpis.scheduleVariancePercent <= 0 ? 'success' : 'danger'} icon={Calendar} />
        </div>
      </div>

      {/* Cost Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cost Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Cost Variance" value={kpis.costVariance}
            subtitle={kpis.costVariance >= 0 ? 'Under budget' : 'Over budget'}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'} icon={DollarSign} />
          <KPIMetricCard title="Cost Variance (%)" value={`${kpis.costVariancePercent.toFixed(1)}%`}
            variant={kpis.costVariancePercent >= 0 ? 'success' : 'danger'} />
          <KPIMetricCard title="CPI" value={kpis.cpi.toFixed(2)}
            subtitle={kpis.cpi >= 1 ? 'Cost efficient' : 'Cost overrun'}
            variant={kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger'} icon={DollarSign} />
          <KPIMetricCard title="SPI" value={kpis.spi.toFixed(2)}
            subtitle={kpis.spi >= 1 ? 'Ahead of schedule' : 'Behind schedule'}
            variant={kpis.spi >= 1 ? 'success' : kpis.spi >= 0.9 ? 'warning' : 'danger'} icon={TrendingUp} />
        </div>
      </div>

      {/* Milestones & Burn Rate */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Milestones & Expenditure</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Burn Rate" value={`${kpis.burnRate.toFixed(0)}/day`} icon={Flame} />
          <KPIMetricCard title="Milestone Delay Days" value={`${kpis.milestoneDelayDays.toFixed(0)} days`}
            variant={kpis.milestoneDelayDays > 0 ? 'danger' : 'success'} />
          <KPIMetricCard title="Predicted Delay Days" value={`${kpis.predictedDelayDays.toFixed(1)} days`}
            variant={kpis.predictedDelayDays > 5 ? 'warning' : 'default'} />
        </div>
      </div>

      {/* Predictions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Predictions</h3>
        <div className="grid grid-cols-2 gap-3">
          <KPIMetricCard title="Predicted Cost Overrun (%)" value={`${kpis.predictedCostOverrunPercent.toFixed(1)}%`}
            variant={kpis.predictedCostOverrunPercent > 10 ? 'danger' : 'default'} icon={AlertTriangle} />
        </div>
      </div>
    </div>
  );
}
