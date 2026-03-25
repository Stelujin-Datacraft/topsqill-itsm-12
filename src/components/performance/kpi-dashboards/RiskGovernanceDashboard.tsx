import React from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchyRiskKPIs } from '@/hooks/useHierarchyKPI';
import { ShieldAlert, AlertTriangle, Clock, Briefcase } from 'lucide-react';

interface Props {
  kpis: HierarchyRiskKPIs;
}

export function RiskGovernanceDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Project Risk Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Project Risk Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Total Projects" value={kpis.totalProjects} icon={Briefcase}
            formula="COUNT(Project_ID)" />
          <KPIMetricCard title="Delayed Projects" value={kpis.delayedProjects}
            variant={kpis.delayedProjects > 0 ? 'danger' : 'success'} icon={AlertTriangle}
            formula="COUNT_IF(Actual_End > Planned_End)" />
          <KPIMetricCard title="Predicted Risk Projects" value={kpis.predictedRiskProjects}
            subtitle="Projects with Predicted_Delay > 0"
            variant={kpis.predictedRiskProjects > 0 ? 'warning' : 'success'} icon={ShieldAlert}
            formula="COUNT_IF(Predicted_Delay > 0)" />
          <KPIMetricCard title="Avg Predicted Delay" value={`${kpis.averagePredictedDelay.toFixed(1)} days`}
            variant={kpis.averagePredictedDelay > 5 ? 'warning' : 'default'} icon={Clock}
            formula="AVG(Predicted_Delay_Days)" />
        </div>
      </div>

      {/* Note about limited metrics */}
      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
        <p className="font-medium mb-1">ℹ️ Limited Risk Metrics</p>
        <p>
          Since no dedicated risk or issue forms exist, only project-level delay and prediction metrics are available.
          To enable full risk/governance monitoring (risk scores, compliance status, audit findings), create dedicated Risk and Issue forms linked to the project hierarchy.
        </p>
      </div>
    </div>
  );
}
