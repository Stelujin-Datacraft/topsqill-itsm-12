import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPIMetricCard } from './KPIMetricCard';
import { RiskGovernanceKPIs } from '@/hooks/usePerformanceKPI';
import { ShieldAlert, ShieldCheck, AlertTriangle, Bug, Clock, CheckCircle2, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props {
  kpis: RiskGovernanceKPIs;
}

export function RiskGovernanceDashboard({ kpis }: Props) {
  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Risk Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPIMetricCard title="Total Risks" value={kpis.totalRisks} icon={ShieldAlert} />
          <KPIMetricCard title="Open Risks" value={kpis.openRisks} variant={kpis.openRisks > 0 ? 'warning' : 'success'} />
          <KPIMetricCard title="Avg Risk Score" value={kpis.averageRiskScore.toFixed(1)}
            variant={kpis.averageRiskScore > 70 ? 'danger' : kpis.averageRiskScore > 40 ? 'warning' : 'success'} icon={AlertTriangle} />
        </div>
      </div>

      {/* Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm w-20 text-red-600 font-medium">High</span>
            <Progress value={kpis.totalRisks > 0 ? (kpis.highRisks / kpis.totalRisks) * 100 : 0} className="flex-1 [&>div]:bg-red-500" />
            <span className="text-sm font-bold w-8 text-right">{kpis.highRisks}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm w-20 text-yellow-600 font-medium">Medium</span>
            <Progress value={kpis.totalRisks > 0 ? (kpis.mediumRisks / kpis.totalRisks) * 100 : 0} className="flex-1 [&>div]:bg-yellow-500" />
            <span className="text-sm font-bold w-8 text-right">{kpis.mediumRisks}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm w-20 text-green-600 font-medium">Low</span>
            <Progress value={kpis.totalRisks > 0 ? (kpis.lowRisks / kpis.totalRisks) * 100 : 0} className="flex-1 [&>div]:bg-green-500" />
            <span className="text-sm font-bold w-8 text-right">{kpis.lowRisks}</span>
          </div>
        </CardContent>
      </Card>

      {/* Issues & Resolution */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Issues & Resolution</h3>
        <div className="grid grid-cols-2 gap-3">
          <KPIMetricCard title="Issues Raised" value={kpis.totalIssues} icon={Bug} />
          <KPIMetricCard title="Avg Resolution Time" value={`${kpis.avgResolutionTime.toFixed(1)} days`} icon={Clock} />
        </div>
      </div>

      {/* Compliance & Audit */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Compliance & Audit</h3>
        <div className="grid grid-cols-2 gap-3">
          <KPIMetricCard title="Compliance Score" value={`${kpis.complianceScore.toFixed(1)}%`}
            variant={kpis.complianceScore >= 80 ? 'success' : kpis.complianceScore >= 60 ? 'warning' : 'danger'}
            icon={ShieldCheck} />
          <KPIMetricCard title="Audit Findings" value={kpis.auditFindingsCount} icon={FileText}
            variant={kpis.auditFindingsCount > 0 ? 'warning' : 'success'} />
        </div>
      </div>
    </div>
  );
}
