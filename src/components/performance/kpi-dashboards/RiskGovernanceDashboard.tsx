import React, { useMemo, useState } from 'react';
import { KPIMetricCard } from './KPIMetricCard';
import { HierarchyRiskKPIs, HierarchySeniorKPIs } from '@/hooks/useHierarchyKPI';
import { ShieldAlert, AlertTriangle, Clock, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  kpis: HierarchyRiskKPIs;
  projectList?: HierarchySeniorKPIs['projectList'];
  onSelectProject?: (projectId: string) => void;
}

type DrillType = 'total' | 'delayed' | 'risk' | 'avgDelay' | null;

export function RiskGovernanceDashboard({ kpis, projectList = [], onSelectProject }: Props) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<DrillType>(null);

  const handleOpen = (type: DrillType) => { setActiveType(type); setOpen(true); };
  const handleRowClick = (id: string) => { setOpen(false); onSelectProject?.(id); };

  const filteredList = useMemo(() => {
    if (activeType === 'delayed') return projectList.filter(p => p.spi < 1);
    return projectList;
  }, [activeType, projectList]);

  const titles: Record<string, string> = {
    total: `All Projects (${kpis.totalProjects})`,
    delayed: `Delayed Projects (${kpis.delayedProjects})`,
    risk: `Predicted Risk Projects (${kpis.predictedRiskProjects})`,
    avgDelay: `Avg Predicted Delay — ${kpis.averagePredictedDelay.toFixed(1)} days`,
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Project Risk Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMetricCard title="Total Projects" value={kpis.totalProjects} icon={Briefcase}
            formula="COUNT(Project_ID)" onClick={() => handleOpen('total')} />
          <KPIMetricCard title="Delayed Projects" value={kpis.delayedProjects}
            variant={kpis.delayedProjects > 0 ? 'danger' : 'success'} icon={AlertTriangle}
            formula="COUNT_IF(Delayed)" onClick={() => handleOpen('delayed')} />
          <KPIMetricCard title="Predicted Risk Projects" value={kpis.predictedRiskProjects}
            subtitle="Predicted_Delay > 0"
            variant={kpis.predictedRiskProjects > 0 ? 'warning' : 'success'} icon={ShieldAlert}
            onClick={() => handleOpen('risk')} />
          <KPIMetricCard title="Avg Predicted Delay" value={`${kpis.averagePredictedDelay.toFixed(1)} days`}
            variant={kpis.averagePredictedDelay > 5 ? 'warning' : 'default'} icon={Clock}
            onClick={() => handleOpen('avgDelay')} />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{titles[activeType || ''] || ''}</DialogTitle>
            <p className="text-xs text-muted-foreground">Click a row to drill into that project</p>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">CPI</TableHead>
                <TableHead className="text-right">SPI</TableHead>
                <TableHead className="text-right">Risk Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleRowClick(p.id)}>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{p.refId}</Badge></TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <span className={p.cpi >= 1 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>{p.cpi.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={p.spi >= 1 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>{p.spi.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right">{p.riskScore}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
        <p className="font-medium mb-1">ℹ️ Limited Risk Metrics</p>
        <p>
          Since no dedicated risk or issue forms exist, only project-level delay and prediction metrics are available.
        </p>
      </div>
    </div>
  );
}
