import React from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { DisciplineEngineerKPIs } from '@/hooks/usePerformanceKPI';
import { CheckCircle2, Clock, Ban, Gauge, Timer, AlertTriangle, Zap, ListChecks, Activity } from 'lucide-react';

interface Props {
  kpis: DisciplineEngineerKPIs;
}

export function DisciplineEngineerDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Task Status */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Task Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Assigned Tasks" value={kpis.assignedTasks} icon={ListChecks} />
          <KPIMetricCard title="Completed" value={kpis.completedTasks} icon={CheckCircle2} variant="success" />
          <KPIMetricCard title="Pending" value={kpis.pendingTasks} icon={Clock} variant={kpis.pendingTasks > 0 ? 'warning' : 'default'} />
          <KPIMetricCard title="Blocked" value={kpis.blockedTasks} icon={Ban} variant={kpis.blockedTasks > 0 ? 'danger' : 'default'} />
        </div>
      </div>

      {/* Completion & Delay */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Completion & Delay</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Task Completion Rate" value={`${kpis.taskCompletionRate.toFixed(1)}%`}
            variant={kpis.taskCompletionRate >= 80 ? 'success' : kpis.taskCompletionRate >= 50 ? 'warning' : 'danger'} icon={Activity} />
          <KPIMetricCard title="Total Delay Days" value={`${kpis.taskDelayDays} days`}
            variant={kpis.taskDelayDays > 0 ? 'danger' : 'success'} icon={Clock} />
          <KPIMetricCard title="Avg Task Delay" value={`${kpis.averageTaskDelay.toFixed(1)} days`}
            variant={kpis.averageTaskDelay > 3 ? 'warning' : 'default'} icon={Timer} />
        </div>
      </div>

      {/* Productivity */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Productivity & Utilization</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Resource Utilization" value={`${kpis.resourceUtilization.toFixed(1)}%`}
            variant={kpis.resourceUtilization > 110 ? 'danger' : kpis.resourceUtilization >= 80 ? 'success' : 'warning'} icon={Gauge} />
          <KPIMetricCard title="Productivity Score" value={kpis.productivityScore.toFixed(2)}
            subtitle={kpis.productivityScore >= 1 ? 'Efficient' : 'Below target'}
            variant={kpis.productivityScore >= 1 ? 'success' : 'warning'} icon={Zap} />
          <KPIMetricCard title="Overtime Hours" value={`${kpis.overtimeHours.toFixed(0)} hrs`}
            variant={kpis.overtimeHours > 0 ? 'warning' : 'success'} icon={Timer} />
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
