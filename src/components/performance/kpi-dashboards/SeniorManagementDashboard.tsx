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
  BarChart3,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  kpis: HierarchySeniorKPIs;
  onSelectProject?: (projectId: string) => void;
}

type DrillType = 'total' | 'onTime' | 'delayed' | 'completed' | 'onTimeDelivery' | 'portfolioCPI' | 'portfolioSPI' | null;

export function SeniorManagementDashboard({ kpis, onSelectProject }: Props) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<DrillType>(null);

  const { onTimeProjects, delayedProjects, completedProjects } = useMemo(() => {
    const onTime = kpis.projectList.filter((p) => (p.spi ?? 1) >= 1);
    const delayed = kpis.projectList.filter((p) => (p.spi ?? 1) < 1);
    const completed = kpis.projectList.filter((p) =>
      (p.status || '').toLowerCase().includes('completed')
    );
    return { onTimeProjects: onTime, delayedProjects: delayed, completedProjects: completed };
  }, [kpis.projectList]);

  const modalData = useMemo(() => {
    switch (activeType) {
      case 'total':
        return { title: `All Projects (${kpis.totalProjects})`, data: kpis.projectList, showBudget: true };
      case 'onTime':
        return { title: `On-Time Projects (${onTimeProjects.length})`, data: onTimeProjects, showBudget: false };
      case 'delayed':
        return { title: `Delayed Projects (${delayedProjects.length})`, data: delayedProjects, showBudget: false };
      case 'completed':
        return { title: `Completed Projects (${completedProjects.length})`, data: completedProjects, showBudget: false };
      case 'onTimeDelivery':
        return { title: `On-Time Delivery — ${kpis.onTimeDeliveryRate.toFixed(1)}%`, data: kpis.projectList, showBudget: false };
      case 'portfolioCPI':
        return { title: `Portfolio CPI — ${kpis.portfolioCPI.toFixed(2)}`, data: kpis.projectList, showBudget: true };
      case 'portfolioSPI':
        return { title: `Portfolio SPI — ${kpis.portfolioSPI.toFixed(2)}`, data: kpis.projectList, showBudget: false };
      default:
        return { title: '', data: [], showBudget: false };
    }
  }, [activeType, kpis, onTimeProjects, delayedProjects, completedProjects]);

  const handleOpen = (type: DrillType) => {
    setActiveType(type);
    setOpen(true);
  };

  const handleRowClick = (projectId: string) => {
    setOpen(false);
    onSelectProject?.(projectId);
  };

  return (
    <div className="space-y-6">
      {/* PROJECT STATUS */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Project Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Total Projects" value={kpis.totalProjects} icon={Briefcase}
            formula="COUNT(Project_ID)" onClick={() => handleOpen('total')} />
          <KPIMetricCard title="Completed Projects" value={completedProjects.length} icon={Briefcase}
            variant={completedProjects.length ? 'success' : 'default'}
            onClick={() => handleOpen('completed')} />
          <KPIMetricCard title="On-Time Projects" value={onTimeProjects.length} icon={Target}
            variant={onTimeProjects.length ? 'success' : 'default'}
            onClick={() => handleOpen('onTime')} />
          <KPIMetricCard title="Delayed Projects" value={delayedProjects.length} icon={AlertTriangle}
            variant={delayedProjects.length ? 'danger' : 'default'}
            onClick={() => handleOpen('delayed')} />
        </div>
      </div>

      {/* DELIVERY */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delivery & Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="On-Time Delivery (%)" value={`${kpis.onTimeDeliveryRate.toFixed(1)}%`} icon={TrendingUp}
            variant={kpis.onTimeDeliveryRate >= 80 ? 'success' : kpis.onTimeDeliveryRate >= 60 ? 'warning' : 'danger'}
            formula="(On_Time / Total) × 100" onClick={() => handleOpen('onTimeDelivery')} />
          <KPIMetricCard title="Portfolio CPI" value={kpis.portfolioCPI.toFixed(2)} icon={IndianRupee}
            variant={kpis.portfolioCPI >= 1 ? 'success' : 'danger'}
            formula="SUM(EV) / SUM(AC)" onClick={() => handleOpen('portfolioCPI')} />
          <KPIMetricCard title="Portfolio SPI" value={kpis.portfolioSPI.toFixed(2)} icon={BarChart3}
            variant={kpis.portfolioSPI >= 1 ? 'success' : 'danger'}
            formula="SUM(EV) / SUM(PV)" onClick={() => handleOpen('portfolioSPI')} />
        </div>
      </div>

      {/* DRILL-DOWN DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalData.title}</DialogTitle>
            {onSelectProject && (
              <p className="text-xs text-muted-foreground">Click a project row to drill into it</p>
            )}
          </DialogHeader>
          <div className="mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref ID</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  {modalData.showBudget && <TableHead className="text-right">Planned Budget</TableHead>}
                  {modalData.showBudget && <TableHead className="text-right">Actual Cost</TableHead>}
                  <TableHead className="text-right">CPI</TableHead>
                  <TableHead className="text-right">SPI</TableHead>
                  {(activeType === 'onTimeDelivery') && <TableHead className="text-right">Schedule</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalData.data.length > 0 ? (
                  modalData.data.map((p) => (
                    <TableRow
                      key={p.id}
                      className={onSelectProject ? 'cursor-pointer hover:bg-primary/5 transition-colors' : ''}
                      onClick={() => handleRowClick(p.id)}
                    >
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{p.refId}</Badge></TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></TableCell>
                      {modalData.showBudget && (
                        <TableCell className="text-right">₹{(p.plannedBudget ?? 0).toLocaleString('en-IN')}</TableCell>
                      )}
                      {modalData.showBudget && (
                        <TableCell className="text-right">₹{(p.actualCost ?? 0).toLocaleString('en-IN')}</TableCell>
                      )}
                      <TableCell className="text-right">
                        <span className={p.cpi >= 1 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>
                          {(p.cpi ?? 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={p.spi >= 1 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>
                          {(p.spi ?? 0).toFixed(2)}
                        </span>
                      </TableCell>
                      {activeType === 'onTimeDelivery' && (
                        <TableCell className="text-right">
                          <Badge variant={p.spi >= 1 ? 'default' : 'destructive'} className="text-[10px]">
                            {p.spi >= 1 ? '✅ On Time' : '🔴 Delayed'}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No projects found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* FULL PROJECT TABLE */}
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
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{p.refId}</Badge></TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{p.status || p.projectType}</Badge></TableCell>
                    <TableCell className="text-right">₹{(p.plannedBudget ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-right">₹{(p.actualCost ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-right">
                      <span className={p.cpi >= 1 ? 'text-emerald-600' : 'text-destructive'}>{(p.cpi ?? 0).toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={p.spi >= 1 ? 'text-emerald-600' : 'text-destructive'}>{(p.spi ?? 0).toFixed(2)}</span>
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
