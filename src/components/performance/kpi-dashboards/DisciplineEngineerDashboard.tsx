import React from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { DisciplineEngineerKPIs } from '@/hooks/usePerformanceKPI';
import { CheckCircle2, Clock, Gauge, Zap, AlertTriangle, ListChecks, Activity, Star } from 'lucide-react';

interface Props {
  kpis: DisciplineEngineerKPIs;
}

export function DisciplineEngineerDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Task Status */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Task Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Assigned Tasks" value={kpis.assignedTasks} icon={ListChecks} />
          <KPIMetricCard title="Completed Tasks" value={kpis.completedTasks} icon={CheckCircle2} variant="success" />
          <KPIMetricCard title="Task Completion Rate (%)" value={`${kpis.taskCompletionRate.toFixed(1)}%`}
            variant={kpis.taskCompletionRate >= 80 ? 'success' : kpis.taskCompletionRate >= 50 ? 'warning' : 'danger'} icon={Activity} />
        </div>
      </div>

      {/* Delay */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delay</h3>
        <div className="grid grid-cols-2 gap-3">
          <KPIMetricCard title="Task Delay Days" value={`${kpis.taskDelayDays} days`}
            variant={kpis.taskDelayDays > 0 ? 'danger' : 'success'} icon={Clock} />
        </div>
      </div>

      {/* Productivity & Utilization */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Productivity & Utilization</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Resource Utilization (%)" value={`${kpis.resourceUtilization.toFixed(1)}%`}
            variant={kpis.resourceUtilization > 110 ? 'danger' : kpis.resourceUtilization >= 80 ? 'success' : 'warning'} icon={Gauge} />
          <KPIMetricCard title="Productivity Score" value={kpis.productivityScore.toFixed(2)}
            subtitle={kpis.productivityScore >= 1 ? 'Efficient' : 'Below target'}
            variant={kpis.productivityScore >= 1 ? 'success' : 'warning'} icon={Zap} />
          <KPIMetricCard title="Overtime Hours" value={`${kpis.overtimeHours.toFixed(0)} hrs`}
            variant={kpis.overtimeHours > 0 ? 'warning' : 'success'} icon={Clock} />
          <KPIMetricCard title="Quality Score" value={kpis.qualityScore.toFixed(1)}
            variant={kpis.qualityScore >= 80 ? 'success' : kpis.qualityScore >= 60 ? 'warning' : 'danger'} icon={Star} />
        </div>
      </div>

      {/* Risk */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Engineering Risks</h3>
        <div className="grid grid-cols-2 gap-3">
          <KPIMetricCard title="Engineering Risk Count" value={kpis.engineeringRiskCount}
            variant={kpis.engineeringRiskCount > 0 ? 'warning' : 'success'} icon={AlertTriangle} />
        </div>
      </div>
    </div>
  );
}
