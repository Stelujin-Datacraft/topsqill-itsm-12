import React, { useMemo } from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchyRiskKPIs } from '@/hooks/useHierarchyKPI';
import { HierarchySeniorKPIs } from '@/hooks/useHierarchyKPI';
import { ShieldAlert, AlertTriangle, Clock, Briefcase } from 'lucide-react';
import { type FormulaBreakdown } from './FormulaBreakdownDialog';

interface Props {
  kpis: HierarchyRiskKPIs;
  projectList?: HierarchySeniorKPIs['projectList'];
}

export function RiskGovernanceDashboard({ kpis, projectList = [] }: Props) {
  const totalBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'COUNT(Project_ID)',
    variables: [{ label: 'Total Projects', value: kpis.totalProjects, highlight: true }],
    result: kpis.totalProjects,
    contributingRecords: projectList.length > 0 ? {
      title: 'All Projects', valueLabel: 'SPI',
      records: projectList.map(p => ({
        refId: p.refId, name: p.name, status: p.status,
        value: `SPI: ${p.spi.toFixed(2)} | CPI: ${p.cpi.toFixed(2)}`,
        variant: (p.spi >= 1 && p.cpi >= 1 ? 'success' : 'danger') as 'success' | 'danger',
      }))
    } : undefined,
  }), [kpis, projectList]);

  const delayedBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'COUNT_IF(Actual_End > Planned_End)',
    variables: [
      { label: 'Total Projects', value: kpis.totalProjects },
      { label: 'Delayed', value: kpis.delayedProjects, highlight: true },
    ],
    result: kpis.delayedProjects,
    contributingRecords: projectList.length > 0 ? {
      title: 'Project Delay Status', valueLabel: 'SPI',
      records: projectList.filter(p => p.spi < 1).map(p => ({
        refId: p.refId, name: p.name, status: '🔴 Delayed',
        value: `SPI: ${p.spi.toFixed(2)}`, variant: 'danger' as const,
        detail: `CPI: ${p.cpi.toFixed(2)}`
      }))
    } : undefined,
  }), [kpis, projectList]);

  const riskBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'COUNT_IF(Predicted_Delay > 0)',
    variables: [
      { label: 'Total Projects', value: kpis.totalProjects },
      { label: 'At Risk', value: kpis.predictedRiskProjects, highlight: true },
    ],
    result: kpis.predictedRiskProjects,
  }), [kpis]);

  const avgDelayBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'AVG(Predicted_Delay_Days)',
    variables: [{ label: 'Avg Predicted Delay', value: `${kpis.averagePredictedDelay.toFixed(1)} days`, highlight: true }],
    result: `${kpis.averagePredictedDelay.toFixed(1)} days`,
  }), [kpis]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Project Risk Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Total Projects" value={kpis.totalProjects} icon={Briefcase}
            formula="COUNT(Project_ID)" formulaBreakdown={totalBreakdown} />
          <KPIMetricCard title="Delayed Projects" value={kpis.delayedProjects}
            variant={kpis.delayedProjects > 0 ? 'danger' : 'success'} icon={AlertTriangle}
            formula="COUNT_IF(Actual_End > Planned_End)" formulaBreakdown={delayedBreakdown} />
          <KPIMetricCard title="Predicted Risk Projects" value={kpis.predictedRiskProjects}
            subtitle="Projects with Predicted_Delay > 0"
            variant={kpis.predictedRiskProjects > 0 ? 'warning' : 'success'} icon={ShieldAlert}
            formula="COUNT_IF(Predicted_Delay > 0)" formulaBreakdown={riskBreakdown} />
          <KPIMetricCard title="Avg Predicted Delay" value={`${kpis.averagePredictedDelay.toFixed(1)} days`}
            variant={kpis.averagePredictedDelay > 5 ? 'warning' : 'default'} icon={Clock}
            formula="AVG(Predicted_Delay_Days)" formulaBreakdown={avgDelayBreakdown} />
        </div>
      </div>

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
