import React from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { ProjectManagerKPIs } from '@/hooks/usePerformanceKPI';
import { CheckCircle2, Clock, AlertTriangle, DollarSign, Target, Flame, ListChecks, TrendingUp, Calendar, Bug } from 'lucide-react';

interface Props {
  kpis: ProjectManagerKPIs;
}

export function ProjectManagerDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Task Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Task Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Project Progress" value={`${kpis.projectProgress.toFixed(1)}%`} icon={Target}
            variant={kpis.projectProgress >= 80 ? 'success' : kpis.projectProgress >= 50 ? 'warning' : 'danger'} />
          <KPIMetricCard title="Total Tasks" value={kpis.totalTasks} icon={ListChecks} />
          <KPIMetricCard title="Completed Tasks" value={kpis.completedTasks} icon={CheckCircle2} variant="success" />
          <KPIMetricCard title="Delayed Tasks" value={kpis.delayedTasks} icon={Clock}
            variant={kpis.delayedTasks > 0 ? 'danger' : 'default'} />
        </div>
      </div>

      {/* Schedule Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Schedule Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Schedule Variance" value={kpis.scheduleVariance}
            subtitle={kpis.scheduleVariance >= 0 ? 'Ahead/On schedule' : 'Behind schedule'}
            variant={kpis.scheduleVariance >= 0 ? 'success' : 'danger'} icon={Calendar} />
          <KPIMetricCard title="SPI" value={kpis.spi.toFixed(2)}
            variant={kpis.spi >= 1 ? 'success' : kpis.spi >= 0.9 ? 'warning' : 'danger'} icon={TrendingUp} />
          <KPIMetricCard title="Milestone Completion" value={`${kpis.milestoneCompletionRate.toFixed(1)}%`}
            variant={kpis.milestoneCompletionRate >= 80 ? 'success' : 'warning'} icon={Target} />
          <KPIMetricCard title="Milestone Delay" value={`${kpis.milestoneDelayDays.toFixed(0)} days`}
            variant={kpis.milestoneDelayDays > 0 ? 'danger' : 'success'} />
        </div>
      </div>

      {/* Cost Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cost Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Cost Variance" value={kpis.costVariance}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'} icon={DollarSign} />
          <KPIMetricCard title="CPI" value={kpis.cpi.toFixed(2)}
            variant={kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger'} icon={DollarSign} />
          <KPIMetricCard title="Burn Rate" value={`${kpis.burnRate.toFixed(0)}/day`} icon={Flame} />
          <KPIMetricCard title="Project Duration" value={`${kpis.projectDuration} days`} icon={Clock} />
        </div>
      </div>

      {/* Risk & Issues */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Risk & Issues</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Risk Exposure" value={kpis.riskExposure.toFixed(1)}
            variant={kpis.riskExposure > 70 ? 'danger' : kpis.riskExposure > 40 ? 'warning' : 'success'} icon={AlertTriangle} />
          <KPIMetricCard title="Predicted Delay" value={`${kpis.predictedDelay.toFixed(1)} days`}
            variant={kpis.predictedDelay > 5 ? 'warning' : 'default'} />
          <KPIMetricCard title="Cost Overrun Prediction" value={`${kpis.predictedCostOverrun.toFixed(1)}%`}
            variant={kpis.predictedCostOverrun > 10 ? 'danger' : 'default'} />
          <KPIMetricCard title="Open Issues" value={kpis.openIssues} icon={Bug}
            variant={kpis.openIssues > 0 ? 'warning' : 'success'} />
        </div>
      </div>
    </div>
  );
}
