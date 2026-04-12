import React, { useMemo, useState } from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchyFinanceKPIs, HierarchySeniorKPIs } from '@/hooks/useHierarchyKPI';
import { IndianRupee, TrendingUp, TrendingDown, Calculator, Target, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  kpis: HierarchyFinanceKPIs;
  projectList?: HierarchySeniorKPIs['projectList'];
  onSelectProject?: (projectId: string) => void;
}

type DrillType = 'budget' | 'actualCost' | 'budgetUtil' | 'costVariance' | 'costPerTask' | 'cpi' | 'eac' | 'etc' | 'vac' | 'overrun' | null;

export function FinanceDashboard({ kpis, projectList = [], onSelectProject }: Props) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<DrillType>(null);

  const handleOpen = (type: DrillType) => { setActiveType(type); setOpen(true); };
  const handleRowClick = (id: string) => { setOpen(false); onSelectProject?.(id); };

  const modalTitle = useMemo(() => {
    const titles: Record<string, string> = {
      budget: `Planned Budget — ₹${kpis.plannedBudget.toLocaleString('en-IN')}`,
      actualCost: `Actual Cost — ₹${kpis.actualCost.toLocaleString('en-IN')}`,
      budgetUtil: `Budget Utilization — ${kpis.budgetUtilization.toFixed(1)}%`,
      costVariance: `Cost Variance — ₹${kpis.costVariance.toLocaleString('en-IN')}`,
      costPerTask: `Cost Per Task — ₹${kpis.costPerTask.toLocaleString('en-IN')}`,
      cpi: `CPI — ${kpis.cpi.toFixed(3)}`,
      eac: `EAC — ₹${kpis.eac.toLocaleString('en-IN')}`,
      etc: `ETC — ₹${kpis.etc.toLocaleString('en-IN')}`,
      vac: `VAC — ₹${kpis.vac.toLocaleString('en-IN')}`,
      overrun: `Predicted Cost Overrun — ${kpis.predictedCostOverrunPercent.toFixed(1)}%`,
    };
    return titles[activeType || ''] || '';
  }, [activeType, kpis]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Budget Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Planned Budget" value={`₹${kpis.plannedBudget.toLocaleString('en-IN')}`} icon={IndianRupee}
            formula="SUM(Planned_Budget)" onClick={() => handleOpen('budget')} />
          <KPIMetricCard title="Actual Cost" value={`₹${kpis.actualCost.toLocaleString('en-IN')}`} icon={IndianRupee}
            formula="SUM(Actual_Cost)" onClick={() => handleOpen('actualCost')} />
          <KPIMetricCard title="Budget Utilization (%)" value={`${kpis.budgetUtilization.toFixed(1)}%`}
            variant={kpis.budgetUtilization > 100 ? 'danger' : kpis.budgetUtilization > 90 ? 'warning' : 'success'}
            icon={BarChart3} formula="(Actual / Planned) × 100" onClick={() => handleOpen('budgetUtil')} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Variance & Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Cost Variance" value={`₹${kpis.costVariance.toLocaleString('en-IN')}`}
            subtitle={kpis.costVariance >= 0 ? 'Under budget' : 'Over budget'}
            variant={kpis.costVariance >= 0 ? 'success' : 'danger'}
            icon={kpis.costVariance >= 0 ? TrendingUp : TrendingDown}
            formula="EV - AC" onClick={() => handleOpen('costVariance')} />
          <KPIMetricCard title="Cost Per Task" value={`₹${kpis.costPerTask.toLocaleString('en-IN')}`}
            subtitle="Actual / Task Count" icon={Calculator}
            formula="SUM(Actual) / MAX(1, Tasks)" onClick={() => handleOpen('costPerTask')} />
          <KPIMetricCard title="CPI" value={kpis.cpi.toFixed(3)}
            subtitle={kpis.cpi >= 1 ? 'Cost efficient' : 'Cost overrun'}
            variant={kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger'}
            icon={Target} formula="EV / AC" onClick={() => handleOpen('cpi')} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Forecasting</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="EAC" value={`₹${kpis.eac.toLocaleString('en-IN')}`}
            subtitle="Estimate At Completion" icon={Calculator}
            formula="Budget / CPI" onClick={() => handleOpen('eac')} />
          <KPIMetricCard title="ETC" value={`₹${kpis.etc.toLocaleString('en-IN')}`}
            subtitle="Estimate To Complete" icon={Calculator}
            formula="EAC - Actual" onClick={() => handleOpen('etc')} />
          <KPIMetricCard title="VAC" value={`₹${kpis.vac.toLocaleString('en-IN')}`}
            subtitle={kpis.vac >= 0 ? 'Under budget forecast' : 'Over budget forecast'}
            variant={kpis.vac >= 0 ? 'success' : 'danger'}
            formula="Budget - EAC" onClick={() => handleOpen('vac')} />
          <KPIMetricCard title="Pred. Overrun (%)" value={`${kpis.predictedCostOverrunPercent.toFixed(1)}%`}
            variant={kpis.predictedCostOverrunPercent > 10 ? 'danger' : 'default'}
            icon={kpis.predictedCostOverrunPercent > 0 ? TrendingDown : TrendingUp}
            formula="((Forecast-Budget)/Budget)×100" onClick={() => handleOpen('overrun')} />
        </div>
      </div>

      {/* Records Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <p className="text-xs text-muted-foreground">Records involved in this calculation. Click a row to drill into it.</p>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Planned Budget</TableHead>
                <TableHead className="text-right">Actual Cost</TableHead>
                <TableHead className="text-right">CPI</TableHead>
                <TableHead className="text-right">SPI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectList.map((p) => {
                const util = p.plannedBudget > 0 ? ((p.actualCost / p.plannedBudget) * 100) : 0;
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleRowClick(p.id)}>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{p.refId}</Badge></TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">₹{p.plannedBudget.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={p.actualCost > p.plannedBudget ? 'text-destructive' : ''}>
                        ₹{p.actualCost.toLocaleString('en-IN')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={p.cpi >= 1 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>{p.cpi.toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={p.spi >= 1 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>{p.spi.toFixed(2)}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
