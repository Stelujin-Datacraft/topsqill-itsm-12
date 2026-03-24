import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCog, Database, FileText, BarChart3, Brain, TrendingUp, EyeOff, Settings2, ShieldAlert, Activity, Zap, Target, AlertCircle, Lightbulb } from 'lucide-react';
import { useHierarchyKPI } from '@/hooks/useHierarchyKPI';
import { SeniorManagementDashboard } from './SeniorManagementDashboard';
import { ProjectManagerDashboard } from './ProjectManagerDashboard';
import { DisciplineEngineerDashboard } from './DisciplineEngineerDashboard';
import { FinanceDashboard } from './FinanceDashboard';
import { RiskGovernanceDashboard } from './RiskGovernanceDashboard';
import { RoleAssignmentDialog } from './RoleAssignmentDialog';
import { HierarchyDrilldownPanel } from './HierarchyDrilldownPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { usePerformanceAuditLog } from '@/hooks/usePerformanceAuditLog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { getHealthColorClass } from '@/components/performance/utils/severityUtils';
import { type PerformanceAlert, type PerformancePrediction, type PerformanceThreshold, type AIAnalysis } from '@/hooks/usePerformanceMonitoring';

interface Props {
  perfProjectId: string;
  alerts?: PerformanceAlert[];
  predictions?: PerformancePrediction[];
  thresholds?: PerformanceThreshold[];
  selectedRecordId?: string;
  onRecordChange?: (id: string) => void;
  onNavigateToThresholds?: () => void;
}

type RoleType = 'senior_management' | 'project_manager' | 'discipline_engineer' | 'finance_contract' | 'risk_governance';

const ROLE_LABELS: Record<RoleType, string> = {
  senior_management: 'Senior Management',
  project_manager: 'Project Manager',
  discipline_engineer: 'Engineer',
  finance_contract: 'Finance',
  risk_governance: 'Risk / Compliance',
};

const ROLE_ICONS: Record<RoleType, string> = {
  senior_management: '👔',
  project_manager: '📋',
  discipline_engineer: '⚙️',
  finance_contract: '💰',
  risk_governance: '🛡️',
};

const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  senior_management: 'Portfolio-level view with cross-project analytics',
  project_manager: 'Project schedule, milestones, cost, and task control',
  discipline_engineer: 'Task execution, productivity, quality, and utilization',
  finance_contract: 'Budget control, variance analysis, and cost forecasting',
  risk_governance: 'Formula-based risk, delay, and governance metrics',
};

// Formula-based Risk Score calculation (no AI)
function useFormulaRiskScore(kpis: any) {
  return useMemo(() => {
    if (!kpis) return { riskScore: 0, healthStatus: 'Unknown' };

    let score = 0;
    let factors = 0;

    // From senior KPIs: delayed projects ratio
    if (kpis.seniorKPIs) {
      const s = kpis.seniorKPIs;
      if (s.totalProjects > 0) {
        const delayRatio = s.delayedProjects / s.totalProjects;
        score += delayRatio * 100 * 0.25; // 25% weight
        factors++;
      }
      // CPI/SPI deviation
      if (s.portfolioCPI > 0) {
        const cpiRisk = Math.max(0, (1 - s.portfolioCPI) * 100);
        score += Math.min(cpiRisk, 100) * 0.2; // 20% weight
        factors++;
      }
      if (s.portfolioSPI > 0) {
        const spiRisk = Math.max(0, (1 - s.portfolioSPI) * 100);
        score += Math.min(spiRisk, 100) * 0.2; // 20% weight
        factors++;
      }
      // Budget overrun
      if (s.portfolioPlannedBudget > 0) {
        const budgetOverrun = Math.max(0, ((s.portfolioActualCost - s.portfolioPlannedBudget) / s.portfolioPlannedBudget) * 100);
        score += Math.min(budgetOverrun, 100) * 0.15; // 15% weight
        factors++;
      }
      // Predicted delay
      if (s.averagePredictedDelay > 0) {
        score += Math.min(s.averagePredictedDelay * 3, 100) * 0.1; // 10% weight - 3 points per day
        factors++;
      }
      // Predicted cost overrun
      if (s.averagePredictedCostOverrun > 0) {
        score += Math.min(s.averagePredictedCostOverrun, 100) * 0.1; // 10% weight
        factors++;
      }
    }

    const finalScore = factors > 0 ? Math.round(Math.min(score, 100)) : 0;
    const healthStatus = finalScore <= 25 ? 'Healthy' : finalScore <= 50 ? 'At Risk' : finalScore <= 75 ? 'Warning' : 'Critical';

    return { riskScore: finalScore, healthStatus };
  }, [kpis]);
}

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

export function KPIDashboardTab({ perfProjectId, alerts = [], predictions = [], thresholds = [], selectedRecordId: propSelectedRecordId, onRecordChange, onNavigateToThresholds }: Props) {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const { toast } = useToast();
  const { logAction } = usePerformanceAuditLog(perfProjectId);
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;

  const [selectedRole, setSelectedRole] = useState<RoleType>('senior_management');
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [localRecordId, setLocalRecordId] = useState<string>(propSelectedRecordId || '__all__');
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [dismissedPredictions, setDismissedPredictions] = useState<Set<number>>(new Set());

  const selectedRecordId = propSelectedRecordId ?? localRecordId;
  const handleRecordChange = (value: string) => {
    setLocalRecordId(value);
    onRecordChange?.(value);
  };

  const selectedProjectId = selectedRecordId !== '__all__' ? selectedRecordId : undefined;

  const { projects, hierarchy, loading, hierarchyLoading, kpis, recordOptions } = useHierarchyKPI(
    selectedProjectId
  );

  const health = useHealthMetrics(alerts, predictions, thresholds);
  const formulaRisk = useFormulaRiskScore(kpis);
  const isAdmin = userProfile?.role === 'admin';
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const requiresSpecificProject = selectedRole === 'project_manager' || selectedRole === 'discipline_engineer';
  const hasSpecificProject = !!selectedProjectId;

  // Saved AI analysis
  const { data: savedAnalysis, isFetched: savedAnalysisFetched } = useQuery({
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

  const doesMatch = (recordId: string | undefined, saved: typeof savedAnalysis) => {
    if (!recordId || !saved) return false;
    return recordId === '__all__' ? saved.submission_id === null : saved.submission_id === recordId;
  };

  useEffect(() => {
    if (!savedAnalysis) return;
    if (!propSelectedRecordId && savedAnalysis.submission_id) {
      setAiResult(savedAnalysis.analysis_data as AIAnalysis);
      handleRecordChange(savedAnalysis.submission_id);
      return;
    }
    if (doesMatch(selectedRecordId, savedAnalysis)) {
      setAiResult(savedAnalysis.analysis_data as AIAnalysis);
    }
  }, [savedAnalysis]);

  useEffect(() => {
    if (!selectedRecordId || !savedAnalysisFetched) return;
    if (doesMatch(selectedRecordId, savedAnalysis)) return;
    setAiResult(null);
    runAIAnalysis(selectedRecordId);
  }, [selectedRecordId, savedAnalysisFetched]);

  const runAIAnalysis = async (submissionId: string) => {
    if (!submissionId || !projectId || !perfProjectId) return;
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
        project_id: projectId, performance_project_id: perfProjectId,
        submission_id: isAll ? null : submissionId, analysis_data: result, created_by: userProfile?.id,
      });
      queryClient.invalidateQueries({ queryKey: ['perf-analysis-result', projectId, perfProjectId] });
      queryClient.invalidateQueries({ queryKey: ['performance-alerts', projectId, perfProjectId] });
      queryClient.invalidateQueries({ queryKey: ['performance-predictions', projectId, perfProjectId] });
      logAction.mutate({
        action_type: 'analysis_run', action_category: 'analysis',
        title: isAll ? 'AI Analysis executed for all records' : 'AI Analysis executed for record',
        description: `Risk score: ${result.risk_score}/100`,
        metadata: { risk_score: result.risk_score, health_status: result.health_status, submission_id: submissionId },
      });
      toast({ title: 'AI Analysis Complete', description: 'Insights generated.' });
    } catch (err: any) {
      toast({ title: 'Analysis Failed', description: err.message, variant: 'destructive' });
    } finally {
      setAiRunning(false);
    }
  };

  const handleDismissPrediction = (index: number) => {
    setDismissedPredictions(prev => { const next = new Set(prev); next.add(index); return next; });
  };

  const visiblePredictions = aiResult?.predictions?.filter((_, i) => !dismissedPredictions.has(i)) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No Project Records Found</p>
            <p className="text-sm text-muted-foreground mt-1">
              No submissions found in the Projects form. Add project records to see KPI calculations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">KPI Dashboard</CardTitle>
                <CardDescription className="text-xs">
                  Hierarchy drill-down: Projects → WBS → Activities → Tasks → Resources
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aiRunning && (
                <Badge className="bg-primary/10 text-primary border-primary/20 animate-pulse gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />AI Analyzing...
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
            {/* Role Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> Dashboard View
              </label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as RoleType)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as RoleType[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      <span className="flex items-center gap-2">
                        <span>{ROLE_ICONS[role]}</span>{ROLE_LABELS[role]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Record Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" /> Select Project
              </label>
              <Select value={selectedRecordId} onValueChange={handleRecordChange}>
                <SelectTrigger className="w-[320px] border-primary/30 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__all__">
                    <span className="flex items-center gap-2 font-medium">📊 All Projects (Portfolio)</span>
                  </SelectItem>
                  {recordOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mb-0.5">
              {selectedRecordId && !aiRunning && (
                <Button variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={() => runAIAnalysis(selectedRecordId)}>
                  <Brain className="h-3.5 w-3.5" />Re-run AI
                </Button>
              )}
              <Badge variant="outline" className="text-xs">
                {hasSpecificProject ? '1 project selected' : `${projects.length} projects`}
              </Badge>
              {hierarchyLoading && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />Loading linked records...
                </Badge>
              )}
              {hierarchy && !hierarchyLoading && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {hierarchy.wbs.length} WBS · {hierarchy.activities.length} Activities · {hierarchy.tasks.length} Tasks · {hierarchy.resources.length} Resources
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Dashboard Content - PM/Engineer require project selection */}
      {requiresSpecificProject && !hasSpecificProject && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <Database className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Select a Project for Drill-Down</p>
              <p className="text-sm text-muted-foreground mt-1">
                {ROLE_LABELS[selectedRole]} needs linked Task and Resource records from one specific Project.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {kpis && (!requiresSpecificProject || hasSpecificProject) && (
        <>
          {selectedRole === 'senior_management' && kpis.seniorKPIs && (
            <SeniorManagementDashboard kpis={kpis.seniorKPIs} />
          )}
          {selectedRole === 'project_manager' && kpis.pmKPIs && (
            <ProjectManagerDashboard kpis={kpis.pmKPIs} hasHierarchy={!!hierarchy} />
          )}
          {selectedRole === 'discipline_engineer' && kpis.engineerKPIs && (
            <DisciplineEngineerDashboard kpis={kpis.engineerKPIs} hasHierarchy={!!hierarchy} />
          )}
          {selectedRole === 'finance_contract' && kpis.financeKPIs && (
            <FinanceDashboard kpis={kpis.financeKPIs} />
          )}
          {selectedRole === 'risk_governance' && kpis.riskKPIs && (
            <RiskGovernanceDashboard kpis={kpis.riskKPIs} />
          )}
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
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Recommendations
                  <Badge variant="secondary" className="text-[10px] ml-1">{aiResult.recommendations.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <Badge variant="outline" className="text-[10px] mt-0.5 shrink-0 capitalize">{rec.priority}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                      {rec.impact && <p className="text-xs text-primary mt-1">Impact: {rec.impact}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Hierarchy Drill-Down */}
      <HierarchyDrilldownPanel
        selectedProject={selectedProject}
        hierarchy={hierarchy}
        loading={hierarchyLoading}
        kpis={kpis}
        selectedRole={selectedRole}
      />

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
