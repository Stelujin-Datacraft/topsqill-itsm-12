import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';

export type PerformanceRoleType = 'senior_management' | 'project_manager' | 'discipline_engineer' | 'finance_contract' | 'risk_governance';

export interface FieldMapping {
  formFieldId: string;
  formFieldLabel: string;
  mappedTo?: string;
}

// Helper to safely extract numeric value from submission data
function num(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object') {
    if ('amount' in val) return Number(val.amount) || 0;
    if ('value' in val) return Number(val.value) || 0;
    return 0;
  }
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function str(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'value' in val) return String(val.value);
  return String(val);
}

function dateDiffDays(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  return Math.round((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24));
}

// Resolve a field value from submission data using field_mappings
function resolveField(data: Record<string, any>, mappings: FieldMapping[], labelPattern: string | RegExp): any {
  const mapping = mappings.find(m => {
    const label = m.formFieldLabel.toLowerCase();
    if (typeof labelPattern === 'string') {
      return label === labelPattern.toLowerCase() || label.includes(labelPattern.toLowerCase());
    }
    return labelPattern.test(label);
  });
  if (!mapping) return undefined;
  return data[mapping.formFieldId];
}

function resolveFieldId(mappings: FieldMapping[], labelPattern: string | RegExp): string | null {
  const mapping = mappings.find(m => {
    const label = m.formFieldLabel.toLowerCase();
    if (typeof labelPattern === 'string') {
      return label === labelPattern.toLowerCase() || label.includes(labelPattern.toLowerCase());
    }
    return labelPattern.test(label);
  });
  return mapping?.formFieldId || null;
}

// ========================
// SENIOR MANAGEMENT KPIs
// ========================
export interface SeniorManagementKPIs {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  onTimeDeliveryRate: number;
  portfolioPlannedBudget: number;
  portfolioActualCost: number;
  budgetUtilization: number;
  portfolioEV: number;
  portfolioPV: number;
  portfolioAC: number;
  portfolioCPI: number;
  portfolioSPI: number;
  averageRiskScore: number;
  highRiskProjects: number;
  averagePredictedDelay: number;
  averagePredictedCostOverrun: number;
  anomalyProjects: number;
  projectList: Array<{ id: string; name: string; status: string; riskScore: number; cpi: number; spi: number; }>;
}

export function calculateSeniorManagementKPIs(submissions: any[], mappings: FieldMapping[]): SeniorManagementKPIs {
  const total = submissions.length;
  let active = 0, completed = 0, delayed = 0, onTime = 0;
  let sumBudget = 0, sumActualCost = 0, sumEV = 0, sumPV = 0, sumAC = 0;
  let sumRisk = 0, highRisk = 0, sumPredDelay = 0, sumPredCostOverrun = 0, anomalyCount = 0;
  let riskCount = 0;
  const projectList: SeniorManagementKPIs['projectList'] = [];

  for (const sub of submissions) {
    const d = sub.submission_data || {};
    
    const status = str(resolveField(d, mappings, 'project_status'));
    const plannedEnd = str(resolveField(d, mappings, /end.*planned|planned.*end/));
    const actualEnd = str(resolveField(d, mappings, /end.*actual|actual.*end/));
    const plannedBudget = num(resolveField(d, mappings, 'planned_budget'));
    const actualCost = num(resolveField(d, mappings, 'actual_cost'));
    const ev = num(resolveField(d, mappings, /earned.*value/));
    const pv = num(resolveField(d, mappings, /planned.*value/));
    const ac = num(resolveField(d, mappings, /actual.*cost.*value/));
    const riskScore = num(resolveField(d, mappings, 'risk_score'));
    const predDelay = num(resolveField(d, mappings, /predicted.*delay/));
    const predCostOverrun = num(resolveField(d, mappings, /predicted.*cost.*overrun/));
    const anomalyFlag = str(resolveField(d, mappings, /anomaly.*flag/));
    const projectName = str(resolveField(d, mappings, 'project_name'));

    if (status.toLowerCase().includes('in progress')) active++;
    if (status.toLowerCase().includes('completed')) {
      completed++;
      if (actualEnd && plannedEnd && dateDiffDays(actualEnd, plannedEnd) <= 0) onTime++;
    }
    if (actualEnd && plannedEnd && dateDiffDays(actualEnd, plannedEnd) > 0) delayed++;

    sumBudget += plannedBudget;
    sumActualCost += actualCost;
    sumEV += ev;
    sumPV += pv;
    sumAC += ac;
    
    if (riskScore > 0) { sumRisk += riskScore; riskCount++; }
    if (riskScore > 70) highRisk++;
    sumPredDelay += predDelay;
    sumPredCostOverrun += predCostOverrun;
    if (anomalyFlag.toLowerCase() === 'yes') anomalyCount++;

    projectList.push({
      id: sub.id,
      name: projectName || sub.submission_ref_id || sub.id.slice(0, 8),
      status,
      riskScore,
      cpi: ac > 0 ? ev / ac : 0,
      spi: pv > 0 ? ev / pv : 0,
    });
  }

  return {
    totalProjects: total,
    activeProjects: active,
    completedProjects: completed,
    delayedProjects: delayed,
    onTimeDeliveryRate: completed > 0 ? (onTime / completed) * 100 : 0,
    portfolioPlannedBudget: sumBudget,
    portfolioActualCost: sumActualCost,
    budgetUtilization: sumBudget > 0 ? (sumActualCost / sumBudget) * 100 : 0,
    portfolioEV: sumEV,
    portfolioPV: sumPV,
    portfolioAC: sumAC,
    portfolioCPI: sumAC > 0 ? sumEV / sumAC : 0,
    portfolioSPI: sumPV > 0 ? sumEV / sumPV : 0,
    averageRiskScore: riskCount > 0 ? sumRisk / riskCount : 0,
    highRiskProjects: highRisk,
    averagePredictedDelay: total > 0 ? sumPredDelay / total : 0,
    averagePredictedCostOverrun: total > 0 ? sumPredCostOverrun / total : 0,
    anomalyProjects: anomalyCount,
    projectList,
  };
}

// ========================
// PROJECT MANAGER KPIs
// ========================
export interface ProjectManagerKPIs {
  projectProgress: number;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  scheduleVariance: number;
  spi: number;
  costVariance: number;
  cpi: number;
  milestoneCompletionRate: number;
  milestoneDelayDays: number;
  burnRate: number;
  projectDuration: number;
  riskExposure: number;
  predictedDelay: number;
  predictedCostOverrun: number;
  openIssues: number;
}

export function calculateProjectManagerKPIs(submission: Record<string, any>, mappings: FieldMapping[]): ProjectManagerKPIs {
  const d = submission;

  const totalTasks = num(resolveField(d, mappings, 'total_tasks'));
  const completedTasks = num(resolveField(d, mappings, 'completed_tasks'));
  const taskDelayDays = num(resolveField(d, mappings, /task.*delay.*days/));
  const delayedTasks = num(resolveField(d, mappings, 'delayed_tasks'));
  const ev = num(resolveField(d, mappings, /earned.*value/));
  const pv = num(resolveField(d, mappings, /planned.*value/));
  const ac = num(resolveField(d, mappings, /actual.*cost.*value/));
  const actualCost = num(resolveField(d, mappings, 'actual_cost'));
  const actualStart = str(resolveField(d, mappings, /actual.*start/));
  const riskScore = num(resolveField(d, mappings, 'risk_score'));
  const predDelay = num(resolveField(d, mappings, /predicted.*delay/));
  const predCostOverrun = num(resolveField(d, mappings, /predicted.*cost.*overrun/));
  const burnRate = num(resolveField(d, mappings, 'burn_rate'));

  // Milestone fields
  const completedMilestones = num(resolveField(d, mappings, 'completed_milestones'));
  const totalMilestones = num(resolveField(d, mappings, 'total_milestones'));
  const milestonePlanned = str(resolveField(d, mappings, /milestone.*planned/));
  const milestoneActual = str(resolveField(d, mappings, /milestone.*actual/));

  // Open issues
  const openIssues = num(resolveField(d, mappings, 'open_issues'));

  const spi = pv > 0 ? ev / pv : 0;
  const cpi = ac > 0 ? ev / ac : 0;

  const projectDuration = actualStart ? dateDiffDays(new Date().toISOString(), actualStart) : 0;
  const effectiveBurnRate = burnRate > 0 ? burnRate : (projectDuration > 0 ? actualCost / projectDuration : 0);

  // Project_Progress = (Completed_Tasks / Total_Tasks) × 100
  const projectProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Milestone_Completion = (Completed_Milestones / Total_Milestones) × 100
  const milestoneCompletionRate = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  return {
    projectProgress,
    totalTasks,
    completedTasks,
    delayedTasks: delayedTasks || (taskDelayDays > 0 ? 1 : 0),
    scheduleVariance: ev - pv,
    spi,
    costVariance: ev - ac,
    cpi,
    milestoneCompletionRate,
    milestoneDelayDays: dateDiffDays(milestoneActual, milestonePlanned),
    burnRate: effectiveBurnRate,
    projectDuration: Math.max(projectDuration, 0),
    riskExposure: riskScore,
    predictedDelay: predDelay,
    predictedCostOverrun: predCostOverrun,
    openIssues,
  };
}

// Aggregate PM KPIs across all submissions (portfolio of tasks within a project)
export function aggregateProjectManagerKPIs(submissions: any[], mappings: FieldMapping[]): ProjectManagerKPIs {
  const all = submissions.map(s => calculateProjectManagerKPIs(s.submission_data || {}, mappings));
  const total = all.length;
  if (total === 0) return calculateProjectManagerKPIs({}, mappings);

  const completedTasks = all.reduce((s, k) => s + k.completedTasks, 0);
  const totalTasks = total;
  const sumEV = all.reduce((s, k) => s + (k.spi * (k.costVariance + k.cpi > 0 ? 1 : 0)), 0);

  return {
    projectProgress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
    totalTasks,
    completedTasks,
    delayedTasks: all.reduce((s, k) => s + k.delayedTasks, 0),
    scheduleVariance: all.reduce((s, k) => s + k.scheduleVariance, 0),
    spi: all.reduce((s, k) => s + k.spi, 0) / total,
    costVariance: all.reduce((s, k) => s + k.costVariance, 0),
    cpi: all.reduce((s, k) => s + k.cpi, 0) / total,
    milestoneCompletionRate: all.reduce((s, k) => s + k.milestoneCompletionRate, 0) / total,
    milestoneDelayDays: all.reduce((s, k) => s + k.milestoneDelayDays, 0) / total,
    burnRate: all.reduce((s, k) => s + k.burnRate, 0) / total,
    projectDuration: Math.max(...all.map(k => k.projectDuration), 0),
    riskExposure: all.reduce((s, k) => s + k.riskExposure, 0) / total,
    predictedDelay: all.reduce((s, k) => s + k.predictedDelay, 0) / total,
    predictedCostOverrun: all.reduce((s, k) => s + k.predictedCostOverrun, 0) / total,
    openIssues: all.reduce((s, k) => s + k.openIssues, 0),
  };
}

// ========================
// DISCIPLINE ENGINEER KPIs
// ========================
export interface DisciplineEngineerKPIs {
  assignedTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  pendingTasks: number;
  blockedTasks: number;
  taskDelayDays: number;
  averageTaskDelay: number;
  resourceUtilization: number;
  productivityScore: number;
  overtimeHours: number;
  engineeringRiskCount: number;
}

export function calculateDisciplineEngineerKPIs(submissions: any[], mappings: FieldMapping[], userId?: string): DisciplineEngineerKPIs {
  let assigned = 0, completed = 0, pending = 0, blocked = 0;
  let totalDelay = 0, delayCount = 0;
  let totalActualHours = 0, totalPlannedHours = 0;
  let engRisks = 0;

  for (const sub of submissions) {
    const d = sub.submission_data || {};
    const taskStatus = str(resolveField(d, mappings, 'task_status')).toLowerCase();
    const delayDays = num(resolveField(d, mappings, /task.*delay/));
    const actualHours = num(resolveField(d, mappings, 'actual_hours'));
    const plannedHours = num(resolveField(d, mappings, 'planned_hours'));
    const riskOwner = str(resolveField(d, mappings, 'risk_owner'));

    assigned++;
    if (taskStatus.includes('completed')) completed++;
    if (taskStatus.includes('pending')) pending++;
    if (taskStatus.includes('blocked')) blocked++;
    if (delayDays > 0) { totalDelay += delayDays; delayCount++; }
    totalActualHours += actualHours;
    totalPlannedHours += plannedHours;
    
    // Check if risk owner matches current user (simple check)
    if (userId && riskOwner && riskOwner.toLowerCase().includes(userId.toLowerCase())) {
      engRisks++;
    }
  }

  return {
    assignedTasks: assigned,
    completedTasks: completed,
    taskCompletionRate: assigned > 0 ? (completed / assigned) * 100 : 0,
    pendingTasks: pending,
    blockedTasks: blocked,
    taskDelayDays: totalDelay,
    averageTaskDelay: delayCount > 0 ? totalDelay / delayCount : 0,
    resourceUtilization: totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0,
    productivityScore: totalActualHours > 0 ? totalPlannedHours / totalActualHours : 0,
    overtimeHours: Math.max(totalActualHours - totalPlannedHours, 0),
    engineeringRiskCount: engRisks,
  };
}

// ========================
// FINANCE / CONTRACT KPIs
// ========================
export interface FinanceKPIs {
  plannedBudget: number;
  actualCost: number;
  budgetUtilization: number;
  costVariance: number;
  costVariancePercent: number;
  cpi: number;
  eac: number;
  etc: number;
  vac: number;
  burnRate: number;
  forecastCostOverrun: number;
}

export function calculateFinanceKPIs(submissions: any[], mappings: FieldMapping[]): FinanceKPIs {
  let sumBudget = 0, sumActual = 0, sumEV = 0, sumAC = 0;
  let totalDuration = 0, durationCount = 0;

  for (const sub of submissions) {
    const d = sub.submission_data || {};
    sumBudget += num(resolveField(d, mappings, 'planned_budget'));
    sumActual += num(resolveField(d, mappings, 'actual_cost'));
    sumEV += num(resolveField(d, mappings, /earned.*value/));
    sumAC += num(resolveField(d, mappings, /actual.*cost.*value/));
    
    const actualStart = str(resolveField(d, mappings, /actual.*start/));
    if (actualStart) {
      const dur = dateDiffDays(new Date().toISOString(), actualStart);
      if (dur > 0) { totalDuration += dur; durationCount++; }
    }
  }

  const bac = sumBudget;
  const cpi = sumAC > 0 ? sumEV / sumAC : 0;
  const eac = cpi > 0 ? bac / cpi : 0;
  const etc = eac - sumActual;
  const vac = bac - eac;
  const avgDuration = durationCount > 0 ? totalDuration / durationCount : 1;
  const burnRate = avgDuration > 0 ? sumActual / avgDuration : 0;

  return {
    plannedBudget: sumBudget,
    actualCost: sumActual,
    budgetUtilization: sumBudget > 0 ? (sumActual / sumBudget) * 100 : 0,
    costVariance: sumEV - sumAC,
    costVariancePercent: sumBudget > 0 ? ((sumEV - sumAC) / sumBudget) * 100 : 0,
    cpi,
    eac,
    etc: Math.max(etc, 0),
    vac,
    burnRate,
    forecastCostOverrun: eac - bac,
  };
}

// ========================
// RISK / GOVERNANCE KPIs
// ========================
export interface RiskGovernanceKPIs {
  totalRisks: number;
  openRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  averageRiskScore: number;
  totalIssues: number;
  avgResolutionTime: number;
  complianceScore: number;
  auditFindingsCount: number;
}

export function calculateRiskGovernanceKPIs(submissions: any[], mappings: FieldMapping[]): RiskGovernanceKPIs {
  let totalRisks = 0, openRisks = 0, highRisks = 0, mediumRisks = 0, lowRisks = 0;
  let sumRiskScore = 0, riskCount = 0;
  let totalIssues = 0, resolutionTimeSum = 0, resolvedCount = 0;
  let passedControls = 0, totalControls = 0;
  let auditFindingsCount = 0;

  for (const sub of submissions) {
    const d = sub.submission_data || {};
    const riskId = str(resolveField(d, mappings, 'risk_id'));
    const riskStatus = str(resolveField(d, mappings, 'risk_status')).toLowerCase();
    const riskScore = num(resolveField(d, mappings, 'risk_score'));
    const issueId = str(resolveField(d, mappings, 'issue_id'));
    const createdDate = str(resolveField(d, mappings, 'created_date'));
    const resolvedDate = str(resolveField(d, mappings, 'resolved_date'));
    const complianceStatus = str(resolveField(d, mappings, /compliance.*status/)).toLowerCase();
    const auditFindings = str(resolveField(d, mappings, 'audit_findings'));

    if (riskId) {
      totalRisks++;
      if (riskStatus.includes('open')) openRisks++;
      if (riskScore > 70) highRisks++;
      else if (riskScore >= 40) mediumRisks++;
      else if (riskScore > 0) lowRisks++;
      if (riskScore > 0) { sumRiskScore += riskScore; riskCount++; }
    }

    if (issueId) {
      totalIssues++;
      if (createdDate && resolvedDate) {
        const days = dateDiffDays(resolvedDate, createdDate);
        if (days >= 0) { resolutionTimeSum += days; resolvedCount++; }
      }
    }

    totalControls++;
    if (complianceStatus.includes('pass') || complianceStatus.includes('compliant')) passedControls++;
    if (auditFindings && auditFindings.length > 0) auditFindingsCount++;
  }

  return {
    totalRisks,
    openRisks,
    highRisks,
    mediumRisks,
    lowRisks,
    averageRiskScore: riskCount > 0 ? sumRiskScore / riskCount : 0,
    totalIssues,
    avgResolutionTime: resolvedCount > 0 ? resolutionTimeSum / resolvedCount : 0,
    complianceScore: totalControls > 0 ? (passedControls / totalControls) * 100 : 0,
    auditFindingsCount,
  };
}

// ========================
// ALERT RULES
// ========================
export interface KPIAlert {
  type: 'schedule_risk' | 'cost_overrun' | 'high_risk' | 'delay_warning' | 'cost_overrun_warning' | 'anomaly';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  value: number;
  threshold: number;
}

export function generateKPIAlerts(submissions: any[], mappings: FieldMapping[]): KPIAlert[] {
  const alerts: KPIAlert[] = [];
  const senior = calculateSeniorManagementKPIs(submissions, mappings);

  if (senior.portfolioSPI > 0 && senior.portfolioSPI < 0.9) {
    alerts.push({ type: 'schedule_risk', severity: 'critical', title: 'Schedule Risk', description: `Portfolio SPI is ${senior.portfolioSPI.toFixed(2)} (below 0.9)`, value: senior.portfolioSPI, threshold: 0.9 });
  }
  if (senior.portfolioCPI > 0 && senior.portfolioCPI < 0.9) {
    alerts.push({ type: 'cost_overrun', severity: 'critical', title: 'Cost Overrun Risk', description: `Portfolio CPI is ${senior.portfolioCPI.toFixed(2)} (below 0.9)`, value: senior.portfolioCPI, threshold: 0.9 });
  }
  if (senior.highRiskProjects > 0) {
    alerts.push({ type: 'high_risk', severity: 'critical', title: 'High Risk Alert', description: `${senior.highRiskProjects} project(s) have Risk Score > 70`, value: senior.highRiskProjects, threshold: 70 });
  }
  if (senior.averagePredictedDelay > 5) {
    alerts.push({ type: 'delay_warning', severity: 'warning', title: 'Delay Warning', description: `Average predicted delay is ${senior.averagePredictedDelay.toFixed(1)} days`, value: senior.averagePredictedDelay, threshold: 5 });
  }
  if (senior.averagePredictedCostOverrun > 10) {
    alerts.push({ type: 'cost_overrun_warning', severity: 'warning', title: 'Cost Overrun Warning', description: `Average predicted cost overrun is ${senior.averagePredictedCostOverrun.toFixed(1)}%`, value: senior.averagePredictedCostOverrun, threshold: 10 });
  }
  if (senior.anomalyProjects > 0) {
    alerts.push({ type: 'anomaly', severity: 'warning', title: 'AI Anomaly Detection', description: `${senior.anomalyProjects} project(s) flagged as anomalies`, value: senior.anomalyProjects, threshold: 0 });
  }

  return alerts;
}

// ========================
// MAIN HOOK
// ========================
export function usePerformanceKPI(perfProjectId?: string) {
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const projectId = currentProject?.id;

  // Fetch user's performance role
  const { data: userRole } = useQuery({
    queryKey: ['perf-user-role', projectId, perfProjectId, userProfile?.id],
    queryFn: async () => {
      if (!projectId || !userProfile?.id) return null;
      const query: any = {
        user_id: userProfile.id,
        project_id: projectId,
      };
      let q = supabase
        .from('performance_user_roles')
        .select('role_type')
        .eq('user_id', userProfile.id)
        .eq('project_id', projectId);
      if (perfProjectId) q = q.eq('performance_project_id', perfProjectId);
      else q = q.is('performance_project_id', null);
      
      const { data, error } = await q.maybeSingle();
      if (error) console.warn('Failed to fetch performance role', error);
      return (data?.role_type as PerformanceRoleType) || null;
    },
    enabled: !!projectId && !!userProfile?.id,
  });

  // Fetch submissions and field mappings
  const { data: kpiData, isLoading } = useQuery({
    queryKey: ['perf-kpi-data', projectId, perfProjectId],
    queryFn: async () => {
      if (!projectId) return null;

      // Get data source with field mappings
      let dsQuery = supabase
        .from('performance_data_sources')
        .select('source_form_id, field_mappings')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .limit(1);
      if (perfProjectId) dsQuery = dsQuery.eq('performance_project_id', perfProjectId);

      const { data: dsList } = await dsQuery;
      if (!dsList || dsList.length === 0) return null;

      const ds = dsList[0];
      const fieldMappings: FieldMapping[] = Array.isArray(ds.field_mappings)
        ? (ds.field_mappings as any[]).map((m: any) => ({
            formFieldId: m.formFieldId || '',
            formFieldLabel: m.formFieldLabel || '',
            mappedTo: m.mappedTo,
          }))
        : [];

      // Fetch all submissions
      const { data: subs } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submission_data, submitted_at')
        .eq('form_id', ds.source_form_id)
        .order('submitted_at', { ascending: false })
        .limit(500);

      return {
        submissions: subs || [],
        fieldMappings,
      };
    },
    enabled: !!projectId,
  });

  const submissions = kpiData?.submissions || [];
  const mappings = kpiData?.fieldMappings || [];

  return {
    userRole: userRole || (userProfile?.role === 'admin' ? 'senior_management' as PerformanceRoleType : null),
    submissions,
    mappings,
    loading: isLoading,
    seniorKPIs: submissions.length > 0 ? calculateSeniorManagementKPIs(submissions, mappings) : null,
    pmKPIs: submissions.length > 0 ? aggregateProjectManagerKPIs(submissions, mappings) : null,
    engineerKPIs: submissions.length > 0 ? calculateDisciplineEngineerKPIs(submissions, mappings, userProfile?.id) : null,
    financeKPIs: submissions.length > 0 ? calculateFinanceKPIs(submissions, mappings) : null,
    riskKPIs: submissions.length > 0 ? calculateRiskGovernanceKPIs(submissions, mappings) : null,
    alerts: submissions.length > 0 ? generateKPIAlerts(submissions, mappings) : [],
  };
}
