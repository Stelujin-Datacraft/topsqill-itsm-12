import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Brain, UserCog, Database, FileText, BarChart3, Lightbulb, TrendingUp, EyeOff, Settings2, ShieldAlert, Activity, Zap, Target, AlertCircle } from 'lucide-react';
import { usePerformanceKPI, PerformanceRoleType, calculateSeniorManagementKPIs, calculateProjectManagerKPIs, aggregateProjectManagerKPIs, calculateDisciplineEngineerKPIs, calculateFinanceKPIs, calculateRiskGovernanceKPIs, generateKPIAlerts } from '@/hooks/usePerformanceKPI';
import { type PerformanceAlert, type PerformancePrediction, type PerformanceThreshold, type AIAnalysis } from '@/hooks/usePerformanceMonitoring';
import { getSeverityBadgeVariant, getHealthColorClass } from '@/components/performance/utils/severityUtils';
import { SeniorManagementDashboard } from '../kpi-dashboards/SeniorManagementDashboard';
import { ProjectManagerDashboard } from '../kpi-dashboards/ProjectManagerDashboard';
import { DisciplineEngineerDashboard } from '../kpi-dashboards/DisciplineEngineerDashboard';
import { FinanceDashboard } from '../kpi-dashboards/FinanceDashboard';
import { RiskGovernanceDashboard } from '../kpi-dashboards/RiskGovernanceDashboard';
import { RoleAssignmentDialog } from '../kpi-dashboards/RoleAssignmentDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { usePerformanceAuditLog } from '@/hooks/usePerformanceAuditLog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  perfProjectId: string;
  alerts: PerformanceAlert[];
  predictions: PerformancePrediction[];
  thresholds: PerformanceThreshold[];
  loading: boolean;
  onNavigateToThresholds?: () => void;
  selectedRecordId?: string;
  onRecordChange?: (id: string) => void;
}

const ROLE_LABELS: Record<PerformanceRoleType, string> = {
  senior_management: 'Senior Management',
  project_manager: 'Project Manager',
  discipline_engineer: 'Discipline Engineer',
  finance_contract: 'Finance / Contract',
  risk_governance: 'Risk / Governance',
};

const ROLE_ICONS: Record<PerformanceRoleType, string> = {
  senior_management: '👔',
  project_manager: '📋',
  discipline_engineer: '⚙️',
  finance_contract: '💰',
  risk_governance: '🛡️',
};

function useHealthMetrics(alerts: PerformanceAlert[], predictions: PerformancePrediction[], thresholds: PerformanceThreshold[]) {
  return useMemo(() => {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const criticalCount = activeAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
    const totalActive = activeAlerts.length;
    const alertWeight = criticalCount * 25 + (totalActive - criticalCount) * 10;
    const alertHealth = Math.max(0, 100 - Math.min(alertWeight, 100));
    const alertLabel = alertHealth >= 80 ? 'Healthy' : alertHealth >= 50 ? 'At Risk' : 'Critical';
    const alertColor = alertHealth >= 80 ? 'text-emerald-600' : alertHealth >= 50 ? 'text-yellow-600' : 'text-red-600';
    const activeThresholds = thresholds.filter(t => t.is_active).length;
    const coverageScore = Math.min(activeThresholds * 20, 100);
    const coverageLabel = coverageScore >= 60 ? 'Good' : coverageScore >= 20 ? 'Partial' : 'None';
    const coverageColor = coverageScore >= 60 ? 'text-emerald-600' : coverageScore >= 20 ? 'text-yellow-600' : 'text-muted-foreground';
    const timestamps = [
      ...alerts.map(a => new Date(a.created_at).getTime()),
      ...predictions.map(p => new Date(p.created_at).getTime()),
    ];
    const latestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;
    const freshnessLabel = latestTimestamp
      ? formatDistanceToNow(new Date(latestTimestamp), { addSuffix: true })
      : 'No data';
    return { alertHealth, alertLabel, alertColor, coverageScore, coverageLabel, coverageColor, activeThresholds, totalActive, criticalCount, freshnessLabel, latestTimestamp };
  }, [alerts, predictions, thresholds]);
}

export function PerformanceDashboard({ perfProjectId, alerts, predictions, thresholds, loading, onNavigateToThresholds, selectedRecordId: propSelectedRecordId, onRecordChange }: Props) {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const { toast } = useToast();
  const { logAction } = usePerformanceAuditLog(perfProjectId);
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;
  const health = useHealthMetrics(alerts, predictions, thresholds);

  const { userRole, loading: kpiLoading, submissions, mappings } = usePerformanceKPI(perfProjectId);
  const [selectedRole, setSelectedRole] = useState<PerformanceRoleType | null>(null);
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const selectedRecordId = propSelectedRecordId || '';
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [dismissedPredictions, setDismissedPredictions] = useState<Set<number>>(new Set());

  const activeRole = selectedRole || userRole || 'senior_management';
  const isAdmin = userProfile?.role === 'admin';

  const { data: savedAnalysis } = useQuery({
    queryKey: ['perf-analysis-result', projectId, perfProjectId],
    queryFn: async () => {
      if (!projectId || !perfProjectId) return null;
      const { data, error } = await (supabase as any)
        .from('performance_analysis_results')
        .select('analysis_data, submission_id, created_at')
        .eq('project_id', projectId)
        .eq('performance_project_id', perfProjectId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) return null;
      return data[0] as { analysis_data: any; submission_id: string | null; created_at: string };
    },
    enabled: !!projectId && !!perfProjectId,
  });

  useEffect(() => {
    if (savedAnalysis && !aiResult) {
      setAiResult(savedAnalysis.analysis_data as AIAnalysis);
      if (savedAnalysis.submission_id && !propSelectedRecordId) {
        onRecordChange?.(savedAnalysis.submission_id);
      }
    }
  }, [savedAnalysis]);

  useEffect(() => {
    // Only run AI analysis if the selected record changed AND we don't already have a saved result for it
    if (
      propSelectedRecordId &&
      propSelectedRecordId !== savedAnalysis?.submission_id &&
      // For "all records", saved submission_id is null
      !(propSelectedRecordId === '__all__' && savedAnalysis?.submission_id === null)
    ) {
      setAiResult(null);
      runAIAnalysis(propSelectedRecordId);
    }
  }, [propSelectedRecordId, savedAnalysis]);

  const recordOptions = useMemo(() => {
    const options = submissions.map((sub: any) => {
      const data = sub.submission_data || {};
      const nameMapping = mappings.find(m =>
        m.formFieldLabel.toLowerCase().includes('project_name') ||
        m.formFieldLabel.toLowerCase().includes('project name')
      );
      let label = nameMapping ? String(data[nameMapping.formFieldId] || '') : '';
      if (!label) {
        label = Object.values(data).find((v: any) => typeof v === 'string' && v.length > 3 && v.length < 100) as string || '';
      }
      if (typeof label === 'object' && label !== null && 'value' in (label as any)) {
        label = (label as any).value;
      }
      const refId = sub.submission_ref_id || sub.id?.slice(0, 8) || '';
      return { id: sub.id, label: label ? `${refId} — ${label}` : refId };
    });
    return options;
  }, [submissions, mappings]);

  const isAllRecords = selectedRecordId === '__all__';

  const computedKPIs = useMemo(() => {
    if (submissions.length === 0 || !selectedRecordId) return null;

    if (isAllRecords) {
      // Aggregated KPIs across all submissions
      return {
        seniorKPIs: calculateSeniorManagementKPIs(submissions, mappings),
        pmKPIs: aggregateProjectManagerKPIs(submissions, mappings),
        engineerKPIs: calculateDisciplineEngineerKPIs(submissions, mappings, userProfile?.id),
        financeKPIs: calculateFinanceKPIs(submissions, mappings),
        riskKPIs: calculateRiskGovernanceKPIs(submissions, mappings),
        alerts: generateKPIAlerts(submissions, mappings),
      };
    }

    const selectedSub = submissions.find((s: any) => s.id === selectedRecordId);
    if (!selectedSub) return null;
    const singleArr = [selectedSub];
    return {
      seniorKPIs: calculateSeniorManagementKPIs(singleArr, mappings),
      pmKPIs: calculateProjectManagerKPIs((selectedSub.submission_data || {}) as Record<string, any>, mappings),
      engineerKPIs: calculateDisciplineEngineerKPIs(singleArr, mappings, userProfile?.id),
      financeKPIs: calculateFinanceKPIs(singleArr, mappings),
      riskKPIs: calculateRiskGovernanceKPIs(singleArr, mappings),
      alerts: generateKPIAlerts(singleArr, mappings),
    };
  }, [submissions, mappings, selectedRecordId, userProfile?.id, isAllRecords]);

  const runAIAnalysis = async (submissionId: string) => {
    if (!submissionId || !projectId || !perfProjectId) return;
    // For "all records", send a special flag to the edge function
    const isAll = submissionId === '__all__';
    setAiRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          project_id: projectId,
          action: 'analyze',
          performance_project_id: perfProjectId,
          submission_id: isAll ? '__all__' : submissionId,
        },
      });
      if (error) throw new Error(error.message || 'Analysis failed');
      if (data?.error) throw new Error(data.error);
      const result = data as AIAnalysis;
      setAiResult(result);
      setDismissedPredictions(new Set());
      await (supabase as any).from('performance_analysis_results').delete().eq('project_id', projectId).eq('performance_project_id', perfProjectId);
      await (supabase as any).from('performance_analysis_results').insert({
        project_id: projectId, performance_project_id: perfProjectId, submission_id: isAll ? null : submissionId, analysis_data: result, created_by: userProfile?.id,
      });
      queryClient.invalidateQueries({ queryKey: ['perf-analysis-result', projectId, perfProjectId] });
      queryClient.invalidateQueries({ queryKey: ['performance-alerts', projectId, perfProjectId] });
      queryClient.invalidateQueries({ queryKey: ['performance-predictions', projectId, perfProjectId] });
      logAction.mutate({
        action_type: 'analysis_run', action_category: 'analysis',
        title: isAll ? 'AI Analysis executed for all records' : 'AI Analysis executed for record',
        description: isAll ? `All ${submissions.length} records, Risk score: ${result.risk_score}/100` : `Record: ${submissionId}, Risk score: ${result.risk_score}/100`,
        metadata: { risk_score: result.risk_score, health_status: result.health_status, submission_id: submissionId },
      });
      toast({ title: 'AI Analysis Complete', description: isAll ? 'Portfolio-wide insights generated.' : 'Insights generated for the selected record.' });
    } catch (err: any) {
      toast({ title: 'Analysis Failed', description: err.message, variant: 'destructive' });
    } finally {
      setAiRunning(false);
    }
  };

  const handleRecordChange = (value: string) => {
    onRecordChange?.(value);
    setAiResult(null);
    if (value) runAIAnalysis(value);
  };

  const handleDismissPrediction = (index: number) => {
    setDismissedPredictions(prev => { const next = new Set(prev); next.add(index); return next; });
    toast({ title: 'Prediction dismissed' });
  };

  const visiblePredictions = aiResult?.predictions?.filter((_, i) => !dismissedPredictions.has(i)) ?? [];

  if (loading || kpiLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <Database className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium text-foreground">No Data Source Configured</p>
          <p className="text-sm text-muted-foreground">Go to the <strong>Data Sources</strong> tab to configure field mappings first.</p>
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium text-foreground">No Submission Data Found</p>
          <p className="text-sm text-muted-foreground">Data source is configured but no form submissions found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Record & Role Selectors */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Performance Dashboard</CardTitle>
                <CardDescription className="text-xs">KPI metrics & AI-powered analysis</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aiRunning && (
                <Badge className="bg-primary/10 text-primary border-primary/20 animate-pulse gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI Analyzing...
                </Badge>
              )}
              {userRole && (
                <Badge variant="secondary" className="gap-1">
                  {ROLE_ICONS[userRole]} {ROLE_LABELS[userRole]}
                </Badge>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowRoleAssignment(true)}>
                  <UserCog className="h-4 w-4 mr-1" />Roles
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" /> Analyze Record
              </label>
              <Select value={selectedRecordId} onValueChange={handleRecordChange}>
                <SelectTrigger className="w-[320px] border-primary/30 focus:ring-primary/20">
                  <SelectValue placeholder="Select a record to analyze..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__all__">
                    <span className="flex items-center gap-2 font-medium">📊 All Records (Aggregated)</span>
                  </SelectItem>
                  {recordOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> Dashboard View
              </label>
              <Select value={activeRole} onValueChange={(v) => setSelectedRole(v as PerformanceRoleType)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as PerformanceRoleType[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      <span className="flex items-center gap-2">
                        <span>{ROLE_ICONS[role]}</span>{ROLE_LABELS[role]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mb-0.5">
              {selectedRecordId && !aiRunning && (
                <Button variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={() => runAIAnalysis(selectedRecordId)}>
                  <Brain className="h-3.5 w-3.5" />Re-run AI
                </Button>
              )}
              <Badge variant="outline" className="text-xs">
                {isAllRecords ? `All ${submissions.length} records` : selectedRecordId ? '1 record selected' : `${submissions.length} records`}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!selectedRecordId && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <p className="font-semibold text-lg text-foreground">Select a Record to Begin</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md text-center">
              Choose a submission record from the dropdown above to view KPI calculations, AI-powered analysis, predictions, and recommendations.
            </p>
            <Badge variant="secondary" className="mt-4 gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {submissions.length} record{submissions.length !== 1 ? 's' : ''} available
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Health Overview Cards */}
      {selectedRecordId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardContent className="pt-5 pb-4 pl-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Score</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {aiRunning ? '...' : aiResult ? aiResult.risk_score : '—'}
                  </p>
                  {aiResult && (
                    <Badge className={`mt-1.5 text-[10px] ${getHealthColorClass(aiResult.health_status)}`}>
                      {aiResult.health_status?.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${health.alertHealth >= 80 ? 'bg-emerald-500' : health.alertHealth >= 50 ? 'bg-yellow-500' : 'bg-destructive'}`} />
            <CardContent className="pt-5 pb-4 pl-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alert Health</p>
                  <p className={`text-3xl font-bold mt-1 ${health.alertColor}`}>{health.alertLabel}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{health.totalActive} active · {health.criticalCount} critical</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <ShieldAlert className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${health.coverageScore >= 60 ? 'bg-emerald-500' : health.coverageScore >= 20 ? 'bg-yellow-500' : 'bg-muted'}`} />
            <CardContent className="pt-5 pb-4 pl-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Threshold Coverage</p>
                  <p className={`text-3xl font-bold mt-1 ${health.coverageColor}`}>{health.coverageLabel}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{health.activeThresholds} active rule{health.activeThresholds !== 1 ? 's' : ''}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <Settings2 className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-muted" />
            <CardContent className="pt-5 pb-4 pl-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Activity</p>
                  <p className="text-lg font-bold text-foreground mt-1 truncate">{health.freshnessLabel}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{visiblePredictions.length} prediction{visiblePredictions.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPI Dashboard */}
      {computedKPIs && (
        <>
          {activeRole === 'senior_management' && computedKPIs.seniorKPIs && <SeniorManagementDashboard kpis={computedKPIs.seniorKPIs} alerts={computedKPIs.alerts} />}
          {activeRole === 'project_manager' && computedKPIs.pmKPIs && <ProjectManagerDashboard kpis={computedKPIs.pmKPIs} />}
          {activeRole === 'discipline_engineer' && computedKPIs.engineerKPIs && <DisciplineEngineerDashboard kpis={computedKPIs.engineerKPIs} />}
          {activeRole === 'finance_contract' && computedKPIs.financeKPIs && <FinanceDashboard kpis={computedKPIs.financeKPIs} />}
          {activeRole === 'risk_governance' && computedKPIs.riskKPIs && <RiskGovernanceDashboard kpis={computedKPIs.riskKPIs} />}
        </>
      )}

      {/* AI Analysis Results */}
      {selectedRecordId && aiResult && (
        <div className="space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                  AI Analysis Summary
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={getHealthColorClass(aiResult.health_status)}>{aiResult.health_status?.toUpperCase()}</Badge>
                  <Badge variant="outline" className="font-mono">Score: {aiResult.risk_score}/100</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground leading-relaxed">{aiResult.summary}</p>
            </CardContent>
          </Card>

          {visiblePredictions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Predictions
                  <Badge variant="secondary" className="text-[10px] ml-1">{visiblePredictions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.predictions.map((p, i) => {
                  if (dismissedPredictions.has(i)) return null;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group">
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] mt-0.5 shrink-0">
                        {Math.round((p.confidence > 1 ? p.confidence : p.confidence * 100))}%
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{p.type}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                        {p.timeframe && (
                          <Badge variant="outline" className="text-[10px] mt-1.5 gap-1">
                            <Activity className="h-2.5 w-2.5" /> {p.timeframe}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {onNavigateToThresholds && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNavigateToThresholds} title="Create threshold">
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDismissPrediction(i)} title="Dismiss">
                          <EyeOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {aiResult.recommendations?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Recommendations
                  <Badge variant="secondary" className="text-[10px] ml-1">{aiResult.recommendations.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <Badge variant={getSeverityBadgeVariant(rec.priority)} className="text-[10px] mt-0.5 shrink-0 uppercase">{rec.priority}</Badge>
                    <div>
                      <p className="font-medium text-sm text-foreground">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isAdmin && (
        <RoleAssignmentDialog open={showRoleAssignment} onOpenChange={setShowRoleAssignment} perfProjectId={perfProjectId} />
      )}
    </div>
  );
}
