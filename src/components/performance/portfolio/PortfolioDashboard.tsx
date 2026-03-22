import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Shield, AlertTriangle, CheckCircle2, XCircle, TrendingUp, BarChart3, ShieldAlert, Settings } from 'lucide-react';

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
  riskScore: number;
  hasDataSource: boolean;
  health: 'healthy' | 'moderate' | 'warning' | 'critical' | 'not_configured';
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

  // Fetch data sources to know which projects are configured
  const { data: allDataSources = [] } = useQuery({
    queryKey: ['portfolio-data-sources', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_data_sources')
        .select('id, performance_project_id, is_active')
        .eq('project_id', projectId)
        .eq('is_active', true);
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

  const { data: allPredictions = [] } = useQuery({
    queryKey: ['portfolio-predictions', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_predictions')
        .select('id, performance_project_id')
        .eq('project_id', projectId)
        .limit(200);
      return data || [];
    },
    enabled: !!projectId,
  });

  const portfolioData: PortfolioProject[] = useMemo(() => perfProjects.map((p: any) => {
    const projectAlerts = allAlerts.filter(a => a.performance_project_id === p.id);
    const criticalAlerts = projectAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
    const thresholdCount = allThresholds.filter(t => t.performance_project_id === p.id).length;
    const predictionCount = allPredictions.filter(pr => pr.performance_project_id === p.id).length;
    const hasDataSource = allDataSources.some(ds => ds.performance_project_id === p.id);

    // If no data source is configured, don't assign any risk score
    if (!hasDataSource) {
      return {
        id: p.id, name: p.name, description: p.description, form_name: p.form_name,
        created_at: p.created_at, alertCount: 0, criticalAlerts: 0,
        thresholdCount: 0, predictionCount: 0, riskScore: 0, hasDataSource: false,
        health: 'not_configured' as const,
      };
    }

    // Calculate risk score only for configured projects
    const alertWeight = criticalAlerts * 25 + (projectAlerts.length - criticalAlerts) * 10;
    const coveragePenalty = thresholdCount === 0 ? 15 : 0;
    const riskScore = Math.min(alertWeight + coveragePenalty, 100);
    
    const health: PortfolioProject['health'] = 
      riskScore >= 60 ? 'critical' : 
      riskScore >= 30 ? 'warning' : 
      riskScore > 0 ? 'moderate' : 'healthy';

    return {
      id: p.id, name: p.name, description: p.description, form_name: p.form_name,
      created_at: p.created_at, alertCount: projectAlerts.length, criticalAlerts,
      thresholdCount, predictionCount, riskScore, hasDataSource, health,
    };
  }), [perfProjects, allAlerts, allThresholds, allPredictions, allDataSources]);

  // Portfolio-level aggregations - only consider configured projects
  const configuredProjects = useMemo(() => portfolioData.filter(p => p.hasDataSource), [portfolioData]);
  const notConfiguredCount = useMemo(() => portfolioData.filter(p => !p.hasDataSource).length, [portfolioData]);

  const portfolioRiskScore = useMemo(() => {
    if (configuredProjects.length === 0) return 0;
    return Math.round(configuredProjects.reduce((s, p) => s + p.riskScore, 0) / configuredProjects.length);
  }, [configuredProjects]);

  const totalAlerts = allAlerts.length;
  const criticalCount = allAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
  const healthCounts = useMemo(() => ({
    healthy: portfolioData.filter(p => p.health === 'healthy').length,
    moderate: portfolioData.filter(p => p.health === 'moderate').length,
    warning: portfolioData.filter(p => p.health === 'warning').length,
    critical: portfolioData.filter(p => p.health === 'critical').length,
    not_configured: portfolioData.filter(p => p.health === 'not_configured').length,
  }), [portfolioData]);

  // Governance: projects without monitoring coverage (only from configured ones)
  const unmonitoredCount = configuredProjects.filter(p => p.thresholdCount === 0).length;

  if (loadingProjects) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (perfProjects.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Portfolio Governance & Risk Overview
        </h2>
        <p className="text-xs text-muted-foreground">Cross-project aggregated risk scoring, governance compliance, and health monitoring</p>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Portfolio Risk</p>
            <p className={`text-2xl font-bold ${portfolioRiskScore >= 60 ? 'text-red-600' : portfolioRiskScore >= 30 ? 'text-yellow-600' : 'text-emerald-600'}`}>
              {portfolioRiskScore}/100
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Projects</p>
            <p className="text-2xl font-bold text-foreground">{portfolioData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Active Alerts</p>
            <p className="text-2xl font-bold text-red-500">{totalAlerts}</p>
            <p className="text-[10px] text-muted-foreground">{criticalCount} critical/high</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Unmonitored</p>
            <p className={`text-2xl font-bold ${unmonitoredCount > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>{unmonitoredCount}</p>
            <p className="text-[10px] text-muted-foreground">no threshold rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Predictions</p>
            <p className="text-2xl font-bold text-foreground">{allPredictions.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Health Distribution</CardTitle>
            <CardDescription className="text-xs">Projects grouped by risk level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Healthy', count: healthCounts.healthy, color: 'bg-emerald-500' },
              { label: 'Moderate', count: healthCounts.moderate, color: 'bg-yellow-500' },
              { label: 'Warning', count: healthCounts.warning, color: 'bg-orange-500' },
              { label: 'Critical', count: healthCounts.critical, color: 'bg-red-500' },
              { label: 'Not Configured', count: healthCounts.not_configured, color: 'bg-gray-400' },
            ].filter(item => item.count > 0).map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all`}
                    style={{ width: portfolioData.length > 0 ? `${(item.count / portfolioData.length) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk Matrix */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Risk Matrix
            </CardTitle>
            <CardDescription className="text-xs">Projects by risk score and alert severity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {portfolioData
                .sort((a, b) => b.riskScore - a.riskScore)
                .slice(0, 6)
                .map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                  </div>
                  <div className="w-20 h-2 rounded-full bg-muted overflow-hidden shrink-0">
                    <div
                      className={`h-full rounded-full transition-all ${p.riskScore >= 60 ? 'bg-red-500' : p.riskScore >= 30 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${p.riskScore}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono w-8 text-right text-muted-foreground">{p.riskScore}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Governance Compliance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Governance Compliance
            </CardTitle>
            <CardDescription className="text-xs">Monitoring coverage and control status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">With Thresholds</span>
              <span className="font-medium text-emerald-600">{portfolioData.filter(p => p.thresholdCount > 0).length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Without Thresholds</span>
              <span className={`font-medium ${unmonitoredCount > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>{unmonitoredCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">With Predictions</span>
              <span className="font-medium">{portfolioData.filter(p => p.predictionCount > 0).length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Rules</span>
              <span className="font-medium">{allThresholds.length}</span>
            </div>
            {unmonitoredCount > 0 && (
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs">
                <p className="font-medium text-orange-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {unmonitoredCount} project{unmonitoredCount > 1 ? 's' : ''} without monitoring rules
                </p>
                <p className="text-muted-foreground mt-0.5">Configure thresholds for full governance coverage.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Project Health Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Project Health Status</CardTitle>
          <CardDescription className="text-xs">Individual project risk indicators with governance metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {portfolioData.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
              {p.health === 'healthy' ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> :
               p.health === 'critical' ? <XCircle className="h-4 w-4 text-red-500 shrink-0" /> :
               p.health === 'warning' ? <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" /> :
               <TrendingUp className="h-4 w-4 text-yellow-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.alertCount} alerts · {p.thresholdCount} rules · {p.predictionCount} predictions · Risk: {p.riskScore}/100
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.thresholdCount === 0 && (
                  <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600">Unmonitored</Badge>
                )}
                <Badge variant={p.health === 'healthy' ? 'default' : p.health === 'critical' ? 'destructive' : 'secondary'}
                  className="text-[10px]">
                  {p.health.charAt(0).toUpperCase() + p.health.slice(1)}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
