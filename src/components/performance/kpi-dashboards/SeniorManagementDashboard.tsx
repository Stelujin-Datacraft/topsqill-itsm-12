import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchySeniorKPIs } from '@/hooks/useHierarchyKPI';
import { Briefcase, TrendingUp, IndianRupee, AlertTriangle, Target, Activity, BarChart3 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  kpis: HierarchySeniorKPIs;
}

export function SeniorManagementDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Project Status Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Project Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Total Projects" value={kpis.totalProjects} icon={Briefcase} formula="COUNT(Project_ID)" />
          <KPIMetricCard title="Active Projects" value={kpis.activeProjects} icon={Activity} variant="success" formula="COUNT_IF(Status = 'Active' / 'In Progress')" />
          <KPIMetricCard title="Completed Projects" value={kpis.completedProjects} icon={Target} formula="COUNT_IF(Status = 'Completed')" />
          <KPIMetricCard title="Delayed Projects" value={kpis.delayedProjects} icon={AlertTriangle} variant={kpis.delayedProjects > 0 ? 'danger' : 'default'} formula="COUNT_IF(Actual_End > Planned_End)" />
        </div>
      </div>

      {/* Delivery & Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delivery & Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard
            title="On-Time Delivery (%)"
            value={`${kpis.onTimeDeliveryRate.toFixed(1)}%`}
            variant={kpis.onTimeDeliveryRate >= 80 ? 'success' : kpis.onTimeDeliveryRate >= 60 ? 'warning' : 'danger'}
            icon={TrendingUp}
            formula="(On_Time_Projects / Total_Projects) × 100"
            formulaBreakdown={{
              formula: '(On_Time_Projects / Total_Projects) × 100',
              variables: [
                { label: 'Total Projects', value: kpis.totalProjects },
                { label: 'Delayed Projects', value: kpis.delayedProjects },
                { label: 'On-Time Projects', value: kpis.totalProjects - kpis.delayedProjects, highlight: true },
              ],
              steps: [
                { label: 'On-Time', expression: `${kpis.totalProjects} - ${kpis.delayedProjects}`, result: String(kpis.totalProjects - kpis.delayedProjects) },
                { label: 'Rate', expression: `${kpis.totalProjects - kpis.delayedProjects} / ${kpis.totalProjects} × 100`, result: `${kpis.onTimeDeliveryRate.toFixed(1)}%` },
              ],
              result: `${kpis.onTimeDeliveryRate.toFixed(1)}%`,
            }}
          />
          <KPIMetricCard
            title="Portfolio CPI"
            value={kpis.portfolioCPI.toFixed(2)}
            subtitle={kpis.portfolioCPI >= 1 ? 'Under budget' : 'Over budget'}
            variant={kpis.portfolioCPI >= 1 ? 'success' : kpis.portfolioCPI >= 0.9 ? 'warning' : 'danger'}
            icon={IndianRupee}
            formula="SUM(Earned_Value) / SUM(Actual_Cost_Value)"
            formulaBreakdown={{
              formula: 'SUM(Earned_Value) / SUM(Actual_Cost_Value)',
              description: 'Cost Performance Index — values ≥ 1.0 indicate cost efficiency across the portfolio',
              variables: [
                { label: 'Portfolio CPI (result)', value: kpis.portfolioCPI.toFixed(2), highlight: true },
                { label: 'Total Planned Budget', fieldName: 'SUM(Planned_Budget)', value: `₹${kpis.portfolioPlannedBudget.toLocaleString('en-IN')}` },
                { label: 'Total Actual Cost', fieldName: 'SUM(Actual_Cost)', value: `₹${kpis.portfolioActualCost.toLocaleString('en-IN')}` },
              ],
              result: kpis.portfolioCPI.toFixed(2),
            }}
          />
          <KPIMetricCard
            title="Portfolio SPI"
            value={kpis.portfolioSPI.toFixed(2)}
            subtitle={kpis.portfolioSPI >= 1 ? 'Ahead of schedule' : 'Behind schedule'}
            variant={kpis.portfolioSPI >= 1 ? 'success' : kpis.portfolioSPI >= 0.9 ? 'warning' : 'danger'}
            icon={BarChart3}
            formula="SUM(Earned_Value) / SUM(Planned_Value)"
            formulaBreakdown={{
              formula: 'SUM(Earned_Value) / SUM(Planned_Value)',
              description: 'Schedule Performance Index — values ≥ 1.0 indicate ahead of schedule',
              variables: [
                { label: 'Portfolio SPI (result)', value: kpis.portfolioSPI.toFixed(2), highlight: true },
                { label: 'Total Planned Budget', fieldName: 'SUM(Planned_Budget)', value: `₹${kpis.portfolioPlannedBudget.toLocaleString('en-IN')}` },
                { label: 'Total Actual Cost', fieldName: 'SUM(Actual_Cost)', value: `₹${kpis.portfolioActualCost.toLocaleString('en-IN')}` },
              ],
              result: kpis.portfolioSPI.toFixed(2),
            }}
          />
        </div>
      </div>

      {/* Financial Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Portfolio Planned Budget" value={`₹${kpis.portfolioPlannedBudget.toLocaleString('en-IN')}`} icon={IndianRupee} formula="SUM(Planned_Budget)" />
          <KPIMetricCard title="Portfolio Actual Cost" value={`₹${kpis.portfolioActualCost.toLocaleString('en-IN')}`} icon={IndianRupee} formula="SUM(Actual_Cost)" />
          <KPIMetricCard
            title="Budget Utilization (%)"
            value={`${kpis.budgetUtilization.toFixed(1)}%`}
            variant={kpis.budgetUtilization > 100 ? 'danger' : kpis.budgetUtilization > 90 ? 'warning' : 'success'}
            formula="(SUM(Actual_Cost) / SUM(Planned_Budget)) × 100"
            formulaBreakdown={{
              formula: '(SUM(Actual_Cost) / SUM(Planned_Budget)) × 100',
              variables: [
                { label: 'Total Actual Cost', fieldName: 'SUM(Actual_Cost)', value: `₹${kpis.portfolioActualCost.toLocaleString('en-IN')}` },
                { label: 'Total Planned Budget', fieldName: 'SUM(Planned_Budget)', value: `₹${kpis.portfolioPlannedBudget.toLocaleString('en-IN')}` },
              ],
              steps: [
                { label: 'Ratio', expression: `${kpis.portfolioActualCost} / ${kpis.portfolioPlannedBudget}`, result: kpis.portfolioPlannedBudget > 0 ? (kpis.portfolioActualCost / kpis.portfolioPlannedBudget).toFixed(4) : '0' },
                { label: 'Utilization', expression: `Ratio × 100`, result: `${kpis.budgetUtilization.toFixed(1)}%` },
              ],
              result: `${kpis.budgetUtilization.toFixed(1)}%`,
            }}
          />
        </div>
      </div>

      {/* Predictions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Predictions</h3>
        <div className="grid grid-cols-2 gap-3">
          <KPIMetricCard title="Avg Predicted Delay" value={`${kpis.averagePredictedDelay.toFixed(1)} days`} variant={kpis.averagePredictedDelay > 5 ? 'warning' : 'default'} formula="AVG(Predicted_Delay_Days)" />
          <KPIMetricCard title="Avg Predicted Cost Overrun (%)" value={`${kpis.averagePredictedCostOverrun.toFixed(1)}%`} variant={kpis.averagePredictedCostOverrun > 10 ? 'danger' : 'default'} formula="AVG(((Forecast - Budget) / Budget) × 100)" />
        </div>
      </div>

      {/* Project List Table */}
      {kpis.projectList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-muted-foreground">{p.refId}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant={p.status.toLowerCase().includes('completed') ? 'default' : p.status.toLowerCase().includes('progress') ? 'secondary' : 'outline'}>
                          {p.status || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">₹{(p.plannedBudget ?? 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">₹{(p.actualCost ?? 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">
                        <span className={(p.cpi ?? 0) < 0.9 ? 'text-destructive' : (p.cpi ?? 0) >= 1 ? 'text-green-600' : ''}>
                          {(p.cpi ?? 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={(p.spi ?? 0) < 0.9 ? 'text-destructive' : (p.spi ?? 0) >= 1 ? 'text-green-600' : ''}>
                          {(p.spi ?? 0).toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
