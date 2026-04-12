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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  kpis: HierarchySeniorKPIs;
}

type DrillType = 'onTime' | 'delayed' | 'completed' | null;

export function SeniorManagementDashboard({ kpis }: Props) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<DrillType>(null);

  // ================= CLASSIFICATION =================
  const { onTimeProjects, delayedProjects, completedProjects } = useMemo(() => {
    const onTime = kpis.projectList.filter((p) => (p.spi ?? 1) >= 1);
    const delayed = kpis.projectList.filter((p) => (p.spi ?? 1) < 1);
    const completed = kpis.projectList.filter((p) =>
      (p.status || '').toLowerCase().includes('completed')
    );

    return {
      onTimeProjects: onTime,
      delayedProjects: delayed,
      completedProjects: completed,
    };
  }, [kpis.projectList]);

  // ================= MODAL DATA =================
  const modalData = useMemo(() => {
    switch (activeType) {
      case 'onTime':
        return {
          title: 'On-Time Projects',
          data: onTimeProjects,
        };
      case 'delayed':
        return {
          title: 'Delayed Projects',
          data: delayedProjects,
        };
      case 'completed':
        return {
          title: 'Completed Projects',
          data: completedProjects,
        };
      default:
        return { title: '', data: [] };
    }
  }, [activeType, onTimeProjects, delayedProjects, completedProjects]);

  // ================= CLICK HANDLER =================
  const handleOpen = (type: DrillType) => {
    setActiveType(type);
    setOpen(true);
  };

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
          />

          {/* <KPIMetricCard
            title="Active Projects"
            value={kpis.activeProjects}
            icon={Activity}
          /> */}

          {/* ================= NEW: ON TIME PROJECTS KPI ================= */}
          <KPIMetricCard
            title="Completed Projects"
            value={completedProjects.length}
            icon={Briefcase}
            variant={completedProjects.length ? 'success' : 'default'}
            onClick={() => handleOpen('completed')}
          />
          <KPIMetricCard
            title="On-Time Projects"
            value={onTimeProjects.length}
            icon={Target}
            variant={onTimeProjects.length ? 'success' : 'default'}
            onClick={() => handleOpen('onTime')}
          />

          {/* ================= COMPLETED ================= */}


          {/* ================= DELAYED ================= */}
          <KPIMetricCard
            title="Delayed Projects"
            value={delayedProjects.length}
            icon={AlertTriangle}
            variant={delayedProjects.length ? 'danger' : 'default'}
            onClick={() => handleOpen('delayed')}
          />

        </div>
      </div>

      {/* ================= DELIVERY ================= */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Delivery & Performance
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

          {/* ================= ON TIME KPI ================= */}
          <KPIMetricCard
            title="On-Time Delivery (%)"
            value={`${kpis.onTimeDeliveryRate.toFixed(1)}%`}
            icon={TrendingUp}
            variant={
              kpis.onTimeDeliveryRate >= 80
                ? 'success'
                : kpis.onTimeDeliveryRate >= 60
                  ? 'warning'
                  : 'danger'
            }
            formula="(On_Time_Projects / Total_Projects) × 100"
          />

          {/* CPI */}
          <KPIMetricCard
            title="Portfolio CPI"
            value={kpis.portfolioCPI.toFixed(2)}
            icon={IndianRupee}
            variant={kpis.portfolioCPI >= 1 ? 'success' : 'danger'}
          />

          {/* SPI */}
          <KPIMetricCard
            title="Portfolio SPI"
            value={kpis.portfolioSPI.toFixed(2)}
            icon={BarChart3}
            variant={kpis.portfolioSPI >= 1 ? 'success' : 'danger'}
          />

        </div>
      </div>

      {/* ================= DRILLDOWN MODAL ================= */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">

          <DialogHeader>
            <DialogTitle>{modalData.title}</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref Id</TableHead>

                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">CPI</TableHead>
                  <TableHead className="text-right">SPI</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {modalData.data.length > 0 ? (
                  modalData.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Badge variant="outline">{p.refId}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>

                      <TableCell className="text-right">
                        {(p.cpi ?? 0).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right">
                        {(p.spi ?? 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No projects found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

            </Table>
          </div>

        </DialogContent>
      </Dialog>

      {/* ================= FULL PROJECT TABLE ================= */}
      {kpis.projectList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Portfolio</CardTitle>
          </CardHeader>

          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref ID</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Types</TableHead>
                  <TableHead className="text-right">Planned Budget</TableHead>
                  <TableHead className="text-right">Actual Cost</TableHead>
                  <TableHead className="text-right">CPI</TableHead>
                  <TableHead className="text-right">SPI</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {kpis.projectList.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.refId}</TableCell>
                    <TableCell>{p.name}</TableCell>

                    <TableCell>
                      <Badge variant="secondary">{p.projectType}</Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      ₹{(p.plannedBudget ?? 0).toLocaleString('en-IN')}
                    </TableCell>

                    <TableCell className="text-right">
                      ₹{(p.actualCost ?? 0).toLocaleString('en-IN')}
                    </TableCell>

                    <TableCell className="text-right">
                      {(p.cpi ?? 0).toFixed(2)}
                    </TableCell>

                    <TableCell className="text-right">
                      {(p.spi ?? 0).toFixed(2)}
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