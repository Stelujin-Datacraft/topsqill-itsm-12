import React from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { FinanceKPIs } from '@/hooks/usePerformanceKPI';
import { DollarSign, TrendingUp, TrendingDown, Calculator, Flame, BarChart3, Target } from 'lucide-react';

interface Props {
  kpis: FinanceKPIs;
}

export function FinanceDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Budget Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Planned Budget (BAC)" value={kpis.plannedBudget} icon={DollarSign} />
          <KPIMetricCard title="Actual Cost" value={kpis.actualCost} icon={DollarSign} />
          <KPIMetricCard title="Budget Utilization" value={`${kpis.budgetUtilization.toFixed(1)}%`}
            variant={kpis.budgetUtilization > 100 ? 'danger' : kpis.budgetUtilization > 90 ? 'warning' : 'success'}
            icon={BarChart3} />
        </div>
      </div>

      {/* Variance & Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Variance & Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Cost Variance" value={kpis.costVariance}
            subtitle={kpis.costVariance >= 0 ? 'Under budget' : 'Over budget'}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'}
            icon={kpis.costVariance >= 0 ? TrendingUp : TrendingDown} />
          <KPIMetricCard title="CV %" value={`${kpis.costVariancePercent.toFixed(1)}%`}
            variant={kpis.costVariancePercent >= 0 ? 'success' : 'danger'} />
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
          <KPIMetricCard title="EAC" value={kpis.eac}
            subtitle="Estimate At Completion" icon={Calculator} />
          <KPIMetricCard title="ETC" value={kpis.etc}
            subtitle="Estimate To Complete" icon={Calculator} />
          <KPIMetricCard title="VAC" value={kpis.vac}
            subtitle={kpis.vac >= 0 ? 'Under budget forecast' : 'Over budget forecast'}
            variant={kpis.vac >= 0 ? 'success' : 'danger'} />
          <KPIMetricCard title="Forecast Overrun" value={kpis.forecastCostOverrun}
            variant={kpis.forecastCostOverrun > 0 ? 'danger' : 'success'}
            icon={kpis.forecastCostOverrun > 0 ? TrendingDown : TrendingUp} />
        </div>
      </div>

      {/* Burn Rate */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Expenditure Rate</h3>
        <div className="grid grid-cols-2 gap-3">
          <KPIMetricCard title="Cost Burn Rate" value={`${kpis.burnRate.toFixed(0)}/day`}
            subtitle="Average daily expenditure" icon={Flame} />
        </div>
      </div>
    </div>
  );
}
