import React from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchyFinanceKPIs } from '@/hooks/useHierarchyKPI';
import { IndianRupee, TrendingUp, TrendingDown, Calculator, Target, BarChart3 } from 'lucide-react';

interface Props {
  kpis: HierarchyFinanceKPIs;
}

export function FinanceDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Budget Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Planned Budget" value={`₹${kpis.plannedBudget.toLocaleString('en-IN')}`} icon={IndianRupee} />
          <KPIMetricCard title="Actual Cost" value={`₹${kpis.actualCost.toLocaleString('en-IN')}`} icon={IndianRupee} />
          <KPIMetricCard title="Budget Utilization (%)" value={`${kpis.budgetUtilization.toFixed(1)}%`}
            variant={kpis.budgetUtilization > 100 ? 'danger' : kpis.budgetUtilization > 90 ? 'warning' : 'success'}
            icon={BarChart3} />
        </div>
      </div>

      {/* Variance & Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Variance & Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Cost Variance" value={kpis.costVariance.toLocaleString()}
            subtitle={kpis.costVariance >= 0 ? 'Under budget' : 'Over budget'}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'}
            icon={kpis.costVariance >= 0 ? TrendingUp : TrendingDown} />
          <KPIMetricCard title="Cost Per Task" value={kpis.costPerTask.toLocaleString()}
            subtitle="Actual Cost / Task Count" icon={Calculator} />
          <KPIMetricCard title="CPI" value={kpis.cpi.toFixed(3)}
            subtitle={kpis.cpi >= 1 ? 'Cost efficient' : 'Cost overrun'}
            variant={kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger'}
            icon={Target} />
        </div>
      </div>

      {/* Forecasting */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Forecasting</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="EAC" value={kpis.eac.toLocaleString()}
            subtitle="Estimate At Completion" icon={Calculator} />
          <KPIMetricCard title="ETC" value={kpis.etc.toLocaleString()}
            subtitle="Estimate To Complete" icon={Calculator} />
          <KPIMetricCard title="VAC" value={kpis.vac.toLocaleString()}
            subtitle={kpis.vac >= 0 ? 'Under budget forecast' : 'Over budget forecast'}
            variant={kpis.vac >= 0 ? 'success' : 'danger'} />
          <KPIMetricCard title="Predicted Cost Overrun (%)" value={`${kpis.predictedCostOverrunPercent.toFixed(1)}%`}
            subtitle="((Forecasted - Planned) / Planned) × 100"
            variant={kpis.predictedCostOverrunPercent > 10 ? 'danger' : 'default'}
            icon={kpis.predictedCostOverrunPercent > 0 ? TrendingDown : TrendingUp} />
        </div>
      </div>
    </div>
  );
}
