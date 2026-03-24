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

// ========================
// HELPERS
// ========================

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

/**
 * Resolve a field value from submission data using EXACT label matching.
 * Falls back to includes-based matching if exact match not found.
 */
function resolveField(data: Record<string, any>, mappings: FieldMapping[], label: string): any {
  // Exact match first
  let mapping = mappings.find(m => m.formFieldLabel === label);
  // Fallback: case-insensitive exact
  if (!mapping) mapping = mappings.find(m => m.formFieldLabel.toLowerCase() === label.toLowerCase());
  // Fallback: includes
  if (!mapping) mapping = mappings.find(m => m.formFieldLabel.toLowerCase().includes(label.toLowerCase()));
  if (!mapping) return undefined;
  return data[mapping.formFieldId];
}

function resolveFieldId(mappings: FieldMapping[], label: string): string | null {
  let mapping = mappings.find(m => m.formFieldLabel === label);
  if (!mapping) mapping = mappings.find(m => m.formFieldLabel.toLowerCase() === label.toLowerCase());
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
  portfolioCPI: number;
  portfolioSPI: number;
  averageRiskScore: number;
  averagePredictedDelay: number;
  averagePredictedCostOverrun: number;
  projectList: Array<{ id: string; name: string; status: string; riskScore: number; cpi: number; spi: number; }>;
}

export function calculateSeniorManagementKPIs(submissions: any[], mappings: FieldMapping[]): SeniorManagementKPIs {
  const total = submissions.length;
  let active = 0, completed = 0, delayed = 0, onTime = 0;
  let sumBudget = 0, sumActualCost = 0, sumEV = 0, sumPV = 0, sumAC = 0;
  let sumRisk = 0, riskCount = 0, sumPredDelay = 0, sumPredCostOverrun = 0;
  const projectList: SeniorManagementKPIs['projectList'] = [];

  for (const sub of submissions) {
    const d = sub.submission_data || {};

    // Exact field labels from form
    const status = str(resolveField(d, mappings, 'Project Status'));
    const plannedEnd = str(resolveField(d, mappings, 'End Date (Planned)'));
    const actualEnd = str(resolveField(d, mappings, 'End Date (Actual)'));
    const plannedBudget = num(resolveField(d, mappings, 'Planned Budget'));
    const actualCost = num(resolveField(d, mappings, 'Actual Cost'));
    const ev = num(resolveField(d, mappings, 'Earned Value (EV)'));
    const pv = num(resolveField(d, mappings, 'Planned Value (PV)'));
    const ac = num(resolveField(d, mappings, 'Actual Cost Value (AC)'));
    const riskScore = num(resolveField(d, mappings, 'Risk Score'));
    const predDelay = num(resolveField(d, mappings, 'Predicted Delay Days'));
    const predCostOverrun = num(resolveField(d, mappings, 'Predicted Cost Overrun (%)'));
    const projectName = str(resolveField(d, mappings, 'Project Name'));

    // COUNT(Project_Status = "In Progress")
    if (status.toLowerCase().includes('in progress')) active++;
    // COUNT(Project_Status = "Completed")
    if (status.toLowerCase().includes('completed')) completed++;
    // COUNT(End_Date(Actual) > End_Date(Planned))
    if (actualEnd && plannedEnd && dateDiffDays(actualEnd, plannedEnd) > 0) delayed++;
    // On-time: End_Date(Actual) <= End_Date(Planned)
    if (actualEnd && plannedEnd && dateDiffDays(actualEnd, plannedEnd) <= 0) onTime++;

    // SUM aggregations
    sumBudget += plannedBudget;
    sumActualCost += actualCost;
    sumEV += ev;
    sumPV += pv;
    sumAC += ac;

    if (riskScore > 0) { sumRisk += riskScore; riskCount++; }
    sumPredDelay += predDelay;
    sumPredCostOverrun += predCostOverrun;

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
    // On_Time_Delivery (%) = (COUNT(End_Date(Actual) ≤ End_Date(Planned)) / COUNT(Project_ID)) × 100
    onTimeDeliveryRate: total > 0 ? (onTime / total) * 100 : 0,
    // Portfolio_Planned_Budget = SUM(Planned_Budget)
    portfolioPlannedBudget: sumBudget,
    // Portfolio_Actual_Cost = SUM(Actual_Cost)
    portfolioActualCost: sumActualCost,
    // Budget_Utilization (%) = (SUM(Actual_Cost) / SUM(Planned_Budget)) × 100
    budgetUtilization: sumBudget > 0 ? (sumActualCost / sumBudget) * 100 : 0,
    // Portfolio_CPI = SUM(Earned_Value(EV)) / SUM(Actual_Cost_Value(AC))
    portfolioCPI: sumAC > 0 ? sumEV / sumAC : 0,
    // Portfolio_SPI = SUM(Earned_Value(EV)) / SUM(Planned_Value(PV))
    portfolioSPI: sumPV > 0 ? sumEV / sumPV : 0,
    // Average_Risk_Score = AVG(Risk_Score)
    averageRiskScore: riskCount > 0 ? sumRisk / riskCount : 0,
    // Average_Predicted_Delay = AVG(Predicted_Delay_Days)
    averagePredictedDelay: total > 0 ? sumPredDelay / total : 0,
    // Average_Predicted_Cost_Overrun (%) = AVG(Predicted_Cost_Overrun(%))
    averagePredictedCostOverrun: total > 0 ? sumPredCostOverrun / total : 0,
    projectList,
  };
}

// ========================
// PROJECT MANAGER KPIs
// ========================
export interface ProjectManagerKPIs {
  projectProgress: number;
  delayedTasks: number;
  scheduleVariancePercent: number;
  costVariance: number;
  costVariancePercent: number;
  cpi: number;
  spi: number;
  burnRate: number;
  milestoneDelayDays: number;
  predictedDelayDays: number;
  predictedCostOverrunPercent: number;
}

export function calculateProjectManagerKPIs(submission: Record<string, any>, mappings: FieldMapping[]): ProjectManagerKPIs {
  const d = submission;

  const taskStatus = str(resolveField(d, mappings, 'Task Status'));
  const taskDelayDays = num(resolveField(d, mappings, 'Task Delay Days'));
  const ev = num(resolveField(d, mappings, 'Earned Value (EV)'));
  const pv = num(resolveField(d, mappings, 'Planned Value (PV)'));
  const ac = num(resolveField(d, mappings, 'Actual Cost Value (AC)'));
  const actualCost = num(resolveField(d, mappings, 'Actual Cost'));
  const plannedBudget = num(resolveField(d, mappings, 'Planned Budget'));
  const actualStart = str(resolveField(d, mappings, 'Actual Start Date'));
  const actualEnd = str(resolveField(d, mappings, 'Actual End Date'));
  const plannedEnd = str(resolveField(d, mappings, 'Planned End Date'));
  const plannedStart = str(resolveField(d, mappings, 'Planned Start Date'));
  const milestonePlanned = str(resolveField(d, mappings, 'Milestone Planned Date'));
  const milestoneActual = str(resolveField(d, mappings, 'Milestone Actual Date'));
  const predDelay = num(resolveField(d, mappings, 'Predicted Delay Days'));
  const forecastedCost = num(resolveField(d, mappings, 'Forecasted Cost'));
  const burnRateField = num(resolveField(d, mappings, 'Burn Rate'));

  // CPI = EV / AC
  const cpi = ac > 0 ? ev / ac : 0;
  // SPI = EV / PV
  const spi = pv > 0 ? ev / pv : 0;
  // Cost_Variance = EV - AC
  const costVariance = ev - ac;
  // Cost_Variance (%) = ((EV - AC) / Planned_Budget) × 100
  const costVariancePercent = plannedBudget > 0 ? ((ev - ac) / plannedBudget) * 100 : 0;

  // Schedule_Variance (%) = ((EV - PV) / PV) × 100
  const scheduleVariancePercent = pv > 0 ? ((ev - pv) / pv) * 100 : 0;

  // Burn_Rate = Actual_Cost / (Current_Date - Actual_Start_Date)
  const projectDuration = actualStart ? Math.max(dateDiffDays(new Date().toISOString(), actualStart), 1) : 1;
  const burnRate = burnRateField > 0 ? burnRateField : (actualCost / projectDuration);

  // Milestone_Delay_Days = Milestone_Actual_Date - Milestone_Planned_Date
  const milestoneDelayDays = dateDiffDays(milestoneActual, milestonePlanned);

  // Predicted_Cost_Overrun (%) = ((Forecasted_Cost - Planned_Budget) / Planned_Budget) × 100
  const predictedCostOverrunPercent = plannedBudget > 0 && forecastedCost > 0
    ? ((forecastedCost - plannedBudget) / plannedBudget) * 100
    : num(resolveField(d, mappings, 'Predicted Cost Overrun (%)'));

  // Project_Progress (%) - for single record: check if task is completed
  const isCompleted = taskStatus.toLowerCase().includes('completed') ? 1 : 0;
  // Delayed_Tasks = COUNT(Task_Delay_Days > 0)
  const delayedTasks = taskDelayDays > 0 ? 1 : 0;

  return {
    projectProgress: isCompleted * 100,
    delayedTasks,
    scheduleVariancePercent,
    costVariance,
    costVariancePercent,
    cpi,
    spi,
    burnRate,
    milestoneDelayDays,
    predictedDelayDays: predDelay,
    predictedCostOverrunPercent,
  };
}

// Aggregate PM KPIs across all submissions
export function aggregateProjectManagerKPIs(submissions: any[], mappings: FieldMapping[]): ProjectManagerKPIs {
  const all = submissions.map(s => calculateProjectManagerKPIs(s.submission_data || {}, mappings));
  const total = all.length;
  if (total === 0) return calculateProjectManagerKPIs({}, mappings);

  // Count completed tasks and total tasks across submissions
  const completedCount = all.filter(k => k.projectProgress === 100).length;

  return {
    // Project_Progress (%) = (Completed_Tasks / Total_Tasks) × 100
    projectProgress: total > 0 ? (completedCount / total) * 100 : 0,
    delayedTasks: all.reduce((s, k) => s + k.delayedTasks, 0),
    scheduleVariancePercent: total > 0 ? all.reduce((s, k) => s + k.scheduleVariancePercent, 0) / total : 0,
    costVariance: all.reduce((s, k) => s + k.costVariance, 0),
    costVariancePercent: total > 0 ? all.reduce((s, k) => s + k.costVariancePercent, 0) / total : 0,
    cpi: total > 0 ? all.reduce((s, k) => s + k.cpi, 0) / total : 0,
    spi: total > 0 ? all.reduce((s, k) => s + k.spi, 0) / total : 0,
    burnRate: total > 0 ? all.reduce((s, k) => s + k.burnRate, 0) / total : 0,
    milestoneDelayDays: total > 0 ? all.reduce((s, k) => s + k.milestoneDelayDays, 0) / total : 0,
    predictedDelayDays: total > 0 ? all.reduce((s, k) => s + k.predictedDelayDays, 0) / total : 0,
    predictedCostOverrunPercent: total > 0 ? all.reduce((s, k) => s + k.predictedCostOverrunPercent, 0) / total : 0,
  };
}

// ========================
// DISCIPLINE ENGINEER KPIs
// ========================
export interface DisciplineEngineerKPIs {
  assignedTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  taskDelayDays: number;
  resourceUtilization: number;
  productivityScore: number;
  overtimeHours: number;
  engineeringRiskCount: number;
  qualityScore: number;
}

export function calculateDisciplineEngineerKPIs(submissions: any[], mappings: FieldMapping[], userId?: string): DisciplineEngineerKPIs {
  let assigned = 0, completed = 0;
  let totalDelay = 0;
  let totalActualHours = 0, totalPlannedHours = 0;
  let totalOvertimeHours = 0;
  let engRisks = 0;
  let totalDefects = 0;
  let totalTasks = 0;
  let sumQualityScore = 0;
  let qualityCount = 0;

  for (const sub of submissions) {
    const d = sub.submission_data || {};

    const taskStatus = str(resolveField(d, mappings, 'Task Status')).toLowerCase();
    const taskDelayDays = num(resolveField(d, mappings, 'Task Delay Days'));
    const actualHours = num(resolveField(d, mappings, 'Actual Hours'));
    const plannedHours = num(resolveField(d, mappings, 'Planned Hours'));
    const overtimeHours = num(resolveField(d, mappings, 'Overtime Hours'));
    const riskOwner = str(resolveField(d, mappings, 'Risk Owner'));
    const resourceId = str(resolveField(d, mappings, 'Resource ID'));
    const defectCount = num(resolveField(d, mappings, 'Defect Count'));
    const qualityScoreField = num(resolveField(d, mappings, 'Quality Score'));

    // Assigned_Tasks = COUNT(Task_ID WHERE Resource_ID = Logged_In_User)
    // If no userId filter, count all
    if (!userId || resourceId.toLowerCase().includes(userId.toLowerCase())) {
      assigned++;
    }

    // Completed_Tasks = COUNT(Task_Status = "Completed")
    if (taskStatus.includes('completed')) completed++;

    // Task_Delay_Days = Actual_End_Date - Planned_End_Date (using field directly)
    totalDelay += taskDelayDays;

    totalActualHours += actualHours;
    totalPlannedHours += plannedHours;
    // Overtime_Hours = Actual_Hours - Planned_Hours (use field value if available)
    totalOvertimeHours += overtimeHours > 0 ? overtimeHours : Math.max(actualHours - plannedHours, 0);

    totalDefects += defectCount;
    totalTasks++;

    // Quality_Score from form field
    if (qualityScoreField > 0) { sumQualityScore += qualityScoreField; qualityCount++; }

    // Engineering_Risk_Count = COUNT(Risk_Owner = Logged_In_User)
    if (userId && riskOwner && riskOwner.toLowerCase().includes(userId.toLowerCase())) {
      engRisks++;
    }
  }

  // Quality_Score = 100 - ((Defect_Count / COUNT(Task_ID)) × 100)
  // Use form field average if available, otherwise calculate from defects
  const calculatedQuality = totalTasks > 0 ? 100 - ((totalDefects / totalTasks) * 100) : 100;
  const qualityScore = qualityCount > 0 ? sumQualityScore / qualityCount : calculatedQuality;

  return {
    assignedTasks: assigned,
    completedTasks: completed,
    // Task_Completion_Rate (%) = (Completed / Assigned) × 100
    taskCompletionRate: assigned > 0 ? (completed / assigned) * 100 : 0,
    taskDelayDays: totalDelay,
    // Resource_Utilization (%) = (Actual_Hours / Planned_Hours) × 100
    resourceUtilization: totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0,
    // Productivity_Score = Planned_Hours / Actual_Hours
    productivityScore: totalActualHours > 0 ? totalPlannedHours / totalActualHours : 0,
    // Overtime_Hours = Actual_Hours - Planned_Hours
    overtimeHours: totalOvertimeHours,
    engineeringRiskCount: engRisks,
    qualityScore,
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
  costPerTask: number;
  cpi: number;
  eac: number;
  etc: number;
  vac: number;
  predictedCostOverrunPercent: number;
}

export function calculateFinanceKPIs(submissions: any[], mappings: FieldMapping[]): FinanceKPIs {
  let sumBudget = 0, sumActual = 0, sumEV = 0, sumAC = 0;
  let totalTasks = 0;
  let sumForecastedCost = 0;

  for (const sub of submissions) {
    const d = sub.submission_data || {};
    sumBudget += num(resolveField(d, mappings, 'Planned Budget'));
    sumActual += num(resolveField(d, mappings, 'Actual Cost'));
    sumEV += num(resolveField(d, mappings, 'Earned Value (EV)'));
    sumAC += num(resolveField(d, mappings, 'Actual Cost Value (AC)'));
    sumForecastedCost += num(resolveField(d, mappings, 'Forecasted Cost'));
    const taskId = str(resolveField(d, mappings, 'Task ID'));
    if (taskId) totalTasks++;
  }

  // CPI = EV / AC
  const cpi = sumAC > 0 ? sumEV / sumAC : 0;
  // EAC = Planned_Budget / CPI
  const eac = cpi > 0 ? sumBudget / cpi : 0;
  // ETC = EAC - Actual_Cost
  const etc = eac - sumActual;
  // VAC = Planned_Budget - EAC
  const vac = sumBudget - eac;
  // Cost_Per_Task = Actual_Cost / COUNT(Task_ID)
  const costPerTask = totalTasks > 0 ? sumActual / totalTasks : 0;
  // Predicted_Cost_Overrun (%) = ((Forecasted_Cost - Planned_Budget) / Planned_Budget) × 100
  const predictedCostOverrunPercent = sumBudget > 0 && sumForecastedCost > 0
    ? ((sumForecastedCost - sumBudget) / sumBudget) * 100
    : 0;

  return {
    // Planned_Budget = SUM(Planned_Budget)
    plannedBudget: sumBudget,
    // Actual_Cost = SUM(Actual_Cost)
    actualCost: sumActual,
    // Budget_Utilization (%) = (Actual_Cost / Planned_Budget) × 100
    budgetUtilization: sumBudget > 0 ? (sumActual / sumBudget) * 100 : 0,
    // Cost_Variance = EV - AC
    costVariance: sumEV - sumAC,
    costPerTask,
    cpi,
    eac,
    etc: Math.max(etc, 0),
    vac,
    predictedCostOverrunPercent,
  };
}

// ========================
// RISK / GOVERNANCE KPIs
// ========================
export interface RiskGovernanceKPIs {
  totalRisks: number;
  openRisks: number;
  highRisks: number;
  averageRiskScore: number;
  totalIssues: number;
  avgResolutionTime: number;
  complianceStatus: number;
  auditFindingsCount: number;
  anomalyFlag: string;
  // Keep distribution for UI
  mediumRisks: number;
  lowRisks: number;
}

export function calculateRiskGovernanceKPIs(submissions: any[], mappings: FieldMapping[]): RiskGovernanceKPIs {
  let totalRisks = 0, openRisks = 0, highRisks = 0, mediumRisks = 0, lowRisks = 0;
  let sumRiskScore = 0, riskCount = 0;
  let totalIssues = 0, resolutionTimeSum = 0, resolvedCount = 0;
  let passedControls = 0, totalControls = 0;
  let auditFindingsCount = 0;
  let hasAnomaly = false;

  for (const sub of submissions) {
    const d = sub.submission_data || {};

    const riskId = str(resolveField(d, mappings, 'Risk ID'));
    const riskStatus = str(resolveField(d, mappings, 'Risk Status')).toLowerCase();
    const riskScore = num(resolveField(d, mappings, 'Risk Score'));
    const issueId = str(resolveField(d, mappings, 'Issue ID'));
    const createdDate = str(resolveField(d, mappings, 'Created Date'));
    const resolvedDate = str(resolveField(d, mappings, 'Resolved Date'));
    const complianceStatus = str(resolveField(d, mappings, 'Compliance Status')).toLowerCase();
    const auditFindings = str(resolveField(d, mappings, 'Audit Findings'));
    const predDelay = num(resolveField(d, mappings, 'Predicted Delay Days'));
    const predCostOverrun = num(resolveField(d, mappings, 'Predicted Cost Overrun (%)'));
    const riskPredictionScore = num(resolveField(d, mappings, 'Risk Prediction Score'));

    // Total_Risks = COUNT(Risk_ID)
    if (riskId) {
      totalRisks++;
      // Open_Risks = COUNT(Risk_Status = "Open")
      if (riskStatus.includes('open')) openRisks++;
      // High_Risks = COUNT(Risk_Score > 70)
      if (riskScore > 70) highRisks++;
      else if (riskScore >= 40) mediumRisks++;
      else if (riskScore > 0) lowRisks++;
      if (riskScore > 0) { sumRiskScore += riskScore; riskCount++; }
    }

    // Total_Issues = COUNT(Issue_ID)
    if (issueId) {
      totalIssues++;
      // Average_Resolution_Time = AVG(Resolved_Date - Created_Date)
      if (createdDate && resolvedDate) {
        const days = dateDiffDays(resolvedDate, createdDate);
        if (days >= 0) { resolutionTimeSum += days; resolvedCount++; }
      }
    }

    // Compliance_Status (%) = (Passed_Controls / Total_Controls) × 100
    if (complianceStatus) {
      totalControls++;
      if (complianceStatus.includes('pass') || complianceStatus.includes('compliant') || complianceStatus.includes('met')) {
        passedControls++;
      }
    }

    // Audit_Findings_Count = COUNT(Audit_Findings)
    if (auditFindings && auditFindings.trim().length > 0) auditFindingsCount++;

    // Anomaly_Flag logic
    if (predDelay > 7 || predCostOverrun > 15 || riskPredictionScore > 75) {
      hasAnomaly = true;
    }
  }

  return {
    totalRisks,
    openRisks,
    highRisks,
    mediumRisks,
    lowRisks,
    // Average_Risk_Score = AVG(Risk_Score)
    averageRiskScore: riskCount > 0 ? sumRiskScore / riskCount : 0,
    totalIssues,
    // Average_Resolution_Time = AVG(Resolved_Date - Created_Date)
    avgResolutionTime: resolvedCount > 0 ? resolutionTimeSum / resolvedCount : 0,
    // Compliance_Status (%) = (Passed_Controls / Total_Controls) × 100
    complianceStatus: totalControls > 0 ? (passedControls / totalControls) * 100 : 0,
    auditFindingsCount,
    // Anomaly_Flag
    anomalyFlag: hasAnomaly ? 'Yes' : 'No',
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

  // SPI < 0.9 → Schedule Risk
  if (senior.portfolioSPI > 0 && senior.portfolioSPI < 0.9) {
    alerts.push({ type: 'schedule_risk', severity: 'critical', title: 'Schedule Risk', description: `Portfolio SPI is ${senior.portfolioSPI.toFixed(2)} (below 0.9)`, value: senior.portfolioSPI, threshold: 0.9 });
  }
  // CPI < 0.9 → Cost Overrun Risk
  if (senior.portfolioCPI > 0 && senior.portfolioCPI < 0.9) {
    alerts.push({ type: 'cost_overrun', severity: 'critical', title: 'Cost Overrun Risk', description: `Portfolio CPI is ${senior.portfolioCPI.toFixed(2)} (below 0.9)`, value: senior.portfolioCPI, threshold: 0.9 });
  }
  // Risk_Score > 70 → High Risk Alert
  if (senior.averageRiskScore > 70) {
    alerts.push({ type: 'high_risk', severity: 'critical', title: 'High Risk Alert', description: `Average Risk Score is ${senior.averageRiskScore.toFixed(1)} (above 70)`, value: senior.averageRiskScore, threshold: 70 });
  }
  // Predicted_Delay_Days > 5 → Delay Warning
  if (senior.averagePredictedDelay > 5) {
    alerts.push({ type: 'delay_warning', severity: 'warning', title: 'Delay Warning', description: `Average predicted delay is ${senior.averagePredictedDelay.toFixed(1)} days`, value: senior.averagePredictedDelay, threshold: 5 });
  }
  // Predicted_Cost_Overrun > 10% → Cost Overrun Warning
  if (senior.averagePredictedCostOverrun > 10) {
    alerts.push({ type: 'cost_overrun_warning', severity: 'warning', title: 'Cost Overrun Warning', description: `Average predicted cost overrun is ${senior.averagePredictedCostOverrun.toFixed(1)}%`, value: senior.averagePredictedCostOverrun, threshold: 10 });
  }
  // Anomaly_Flag = Yes → AI Anomaly Detection Alert
  const riskKpis = calculateRiskGovernanceKPIs(submissions, mappings);
  if (riskKpis.anomalyFlag === 'Yes') {
    alerts.push({ type: 'anomaly', severity: 'warning', title: 'AI Anomaly Detection', description: 'Anomaly detected based on prediction thresholds', value: 1, threshold: 0 });
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
