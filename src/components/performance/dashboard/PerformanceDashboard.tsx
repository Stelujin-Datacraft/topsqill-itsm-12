import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Brain, UserCog, Database, FileText, BarChart3, Lightbulb, TrendingUp, EyeOff, Settings2, ShieldAlert, Activity } from 'lucide-react';
import { usePerformanceKPI, PerformanceRoleType, calculateSeniorManagementKPIs, aggregateProjectManagerKPIs, calculateProjectManagerKPIs, calculateDisciplineEngineerKPIs, calculateFinanceKPIs, calculateRiskGovernanceKPIs, generateKPIAlerts } from '@/hooks/usePerformanceKPI';
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

const ROLE_DESCRIPTIONS: Record<PerformanceRoleType, string> = {
  senior_management: 'Portfolio-level view with cross-project analytics',
  project_manager: 'Project schedule, milestones, cost, and task control',
  discipline_engineer: 'Task execution, productivity, and resource utilization',
  finance_contract: 'Budget control, variance analysis, and cost forecasting',
  risk_governance: 'Risk exposure, compliance status, and audit findings',
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
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [dismissedPredictions, setDismissedPredictions] = useState<Set<number>>(new Set());

  const activeRole = selectedRole || userRole || 'senior_management';
  const isAdmin = userProfile?.role === 'admin';

  // Load persisted analysis result
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

  // Restore saved analysis
  useEffect(() => {
    if (savedAnalysis && !aiResult) {
      setAiResult(savedAnalysis.analysis_data as AIAnalysis);
      if (savedAnalysis.submission_id) {
        setSelectedRecordId(savedAnalysis.submission_id);
      }
    }
  }, [savedAnalysis]);

  // Build record options
  const recordOptions = useMemo(() => {
    return submissions.map((sub: any) => {
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
  }, [submissions, mappings]);

  // Compute KPIs based on selected record
  const computedKPIs = useMemo(() => {
    if (submissions.length === 0 || !selectedRecordId) return null;
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
  }, [submissions, mappings, selectedRecordId, userProfile?.id]);

  // Run AI analysis automatically when a specific record is selected
  const runAIAnalysis = async (submissionId: string) => {
    if (!submissionId || !projectId || !perfProjectId) return;
    setAiRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          project_id: projectId,
          action: 'analyze',
          performance_project_id: perfProjectId,
          submission_id: submissionId,
        },
      });
      if (error) throw new Error(error.message || 'Analysis failed');
      if (data?.error) throw new Error(data.error);
      const result = data as AIAnalysis;
      setAiResult(result);
      setDismissedPredictions(new Set());

      // Persist
      await (supabase as any).from('performance_analysis_results').delete().eq('project_id', projectId).eq('performance_project_id', perfProjectId);
      await (supabase as any).from('performance_analysis_results').insert({
        project_id: projectId,
        performance_project_id: perfProjectId,
        submission_id: submissionId,
        analysis_data: result,
        created_by: userProfile?.id,
      });
      queryClient.invalidateQueries({ queryKey: ['perf-analysis-result', projectId, perfProjectId] });
      logAction.mutate({
        action_type: 'analysis_run',
        action_category: 'analysis',
        title: 'AI Analysis executed for record',
        description: `Record: ${submissionId}, Risk score: ${result.risk_score}/100`,
        metadata: { risk_score: result.risk_score, health_status: result.health_status, submission_id: submissionId },
      });
      toast({ title: 'AI Analysis Complete', description: 'Insights generated for the selected record.' });
    } catch (err: any) {
      toast({ title: 'Analysis Failed', description: err.message, variant: 'destructive' });
    } finally {
      setAiRunning(false);
    }
  };

  const handleRecordChange = (value: string) => {
    setSelectedRecordId(value);
    setAiResult(null);
    // Auto-trigger AI for specific records
    if (value && value !== 'all') {
      runAIAnalysis(value);
    }
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

  // No data source configured
  if (mappings.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <Database className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No Data Source Configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to the <strong>Data Sources</strong> tab to configure a form data source with field mappings first.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No submissions
  if (submissions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No Submission Data Found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Data source is configured but no form submissions found.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unified Control Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Performance Dashboard
              </CardTitle>
              <CardDescription>
                KPI metrics & AI-powered analysis — select a record to analyze
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {userRole && (
                <Badge variant="secondary" className="text-xs">
                  Assigned: {ROLE_LABELS[userRole]}
                </Badge>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowRoleAssignment(true)}>
                  <UserCog className="h-4 w-4 mr-1" />
                  Manage Roles
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-end gap-3 flex-wrap">
            {/* Role Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Dashboard View</label>
              <Select value={activeRole} onValueChange={(v) => setSelectedRole(v as PerformanceRoleType)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as PerformanceRoleType[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unified Record Selector */}
            <div className="flex flex-col gap-1 flex-1 min-w-[260px]">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Analyze Record (KPI + AI)
              </label>
              <Select value={selectedRecordId} onValueChange={handleRecordChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a record to analyze..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {recordOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info badges */}
            <div className="flex items-center gap-2 mb-0.5">
              <Badge variant="outline" className="text-xs">
                {selectedRecordId ? 'Single record' : `${submissions.length} records available`}
              </Badge>
              {aiRunning && (
                <Badge variant="secondary" className="text-xs animate-pulse gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI Analyzing...
                </Badge>
              )}
              {selectedRecordId && !aiRunning && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => runAIAnalysis(selectedRecordId)}>
                  <Brain className="h-3.5 w-3.5 mr-1" />
                  Re-run AI
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {ROLE_DESCRIPTIONS[activeRole]}
            {selectedRecordId && ' • AI analysis runs automatically when a record is selected.'}
          </p>
        </CardContent>
      </Card>

      {/* AI Health Overview (only when a specific record is selected) */}
      {selectedRecordId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Risk Score</p>
                  <p className="text-2xl font-bold text-foreground">
                    {aiRunning ? '...' : aiResult ? `${aiResult.risk_score}/100` : '—'}
                  </p>
                  {aiResult && (
                    <Badge className={`mt-1 ${getHealthColorClass(aiResult.health_status)}`}>
                      {aiResult.health_status?.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <Brain className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alert Health</p>
                  <p className={`text-2xl font-bold ${health.alertColor}`}>{health.alertLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">{health.totalActive} active ({health.criticalCount} critical)</p>
                </div>
                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Threshold Coverage</p>
                  <p className={`text-2xl font-bold ${health.coverageColor}`}>{health.coverageLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">{health.activeThresholds} active rule{health.activeThresholds !== 1 ? 's' : ''}</p>
                </div>
                <Settings2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Last Activity</p>
                  <p className="text-lg font-semibold text-foreground truncate">{health.freshnessLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">{visiblePredictions.length} prediction{visiblePredictions.length !== 1 ? 's' : ''}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state when no record selected */}
      {!selectedRecordId && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Select a Record to Analyze</p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a record from the dropdown above to view KPI calculations and AI analysis.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Dashboard Content */}
      {computedKPIs && (
        <>
          {activeRole === 'senior_management' && computedKPIs.seniorKPIs && (
            <SeniorManagementDashboard kpis={computedKPIs.seniorKPIs} alerts={computedKPIs.alerts} />
          )}
          {activeRole === 'project_manager' && computedKPIs.pmKPIs && (
            <ProjectManagerDashboard kpis={computedKPIs.pmKPIs} />
          )}
          {activeRole === 'discipline_engineer' && computedKPIs.engineerKPIs && (
            <DisciplineEngineerDashboard kpis={computedKPIs.engineerKPIs} />
          )}
          {activeRole === 'finance_contract' && computedKPIs.financeKPIs && (
            <FinanceDashboard kpis={computedKPIs.financeKPIs} />
          )}
          {activeRole === 'risk_governance' && computedKPIs.riskKPIs && (
            <RiskGovernanceDashboard kpis={computedKPIs.riskKPIs} />
          )}
        </>
      )}

      {/* AI Analysis Results Section */}
      {selectedRecordId && aiResult && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Analysis Results
              </CardTitle>
              <CardDescription>{aiResult.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Badge className={getHealthColorClass(aiResult.health_status)}>
                  Health: {aiResult.health_status?.toUpperCase()}
                </Badge>
                <Badge variant="outline">Risk Score: {aiResult.risk_score}/100</Badge>
              </div>
            </CardContent>
          </Card>

          {visiblePredictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Predictions ({visiblePredictions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.predictions.map((p, i) => {
                  if (dismissedPredictions.has(i)) return null;
                  return (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 group">
                      <Badge variant="outline" className="text-xs mt-0.5">{Math.round((p.confidence > 1 ? p.confidence : p.confidence * 100))}%</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{p.type}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                        {p.timeframe && <p className="text-xs text-muted-foreground mt-1">Timeframe: {p.timeframe}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {onNavigateToThresholds && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNavigateToThresholds} title="Create threshold rule">
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDismissPrediction(i)} title="Dismiss prediction">
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
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Recommendations ({aiResult.recommendations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <Badge variant={getSeverityBadgeVariant(rec.priority)} className="text-xs mt-0.5">{rec.priority}</Badge>
                    <div>
                      <p className="font-medium text-sm">{rec.title}</p>
                      <p className="text-xs text-muted-foreground">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state when no record selected yet */}
      {!selectedRecordId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">Select a record to begin analysis</p>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a record above to view KPI metrics and trigger automatic AI analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Role Assignment Dialog */}
      {isAdmin && (
        <RoleAssignmentDialog
          open={showRoleAssignment}
          onOpenChange={setShowRoleAssignment}
          perfProjectId={perfProjectId}
        />
      )}
    </div>
  );
}
