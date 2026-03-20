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

  // Simplified health distribution counts
  const criticalProjectCount = portfolioData.filter(p => p.criticalAlerts > 2).length;
  const warningProjectCount = portfolioData.filter(p => p.criticalAlerts > 0 && p.criticalAlerts <= 2).length;
  const moderateProjectCount = portfolioData.filter(p => p.criticalAlerts === 0 && p.alertCount > 0).length;

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

      {/* Health Distribution + Per-Project Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Health Distribution</CardTitle>
            <CardDescription className="text-xs">Projects grouped by health status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Healthy', count: healthyCount, color: 'bg-emerald-500', total: portfolioData.length },
              { label: 'Moderate', count: moderateProjectCount, color: 'bg-yellow-500', total: portfolioData.length },
              { label: 'Warning', count: warningProjectCount, color: 'bg-orange-500', total: portfolioData.length },
              { label: 'Critical', count: criticalProjectCount, color: 'bg-red-500', total: portfolioData.length },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all`}
                    style={{ width: item.total > 0 ? `${(item.count / item.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
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
