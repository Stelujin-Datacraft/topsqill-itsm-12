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
          <KPIMetricCard title="Planned Budget" value={`₹${kpis.plannedBudget.toLocaleString('en-IN')}`} icon={IndianRupee}
            formula="SUM(Planned_Budget)" />
          <KPIMetricCard title="Actual Cost" value={`₹${kpis.actualCost.toLocaleString('en-IN')}`} icon={IndianRupee}
            formula="SUM(Actual_Cost)" />
          <KPIMetricCard title="Budget Utilization (%)" value={`${kpis.budgetUtilization.toFixed(1)}%`}
            variant={kpis.budgetUtilization > 100 ? 'danger' : kpis.budgetUtilization > 90 ? 'warning' : 'success'}
            icon={BarChart3}
            formula="(Actual_Cost / Planned_Budget) × 100" />
        </div>
      </div>

      {/* Variance & Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Variance & Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Cost Variance" value={`₹${kpis.costVariance.toLocaleString('en-IN')}`}
            subtitle={kpis.costVariance >= 0 ? 'Under budget' : 'Over budget'}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'}
            icon={kpis.costVariance >= 0 ? TrendingUp : TrendingDown}
            formula="EV - AC" />
          <KPIMetricCard title="Cost Per Task" value={`₹${kpis.costPerTask.toLocaleString('en-IN')}`}
            subtitle="Actual Cost / MAX(1, Task Count)" icon={Calculator}
            formula="SUM(Actual_Cost) / MAX(1, COUNT(Task_ID))" />
          <KPIMetricCard title="CPI" value={kpis.cpi.toFixed(3)}
            subtitle={kpis.cpi >= 1 ? 'Cost efficient' : 'Cost overrun'}
            variant={kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger'}
            icon={Target}
            formula="Earned_Value / Actual_Cost_Value" />
        </div>
      </div>

      {/* Forecasting */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Forecasting</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="EAC" value={`₹${kpis.eac.toLocaleString('en-IN')}`}
            subtitle="Estimate At Completion" icon={Calculator}
            formula="Planned_Budget / CPI" />
          <KPIMetricCard title="ETC" value={`₹${kpis.etc.toLocaleString('en-IN')}`}
            subtitle="Estimate To Complete" icon={Calculator}
            formula="EAC - Actual_Cost" />
          <KPIMetricCard title="VAC" value={`₹${kpis.vac.toLocaleString('en-IN')}`}
            subtitle={kpis.vac >= 0 ? 'Under budget forecast' : 'Over budget forecast'}
            variant={kpis.vac >= 0 ? 'success' : 'danger'}
            formula="Planned_Budget - EAC" />
          <KPIMetricCard title="Predicted Cost Overrun (%)" value={`${kpis.predictedCostOverrunPercent.toFixed(1)}%`}
            subtitle="((Forecasted - Planned) / Planned) × 100"
            variant={kpis.predictedCostOverrunPercent > 10 ? 'danger' : 'default'}
            icon={kpis.predictedCostOverrunPercent > 0 ? TrendingDown : TrendingUp}
            formula="((Forecast - Budget) / Budget) × 100" />
        </div>
      </div>
    </div>
  );
}
