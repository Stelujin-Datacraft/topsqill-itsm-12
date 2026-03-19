import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, TrendingUp, TrendingDown, Shield, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface PortfolioProject {
  id: string;
  name: string;
  description: string | null;
  form_name: string | null;
  created_at: string;
  alertCount: number;
  criticalAlerts: number;
  thresholdCount: number;
  predictionCount: number;
}

export function PortfolioDashboard() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const { data: perfProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['portfolio-projects', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_projects')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!projectId,
  });

  const { data: allAlerts = [] } = useQuery({
    queryKey: ['portfolio-alerts', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_alerts')
        .select('id, performance_project_id, severity, status')
        .eq('project_id', projectId)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!projectId,
  });

  const { data: allThresholds = [] } = useQuery({
    queryKey: ['portfolio-thresholds', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_thresholds')
        .select('id, performance_project_id, is_active')
        .eq('project_id', projectId)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!projectId,
  });

  const portfolioData: PortfolioProject[] = perfProjects.map((p: any) => {
    const projectAlerts = allAlerts.filter(a => a.performance_project_id === p.id);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      form_name: p.form_name,
      created_at: p.created_at,
      alertCount: projectAlerts.length,
      criticalAlerts: projectAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length,
      thresholdCount: allThresholds.filter(t => t.performance_project_id === p.id).length,
      predictionCount: 0,
    };
  });

  const totalAlerts = allAlerts.length;
  const criticalCount = allAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
  const healthyCount = portfolioData.filter(p => p.criticalAlerts === 0).length;
  const atRiskCount = portfolioData.filter(p => p.criticalAlerts > 0).length;

  // Risk matrix data
  const riskMatrix = [
    { impact: 'Critical', high: 0, medium: 0, low: 0 },
    { impact: 'High', high: 0, medium: 0, low: 0 },
    { impact: 'Medium', high: 0, medium: 0, low: 0 },
    { impact: 'Low', high: 0, medium: 0, low: 0 },
  ];

  allAlerts.forEach(a => {
    const sev = a.severity;
    if (sev === 'critical') riskMatrix[0].high++;
    else if (sev === 'high') riskMatrix[1].medium++;
    else if (sev === 'medium') riskMatrix[2].medium++;
    else riskMatrix[3].low++;
  });

  if (loadingProjects) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (perfProjects.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Portfolio Risk Overview
        </h2>
        <p className="text-xs text-muted-foreground">Cross-project aggregated health and risk status</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Projects</p>
            <p className="text-2xl font-bold text-foreground">{portfolioData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Healthy</p>
            <p className="text-2xl font-bold text-green-600">{healthyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">At Risk</p>
            <p className="text-2xl font-bold text-orange-500">{atRiskCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Active Alerts</p>
            <p className="text-2xl font-bold text-red-500">{totalAlerts}</p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Matrix</CardTitle>
            <CardDescription className="text-xs">Impact vs Likelihood distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 text-xs font-medium">
                <div className="p-2 bg-muted text-muted-foreground">Impact ↓</div>
                <div className="p-2 bg-muted text-center text-red-600">High</div>
                <div className="p-2 bg-muted text-center text-orange-500">Medium</div>
                <div className="p-2 bg-muted text-center text-green-600">Low</div>
              </div>
              {riskMatrix.map((row, i) => (
                <div key={i} className="grid grid-cols-4 text-xs border-t">
                  <div className="p-2 font-medium text-muted-foreground bg-muted/50">{row.impact}</div>
                  <div className={`p-2 text-center font-bold ${row.high > 0 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : ''}`}>
                    {row.high || '-'}
                  </div>
                  <div className={`p-2 text-center font-bold ${row.medium > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' : ''}`}>
                    {row.medium || '-'}
                  </div>
                  <div className={`p-2 text-center font-bold ${row.low > 0 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : ''}`}>
                    {row.low || '-'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Per-Project Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Project Health Status</CardTitle>
            <CardDescription className="text-xs">Individual project risk indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {portfolioData.map(p => {
              const health = p.criticalAlerts > 0 ? 'critical' : p.alertCount > 0 ? 'warning' : 'healthy';
              return (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                  {health === 'healthy' ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> :
                   health === 'critical' ? <XCircle className="h-4 w-4 text-red-500 shrink-0" /> :
                   <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.alertCount} alerts · {p.thresholdCount} thresholds
                    </p>
                  </div>
                  <Badge variant={health === 'healthy' ? 'default' : health === 'critical' ? 'destructive' : 'secondary'}
                    className="text-[10px]">
                    {health === 'healthy' ? 'Healthy' : health === 'critical' ? 'Critical' : 'Warning'}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
