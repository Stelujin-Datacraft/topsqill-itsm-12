import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KPIMetricCard } from './KPIMetricCard';
import { SeniorManagementKPIs, KPIAlert } from '@/hooks/usePerformanceKPI';
import { Briefcase, TrendingUp, DollarSign, AlertTriangle, Target, Activity, BarChart3, ShieldAlert } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  kpis: SeniorManagementKPIs;
  alerts: KPIAlert[];
}

export function SeniorManagementDashboard({ kpis, alerts }: Props) {
  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {alerts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold text-destructive">Active Alerts ({alerts.length})</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.map((a, i) => (
                <Badge key={i} variant={a.severity === 'critical' ? 'destructive' : 'secondary'}>
                  {a.title}: {a.description}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Status Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Project Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Total Projects" value={kpis.totalProjects} icon={Briefcase} />
          <KPIMetricCard title="Active" value={kpis.activeProjects} icon={Activity} variant="success" />
          <KPIMetricCard title="Completed" value={kpis.completedProjects} icon={Target} />
          <KPIMetricCard title="Delayed" value={kpis.delayedProjects} icon={AlertTriangle} variant={kpis.delayedProjects > 0 ? 'danger' : 'default'} />
        </div>
      </div>

      {/* Delivery & Performance */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delivery & Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard
            title="On-Time Delivery"
            value={`${kpis.onTimeDeliveryRate.toFixed(1)}%`}
            variant={kpis.onTimeDeliveryRate >= 80 ? 'success' : kpis.onTimeDeliveryRate >= 60 ? 'warning' : 'danger'}
            icon={TrendingUp}
          />
          <KPIMetricCard
            title="Portfolio CPI"
            value={kpis.portfolioCPI.toFixed(2)}
            subtitle={kpis.portfolioCPI >= 1 ? 'Under budget' : 'Over budget'}
            variant={kpis.portfolioCPI >= 1 ? 'success' : kpis.portfolioCPI >= 0.9 ? 'warning' : 'danger'}
            icon={DollarSign}
          />
          <KPIMetricCard
            title="Portfolio SPI"
            value={kpis.portfolioSPI.toFixed(2)}
            subtitle={kpis.portfolioSPI >= 1 ? 'Ahead of schedule' : 'Behind schedule'}
            variant={kpis.portfolioSPI >= 1 ? 'success' : kpis.portfolioSPI >= 0.9 ? 'warning' : 'danger'}
            icon={BarChart3}
          />
          <KPIMetricCard
            title="Avg Risk Score"
            value={kpis.averageRiskScore.toFixed(1)}
            variant={kpis.averageRiskScore > 70 ? 'danger' : kpis.averageRiskScore > 40 ? 'warning' : 'success'}
            icon={AlertTriangle}
          />
        </div>
      </div>

      {/* Financial Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Planned Budget" value={kpis.portfolioPlannedBudget} icon={DollarSign} />
          <KPIMetricCard title="Actual Cost" value={kpis.portfolioActualCost} icon={DollarSign} />
          <KPIMetricCard
            title="Budget Utilization"
            value={`${kpis.budgetUtilization.toFixed(1)}%`}
            variant={kpis.budgetUtilization > 100 ? 'danger' : kpis.budgetUtilization > 90 ? 'warning' : 'success'}
          />
          <KPIMetricCard title="Earned Value" value={kpis.portfolioEV} />
        </div>
      </div>

      {/* AI Predictions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">AI Predictions & Risk</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="High Risk Projects" value={kpis.highRiskProjects} variant={kpis.highRiskProjects > 0 ? 'danger' : 'success'} icon={ShieldAlert} />
          <KPIMetricCard title="Avg Predicted Delay" value={`${kpis.averagePredictedDelay.toFixed(1)} days`} variant={kpis.averagePredictedDelay > 5 ? 'warning' : 'default'} />
          <KPIMetricCard title="Avg Cost Overrun" value={`${kpis.averagePredictedCostOverrun.toFixed(1)}%`} variant={kpis.averagePredictedCostOverrun > 10 ? 'danger' : 'default'} />
          <KPIMetricCard title="Anomaly Projects" value={kpis.anomalyProjects} variant={kpis.anomalyProjects > 0 ? 'warning' : 'success'} icon={AlertTriangle} />
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
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Risk Score</TableHead>
                    <TableHead className="text-right">CPI</TableHead>
                    <TableHead className="text-right">SPI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.projectList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant={p.status.toLowerCase().includes('completed') ? 'default' : p.status.toLowerCase().includes('progress') ? 'secondary' : 'outline'}>
                          {p.status || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={p.riskScore > 70 ? 'text-destructive font-semibold' : p.riskScore > 40 ? 'text-yellow-600 font-medium' : ''}>
                          {p.riskScore.toFixed(0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={p.cpi < 0.9 ? 'text-destructive' : p.cpi >= 1 ? 'text-green-600' : ''}>
                          {p.cpi.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={p.spi < 0.9 ? 'text-destructive' : p.spi >= 1 ? 'text-green-600' : ''}>
                          {p.spi.toFixed(2)}
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
