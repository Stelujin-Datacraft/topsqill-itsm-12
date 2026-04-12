import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchySeniorKPIs } from '@/hooks/useHierarchyKPI';
import {
  Briefcase,
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  Target,
  Activity,
  BarChart3,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type FormulaBreakdown } from './FormulaBreakdownDialog';

interface Props {
  kpis: HierarchySeniorKPIs;
  onSelectProject?: (projectId: string) => void;
}

export function SeniorManagementDashboard({ kpis, onSelectProject }: Props) {
  // ================= CLASSIFICATION =================
  const { onTimeProjects, delayedProjects, completedProjects } = useMemo(() => {
    const onTime = kpis.projectList.filter((p) => (p.spi ?? 1) >= 1);
    const delayed = kpis.projectList.filter((p) => (p.spi ?? 1) < 1);
    const completed = kpis.projectList.filter((p) =>
      (p.status || '').toLowerCase().includes('completed')
    );
    return { onTimeProjects: onTime, delayedProjects: delayed, completedProjects: completed };
  }, [kpis.projectList]);

  // ================= FORMULA BREAKDOWNS =================
  const totalProjectsBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'COUNT(Project_ID)',
    description: 'Total number of project submissions',
    variables: [{ label: 'Total Projects', fieldName: 'COUNT(Project_ID)', value: kpis.totalProjects, highlight: true }],
    result: kpis.totalProjects,
    contributingRecords: {
      title: 'All Projects',
      valueLabel: 'Status',
      records: kpis.projectList.map(p => ({
        refId: p.refId, name: p.name, status: p.status,
        value: `CPI: ${p.cpi.toFixed(2)} | SPI: ${p.spi.toFixed(2)}`,
        variant: (p.cpi >= 1 && p.spi >= 1 ? 'success' : p.cpi >= 0.9 && p.spi >= 0.9 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger',
        detail: `Budget: ₹${p.plannedBudget.toLocaleString('en-IN')} | Actual: ₹${p.actualCost.toLocaleString('en-IN')}`
      }))
    }
  }), [kpis]);

  const completedBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'COUNT_IF(Project_Status = "Completed")',
    variables: [
      { label: 'Total Projects', value: kpis.totalProjects },
      { label: 'Completed Projects', value: completedProjects.length, highlight: true },
    ],
    result: completedProjects.length,
    contributingRecords: {
      title: 'Completed Projects',
      valueLabel: 'CPI / SPI',
      records: completedProjects.map(p => ({
        refId: p.refId, name: p.name, status: p.status,
        value: `CPI: ${p.cpi.toFixed(2)} | SPI: ${p.spi.toFixed(2)}`,
        variant: 'success' as const,
        detail: `Budget: ₹${p.plannedBudget.toLocaleString('en-IN')}`
      }))
    }
  }), [kpis, completedProjects]);

  const onTimeBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'COUNT_IF(SPI ≥ 1.0)',
    description: 'Projects with Schedule Performance Index ≥ 1.0 (on or ahead of schedule)',
    variables: [
      { label: 'Total Projects', value: kpis.totalProjects },
      { label: 'On-Time (SPI ≥ 1)', value: onTimeProjects.length, highlight: true },
      { label: 'Delayed (SPI < 1)', value: delayedProjects.length },
    ],
    result: onTimeProjects.length,
    contributingRecords: {
      title: 'On-Time Projects',
      valueLabel: 'SPI',
      records: onTimeProjects.map(p => ({
        refId: p.refId, name: p.name, status: p.status,
        value: `SPI: ${p.spi.toFixed(2)}`,
        variant: 'success' as const,
        detail: `CPI: ${p.cpi.toFixed(2)} | Budget: ₹${p.plannedBudget.toLocaleString('en-IN')}`
      }))
    }
  }), [kpis, onTimeProjects, delayedProjects]);

  const delayedBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'COUNT_IF(SPI < 1.0)',
    description: 'Projects with Schedule Performance Index < 1.0 (behind schedule)',
    variables: [
      { label: 'Total Projects', value: kpis.totalProjects },
      { label: 'Delayed (SPI < 1)', value: delayedProjects.length, highlight: true },
    ],
    result: delayedProjects.length,
    contributingRecords: {
      title: 'Delayed Projects',
      valueLabel: 'SPI',
      records: delayedProjects.map(p => ({
        refId: p.refId, name: p.name, status: p.status,
        value: `SPI: ${p.spi.toFixed(2)}`,
        variant: 'danger' as const,
        detail: `CPI: ${p.cpi.toFixed(2)} | Actual: ₹${p.actualCost.toLocaleString('en-IN')}`
      }))
    }
  }), [kpis, delayedProjects]);

  const onTimeDeliveryBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: '(On_Time_Projects / Total_Projects) × 100',
    variables: [
      { label: 'On-Time Projects', value: onTimeProjects.length, highlight: true },
      { label: 'Total Projects', value: kpis.totalProjects },
    ],
    steps: [
      { label: 'Rate', expression: `${onTimeProjects.length} / ${kpis.totalProjects} × 100`, result: `${kpis.onTimeDeliveryRate.toFixed(1)}%` }
    ],
    result: `${kpis.onTimeDeliveryRate.toFixed(1)}%`,
    contributingRecords: {
      title: 'All Projects — Schedule Status',
      valueLabel: 'SPI',
      records: kpis.projectList.map(p => ({
        refId: p.refId, name: p.name, status: p.spi >= 1 ? 'On Time' : 'Delayed',
        value: `SPI: ${p.spi.toFixed(2)}`,
        variant: (p.spi >= 1 ? 'success' : 'danger') as 'success' | 'danger',
        detail: `CPI: ${p.cpi.toFixed(2)}`
      }))
    }
  }), [kpis, onTimeProjects]);

  const portfolioCPIBreakdown: FormulaBreakdown = useMemo(() => {
    const sumEV = kpis.projectList.reduce((s, p) => s + (p.cpi * p.actualCost), 0); // approx
    const sumAC = kpis.projectList.reduce((s, p) => s + p.actualCost, 0);
    return {
      formula: 'SUM(Earned_Value) / SUM(Actual_Cost_Value)',
      description: 'Portfolio-wide Cost Performance Index. ≥ 1.0 = under budget',
      variables: [
        { label: 'Portfolio CPI', value: kpis.portfolioCPI.toFixed(2), highlight: true },
      ],
      result: kpis.portfolioCPI.toFixed(2),
      contributingRecords: {
        title: 'Per-Project CPI',
        valueLabel: 'CPI',
        records: kpis.projectList.map(p => ({
          refId: p.refId, name: p.name, status: p.cpi >= 1 ? '✅ Efficient' : '⚠️ Over Budget',
          value: p.cpi.toFixed(2),
          variant: (p.cpi >= 1 ? 'success' : p.cpi >= 0.9 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger',
          detail: `Budget: ₹${p.plannedBudget.toLocaleString('en-IN')} | Actual: ₹${p.actualCost.toLocaleString('en-IN')}`
        }))
      }
    };
  }, [kpis]);

  const portfolioSPIBreakdown: FormulaBreakdown = useMemo(() => ({
    formula: 'SUM(Earned_Value) / SUM(Planned_Value)',
    description: 'Portfolio-wide Schedule Performance Index. ≥ 1.0 = ahead of schedule',
    variables: [
      { label: 'Portfolio SPI', value: kpis.portfolioSPI.toFixed(2), highlight: true },
    ],
    result: kpis.portfolioSPI.toFixed(2),
    contributingRecords: {
      title: 'Per-Project SPI',
      valueLabel: 'SPI',
      records: kpis.projectList.map(p => ({
        refId: p.refId, name: p.name, status: p.spi >= 1 ? '✅ On Schedule' : '⚠️ Behind',
        value: p.spi.toFixed(2),
        variant: (p.spi >= 1 ? 'success' : p.spi >= 0.9 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger',
        detail: `CPI: ${p.cpi.toFixed(2)} | Budget: ₹${p.plannedBudget.toLocaleString('en-IN')}`
      }))
    }
  }), [kpis]);

  return (
    <div className="space-y-6">

      {/* ================= PROJECT STATUS ================= */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Project Status
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard
            title="Total Projects"
            value={kpis.totalProjects}
            icon={Briefcase}
            formulaBreakdown={totalProjectsBreakdown}
            formula="COUNT(Project_ID)"
          />

          <KPIMetricCard
            title="Completed Projects"
            value={completedProjects.length}
            icon={Briefcase}
            variant={completedProjects.length ? 'success' : 'default'}
            formulaBreakdown={completedBreakdown}
            formula='COUNT_IF(Status = "Completed")'
          />
          <KPIMetricCard
            title="On-Time Projects"
            value={onTimeProjects.length}
            icon={Target}
            variant={onTimeProjects.length ? 'success' : 'default'}
            formulaBreakdown={onTimeBreakdown}
            formula="COUNT_IF(SPI ≥ 1.0)"
          />

          <KPIMetricCard
            title="Delayed Projects"
            value={delayedProjects.length}
            icon={AlertTriangle}
            variant={delayedProjects.length ? 'danger' : 'default'}
            formulaBreakdown={delayedBreakdown}
            formula="COUNT_IF(SPI < 1.0)"
          />
        </div>
      </div>

      {/* ================= DELIVERY ================= */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Delivery & Performance
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard
            title="On-Time Delivery (%)"
            value={`${kpis.onTimeDeliveryRate.toFixed(1)}%`}
            icon={TrendingUp}
            variant={
              kpis.onTimeDeliveryRate >= 80 ? 'success'
                : kpis.onTimeDeliveryRate >= 60 ? 'warning' : 'danger'
            }
            formula="(On_Time_Projects / Total_Projects) × 100"
            formulaBreakdown={onTimeDeliveryBreakdown}
          />

          <KPIMetricCard
            title="Portfolio CPI"
            value={kpis.portfolioCPI.toFixed(2)}
            icon={IndianRupee}
            variant={kpis.portfolioCPI >= 1 ? 'success' : 'danger'}
            formula="SUM(EV) / SUM(AC)"
            formulaBreakdown={portfolioCPIBreakdown}
          />

          <KPIMetricCard
            title="Portfolio SPI"
            value={kpis.portfolioSPI.toFixed(2)}
            icon={BarChart3}
            variant={kpis.portfolioSPI >= 1 ? 'success' : 'danger'}
            formula="SUM(EV) / SUM(PV)"
            formulaBreakdown={portfolioSPIBreakdown}
          />
        </div>
      </div>

      {/* ================= FULL PROJECT TABLE ================= */}
      {kpis.projectList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Portfolio</CardTitle>
            {onSelectProject && (
              <p className="text-xs text-muted-foreground">Click a row to drill into that project</p>
            )}
          </CardHeader>

          <CardContent className="overflow-x-auto">
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
                {kpis.projectList.map((p) => (
                  <TableRow
                    key={p.id}
                    className={onSelectProject ? 'cursor-pointer hover:bg-primary/5 transition-colors' : ''}
                    onClick={onSelectProject ? () => onSelectProject(p.id) : undefined}
                  >
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{p.refId}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{p.status || p.projectType}</Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      ₹{(p.plannedBudget ?? 0).toLocaleString('en-IN')}
                    </TableCell>

                    <TableCell className="text-right">
                      ₹{(p.actualCost ?? 0).toLocaleString('en-IN')}
                    </TableCell>

                    <TableCell className="text-right">
                      <span className={p.cpi >= 1 ? 'text-emerald-600' : 'text-destructive'}>
                        {(p.cpi ?? 0).toFixed(2)}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <span className={p.spi >= 1 ? 'text-emerald-600' : 'text-destructive'}>
                        {(p.spi ?? 0).toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
