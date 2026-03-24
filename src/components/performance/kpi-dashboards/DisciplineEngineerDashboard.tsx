import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchyEngineerKPIs } from '@/hooks/useHierarchyKPI';
import { CheckCircle2, Clock, Gauge, Zap, ListChecks, Activity, Star } from 'lucide-react';

interface Props {
  kpis: HierarchyEngineerKPIs;
  hasHierarchy?: boolean;
}

export function DisciplineEngineerDashboard({ kpis, hasHierarchy }: Props) {
  return (
    <div className="space-y-6">
      {/* Task Status */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Task Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Assigned Tasks" value={kpis.assignedTasks} icon={ListChecks}
            subtitle="Non-completed tasks" />
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
            subtitle="Sum of delays across tasks"
            variant={kpis.taskDelayDays > 0 ? 'danger' : 'success'} icon={Clock} />
        </div>
      </div>

      {/* Productivity & Utilization */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Productivity & Utilization</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Resource Utilization (%)" value={`${kpis.resourceUtilization.toFixed(1)}%`}
            subtitle="Actual / (Planned + 0.0001) Hours"
            variant={kpis.resourceUtilization > 110 ? 'danger' : kpis.resourceUtilization >= 80 ? 'success' : 'warning'} icon={Gauge} />
          <KPIMetricCard title="Productivity Score" value={kpis.productivityScore.toFixed(2)}
            subtitle="Actual Hours / Planned Hours"
            variant={kpis.productivityScore >= 1 ? 'success' : 'warning'} icon={Zap} />
          <KPIMetricCard title="Overtime Hours" value={`${kpis.overtimeHours.toFixed(0)} hrs`}
            subtitle="From Resource Assignments"
            variant={kpis.overtimeHours > 0 ? 'warning' : 'success'} icon={Clock} />
          <KPIMetricCard title="Quality Score" value={kpis.qualityScore.toFixed(1)}
            subtitle="(1 - Defects/(Tasks+Defects)) × 100"
            variant={kpis.qualityScore >= 80 ? 'success' : kpis.qualityScore >= 60 ? 'warning' : 'danger'} icon={Star} />
        </div>
      </div>

      {/* No hierarchy warning */}
      {!hasHierarchy && (
        <Card className="border-dashed border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">
              ⚠️ All metrics require a specific project selection to load linked Tasks and Resource Assignments.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
