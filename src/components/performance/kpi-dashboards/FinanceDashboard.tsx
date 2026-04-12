import React, { useMemo } from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchyFinanceKPIs } from '@/hooks/useHierarchyKPI';
import { IndianRupee, TrendingUp, TrendingDown, Calculator, Target, BarChart3 } from 'lucide-react';
import { type FormulaBreakdown } from './FormulaBreakdownDialog';

interface Props {
  kpis: HierarchyFinanceKPIs;
  projectList?: Array<{ refId: string; name: string; plannedBudget: number; actualCost: number; cpi: number; spi: number; status: string }>;
}

export function FinanceDashboard({ kpis, projectList = [] }: Props) {
  const budgetBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'SUM(Planned_Budget)',
    variables: [{ label: 'Total Planned Budget', fieldName: 'SUM(Planned_Budget)', value: `₹${kpis.plannedBudget.toLocaleString('en-IN')}`, highlight: true }],
    result: `₹${kpis.plannedBudget.toLocaleString('en-IN')}`,
    contributingRecords: projectList.length > 0 ? {
      title: 'Per-Project Budget', valueLabel: 'Planned Budget',
      records: projectList.map(p => ({
        refId: p.refId, name: p.name, status: p.status,
        value: `₹${p.plannedBudget.toLocaleString('en-IN')}`, variant: 'neutral' as const,
      }))
    } : undefined,
  }), [kpis, projectList]);

  const actualCostBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'SUM(Actual_Cost)',
    variables: [
      { label: 'Total Actual Cost', fieldName: 'SUM(Actual_Cost)', value: `₹${kpis.actualCost.toLocaleString('en-IN')}`, highlight: true },
      { label: 'Planned Budget (ref)', value: `₹${kpis.plannedBudget.toLocaleString('en-IN')}` },
    ],
    result: `₹${kpis.actualCost.toLocaleString('en-IN')}`,
    contributingRecords: projectList.length > 0 ? {
      title: 'Per-Project Actual Cost', valueLabel: 'Actual Cost',
      records: projectList.map(p => ({
        refId: p.refId, name: p.name, status: p.status,
        value: `₹${p.actualCost.toLocaleString('en-IN')}`,
        variant: (p.actualCost > p.plannedBudget ? 'danger' : 'success') as 'danger' | 'success',
        detail: `Budget: ₹${p.plannedBudget.toLocaleString('en-IN')}`
      }))
    } : undefined,
  }), [kpis, projectList]);

  const budgetUtilBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: '(Actual_Cost / Planned_Budget) × 100',
    variables: [
      { label: 'Actual Cost', value: `₹${kpis.actualCost.toLocaleString('en-IN')}` },
      { label: 'Planned Budget', value: `₹${kpis.plannedBudget.toLocaleString('en-IN')}` },
    ],
    steps: [{ label: 'Utilization', expression: `${kpis.actualCost} / ${kpis.plannedBudget} × 100`, result: `${kpis.budgetUtilization.toFixed(1)}%` }],
    result: `${kpis.budgetUtilization.toFixed(1)}%`,
    contributingRecords: projectList.length > 0 ? {
      title: 'Per-Project Utilization', valueLabel: 'Utilization',
      records: projectList.map(p => {
        const util = p.plannedBudget > 0 ? ((p.actualCost / p.plannedBudget) * 100) : 0;
        return {
          refId: p.refId, name: p.name, status: p.status,
          value: `${util.toFixed(1)}%`,
          variant: (util > 100 ? 'danger' : util > 90 ? 'warning' : 'success') as 'danger' | 'warning' | 'success',
          detail: `₹${p.actualCost.toLocaleString('en-IN')} / ₹${p.plannedBudget.toLocaleString('en-IN')}`
        };
      })
    } : undefined,
  }), [kpis, projectList]);

  const costVarianceBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'EV - AC (aggregated)',
    description: 'Positive = under budget, Negative = over budget',
    variables: [{ label: 'Cost Variance', value: `₹${kpis.costVariance.toLocaleString('en-IN')}`, highlight: true }],
    result: `₹${kpis.costVariance.toLocaleString('en-IN')}`,
    contributingRecords: projectList.length > 0 ? {
      title: 'Per-Project Cost Performance', valueLabel: 'CPI',
      records: projectList.map(p => ({
        refId: p.refId, name: p.name, status: p.cpi >= 1 ? '✅ Under Budget' : '🔴 Over Budget',
        value: p.cpi.toFixed(2),
        variant: (p.cpi >= 1 ? 'success' : 'danger') as 'success' | 'danger',
        detail: `Actual: ₹${p.actualCost.toLocaleString('en-IN')} | Budget: ₹${p.plannedBudget.toLocaleString('en-IN')}`
      }))
    } : undefined,
  }), [kpis, projectList]);

  const cpiBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'Earned_Value / Actual_Cost_Value',
    description: '≥ 1.0 = cost efficient',
    variables: [{ label: 'CPI', value: kpis.cpi.toFixed(3), highlight: true }],
    result: kpis.cpi.toFixed(3),
    contributingRecords: projectList.length > 0 ? {
      title: 'Per-Project CPI', valueLabel: 'CPI',
      records: projectList.map(p => ({
        refId: p.refId, name: p.name, status: p.cpi >= 1 ? 'Efficient' : 'Overrun',
        value: p.cpi.toFixed(2),
        variant: (p.cpi >= 1 ? 'success' : 'danger') as 'success' | 'danger',
        detail: `Budget: ₹${p.plannedBudget.toLocaleString('en-IN')}`
      }))
    } : undefined,
  }), [kpis, projectList]);

  const eacBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'Planned_Budget / CPI',
    description: 'Estimate at Completion',
    variables: [
      { label: 'Planned Budget', value: `₹${kpis.plannedBudget.toLocaleString('en-IN')}` },
      { label: 'CPI', value: kpis.cpi.toFixed(3), highlight: true },
    ],
    steps: [{ label: 'EAC', expression: `${kpis.plannedBudget} / ${kpis.cpi.toFixed(3)}`, result: `₹${kpis.eac.toLocaleString('en-IN')}` }],
    result: `₹${kpis.eac.toLocaleString('en-IN')}`,
  }), [kpis]);

  const etcBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'EAC - Actual_Cost',
    variables: [
      { label: 'EAC', value: `₹${kpis.eac.toLocaleString('en-IN')}` },
      { label: 'Actual Cost', value: `₹${kpis.actualCost.toLocaleString('en-IN')}` },
    ],
    result: `₹${kpis.etc.toLocaleString('en-IN')}`,
  }), [kpis]);

  const vacBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'Planned_Budget - EAC',
    description: 'Positive = savings, Negative = overrun',
    variables: [
      { label: 'Planned Budget', value: `₹${kpis.plannedBudget.toLocaleString('en-IN')}` },
      { label: 'EAC', value: `₹${kpis.eac.toLocaleString('en-IN')}` },
    ],
    result: `₹${kpis.vac.toLocaleString('en-IN')}`,
  }), [kpis]);

  const overrunBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: '((Forecast - Budget) / Budget) × 100',
    variables: [{ label: 'Predicted Overrun', value: `${kpis.predictedCostOverrunPercent.toFixed(1)}%`, highlight: true }],
    result: `${kpis.predictedCostOverrunPercent.toFixed(1)}%`,
  }), [kpis]);

  const costPerTaskBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'SUM(Actual_Cost) / MAX(1, COUNT(Task_ID))',
    variables: [{ label: 'Cost Per Task', value: `₹${kpis.costPerTask.toLocaleString('en-IN')}`, highlight: true }],
    result: `₹${kpis.costPerTask.toLocaleString('en-IN')}`,
  }), [kpis]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Budget Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Planned Budget" value={`₹${kpis.plannedBudget.toLocaleString('en-IN')}`} icon={IndianRupee}
            formula="SUM(Planned_Budget)" formulaBreakdown={budgetBreakdown} />
          <KPIMetricCard title="Actual Cost" value={`₹${kpis.actualCost.toLocaleString('en-IN')}`} icon={IndianRupee}
            formula="SUM(Actual_Cost)" formulaBreakdown={actualCostBreakdown} />
          <KPIMetricCard title="Budget Utilization (%)" value={`${kpis.budgetUtilization.toFixed(1)}%`}
            variant={kpis.budgetUtilization > 100 ? 'danger' : kpis.budgetUtilization > 90 ? 'warning' : 'success'}
            icon={BarChart3} formula="(Actual_Cost / Planned_Budget) × 100" formulaBreakdown={budgetUtilBreakdown} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Variance & Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Cost Variance" value={`₹${kpis.costVariance.toLocaleString('en-IN')}`}
            subtitle={kpis.costVariance >= 0 ? 'Under budget' : 'Over budget'}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'}
            icon={kpis.costVariance >= 0 ? TrendingUp : TrendingDown}
            formula="EV - AC" formulaBreakdown={costVarianceBreakdown} />
          <KPIMetricCard title="Cost Per Task" value={`₹${kpis.costPerTask.toLocaleString('en-IN')}`}
            subtitle="Actual Cost / MAX(1, Task Count)" icon={Calculator}
            formula="SUM(Actual_Cost) / MAX(1, COUNT(Task_ID))" formulaBreakdown={costPerTaskBreakdown} />
          <KPIMetricCard title="CPI" value={kpis.cpi.toFixed(3)}
            subtitle={kpis.cpi >= 1 ? 'Cost efficient' : 'Cost overrun'}
            variant={kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger'}
            icon={Target} formula="Earned_Value / Actual_Cost_Value" formulaBreakdown={cpiBreakdown} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Forecasting</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="EAC" value={`₹${kpis.eac.toLocaleString('en-IN')}`}
            subtitle="Estimate At Completion" icon={Calculator}
            formula="Planned_Budget / CPI" formulaBreakdown={eacBreakdown} />
          <KPIMetricCard title="ETC" value={`₹${kpis.etc.toLocaleString('en-IN')}`}
            subtitle="Estimate To Complete" icon={Calculator}
            formula="EAC - Actual_Cost" formulaBreakdown={etcBreakdown} />
          <KPIMetricCard title="VAC" value={`₹${kpis.vac.toLocaleString('en-IN')}`}
            subtitle={kpis.vac >= 0 ? 'Under budget forecast' : 'Over budget forecast'}
            variant={kpis.vac >= 0 ? 'success' : 'danger'}
            formula="Planned_Budget - EAC" formulaBreakdown={vacBreakdown} />
          <KPIMetricCard title="Predicted Cost Overrun (%)" value={`${kpis.predictedCostOverrunPercent.toFixed(1)}%`}
            subtitle="((Forecasted - Planned) / Planned) × 100"
            variant={kpis.predictedCostOverrunPercent > 10 ? 'danger' : 'default'}
            icon={kpis.predictedCostOverrunPercent > 0 ? TrendingDown : TrendingUp}
            formula="((Forecast - Budget) / Budget) × 100" formulaBreakdown={overrunBreakdown} />
        </div>
      </div>
    </div>
  );
}
