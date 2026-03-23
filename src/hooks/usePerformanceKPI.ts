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
 * Labels match the "Project Performance Analytics Tracker" form exactly.
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
// EXACT FORM FIELD LABELS
// (Project Performance Analytics Tracker)
// ========================
// Page 1 - Basic Info: Project ID, Project Name, Project Type, Business Unit, Client Name, Project Manager, Start Date, End Date (Planned), End Date (Actual), Project Status
// Page 2 - Schedule: Planned Start Date, Planned End Date, Actual Start Date, Actual End Date, Milestone Name, Milestone Planned Date, Milestone Actual Date, Task ID, Task Name, Task Status, Task Delay Days, Schedule Variance (%)
// Page 3 - Cost: Planned Budget, Actual Cost, Cost Variance, Cost Variance (%), Forecasted Cost, Cost Per Task, Resource Cost, Infrastructure Cost, Burn Rate, Earned Value (EV), Planned Value (PV), Actual Cost Value (AC)
// Page 4 - Resource: Resource ID, Resource Name, Role, Skill Set, Allocation (%), Planned Hours, Actual Hours, Utilization (%), Overtime Hours, Productivity Score
// Page 5 - Risk: Risk ID, Risk Description, Risk Category, Risk Probability (%), Risk Impact, Risk Score, Risk Status, Mitigation Plan, Risk Owner
// Page 6 - Issues: Issue ID, Issue Description, Severity, Priority, Issue Status, Created Date, Resolved Date, Resolution Time, Root Cause
// Page 7 - Quality: Defect ID, Defect Type, Defect Severity, Defect Status, Detected Phase, Resolved Phase, Defect Count, Rework Hours, Quality Score
// Page 8 - Change Mgmt: Change Request ID, Change Description, Change Type, Approval Status, Impact on Cost, Impact on Timeline, Change Date
// Page 9 - KPIs: CPI (Cost Performance Index), SPI (Schedule Performance Index), Variance at Completion (VAC), Estimate at Completion (EAC), Estimate to Complete (ETC), On Time Delivery (%), Budget Utilization (%)
// Page 10 - AI: Predicted Delay Days, Predicted Cost Overrun (%), Risk Prediction Score, Anomaly Flag (toggle), Anomaly Type, Confidence Score, Recommendation, Pattern Category
// Page 11 - Audit: Control ID, Compliance Status, Audit Status, Audit Findings, Reviewer Comments, Governance Approval Status, Last Reviewed Date

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

    // Exact form field labels
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
    const statusLower = status.toLowerCase();
    if (statusLower === 'in progress' || statusLower === 'in-progress') active++;
    // COUNT(Project_Status = "Completed")
    if (statusLower === 'completed') completed++;
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

    // Use form's CPI/SPI fields for per-project list, fallback to calculation
    const formCPI = num(resolveField(d, mappings, 'CPI (Cost Performance Index)'));
    const formSPI = num(resolveField(d, mappings, 'SPI (Schedule Performance Index)'));

    projectList.push({
      id: sub.id,
      name: projectName || sub.submission_ref_id || sub.id.slice(0, 8),
      status,
      riskScore,
      cpi: formCPI > 0 ? formCPI : (ac > 0 ? ev / ac : 0),
      spi: formSPI > 0 ? formSPI : (pv > 0 ? ev / pv : 0),
    });
  }

  return {
    totalProjects: total,
    activeProjects: active,
    completedProjects: completed,
    delayedProjects: delayed,
    // On_Time_Delivery (%) = (COUNT(End_Date(Actual) ≤ End_Date(Planned)) / COUNT(Project_ID)) × 100
    onTimeDeliveryRate: total > 0 ? (onTime / total) * 100 : 0,
    portfolioPlannedBudget: sumBudget,
    portfolioActualCost: sumActualCost,
    // Budget_Utilization (%) = (SUM(Actual_Cost) / SUM(Planned_Budget)) × 100
    budgetUtilization: sumBudget > 0 ? (sumActualCost / sumBudget) * 100 : 0,
    // Portfolio_CPI = SUM(EV) / SUM(AC)
    portfolioCPI: sumAC > 0 ? sumEV / sumAC : 0,
    // Portfolio_SPI = SUM(EV) / SUM(PV)
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
  const predCostOverrunField = num(resolveField(d, mappings, 'Predicted Cost Overrun (%)'));

  // Use form's pre-calculated fields first, fallback to formula
  const formCPI = num(resolveField(d, mappings, 'CPI (Cost Performance Index)'));
  const formSPI = num(resolveField(d, mappings, 'SPI (Schedule Performance Index)'));
  const formScheduleVar = num(resolveField(d, mappings, 'Schedule Variance (%)'));
  const formCostVar = num(resolveField(d, mappings, 'Cost Variance'));
  const formCostVarPct = num(resolveField(d, mappings, 'Cost Variance (%)'));
  const formBurnRate = num(resolveField(d, mappings, 'Burn Rate'));

  // CPI = EV / AC (prefer form field)
  const cpi = formCPI > 0 ? formCPI : (ac > 0 ? ev / ac : 0);
  // SPI = EV / PV (prefer form field)
  const spi = formSPI > 0 ? formSPI : (pv > 0 ? ev / pv : 0);
  // Cost_Variance = EV - AC (prefer form field)
  const costVariance = formCostVar !== 0 ? formCostVar : (ev - ac);
  // Cost_Variance (%) = ((EV - AC) / Planned_Budget) × 100 (prefer form field)
  const costVariancePercent = formCostVarPct !== 0 ? formCostVarPct : (plannedBudget > 0 ? ((ev - ac) / plannedBudget) * 100 : 0);

  // Schedule_Variance (%) = ((Actual_End_Date - Planned_End_Date) / (Planned_End_Date - Planned_Start_Date)) × 100
  let scheduleVariancePercent = formScheduleVar;
  if (scheduleVariancePercent === 0 && actualEnd && plannedEnd) {
    const actualDelay = dateDiffDays(actualEnd, plannedEnd);
    const plannedDuration = dateDiffDays(plannedEnd, plannedStart);
    scheduleVariancePercent = plannedDuration > 0 ? (actualDelay / plannedDuration) * 100 : 0;
  }

  // Burn_Rate = Actual_Cost / (Current_Date - Actual_Start_Date) (prefer form field)
  let burnRate = formBurnRate;
  if (burnRate === 0 && actualCost > 0 && actualStart) {
    const projectDuration = Math.max(dateDiffDays(new Date().toISOString(), actualStart), 1);
    burnRate = actualCost / projectDuration;
  }

  // Milestone_Delay_Days = Milestone_Actual_Date - Milestone_Planned_Date
  const milestoneDelayDays = dateDiffDays(milestoneActual, milestonePlanned);

  // Predicted_Cost_Overrun (%) = ((Forecasted_Cost - Planned_Budget) / Planned_Budget) × 100
  let predictedCostOverrunPercent = predCostOverrunField;
  if (predictedCostOverrunPercent === 0 && forecastedCost > 0 && plannedBudget > 0) {
    predictedCostOverrunPercent = ((forecastedCost - plannedBudget) / plannedBudget) * 100;
  }

  // Project_Progress (%) - single record: check task status
  const isCompleted = taskStatus.toLowerCase() === 'completed' ? 1 : 0;
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

  const completedCount = all.filter(k => k.projectProgress === 100).length;

  return {
    // Project_Progress (%) = (COUNT(Task_Status = "Completed") / COUNT(Task_ID)) × 100
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
  let sumUtilization = 0, utilizationCount = 0;
  let sumProductivity = 0, productivityCount = 0;

  for (const sub of submissions) {
    const d = sub.submission_data || {};

    const taskStatus = str(resolveField(d, mappings, 'Task Status')).toLowerCase();
    const taskDelayDays = num(resolveField(d, mappings, 'Task Delay Days'));
    const actualHours = num(resolveField(d, mappings, 'Actual Hours'));
    const plannedHours = num(resolveField(d, mappings, 'Planned Hours'));
    // Form field is "Overtime Hours" — exact match
    const overtimeHours = num(resolveField(d, mappings, 'Overtime Hours'));
    const riskOwner = str(resolveField(d, mappings, 'Risk Owner'));
    const resourceId = str(resolveField(d, mappings, 'Resource ID'));
    const defectCount = num(resolveField(d, mappings, 'Defect Count'));
    // Form field is "Quality Score" — exact match (number type)
    const qualityScoreField = num(resolveField(d, mappings, 'Quality Score'));
    // Form field is "Utilization (%)" — NOT "Resource Utilization (%)"
    const utilizationField = num(resolveField(d, mappings, 'Utilization (%)'));
    // Form field is "Productivity Score" — rating type (1-5)
    const productivityField = num(resolveField(d, mappings, 'Productivity Score'));

    // Assigned_Tasks = COUNT(Task_ID WHERE Resource_ID = Logged_In_User)
    if (!userId || resourceId.toLowerCase().includes(userId.toLowerCase())) {
      assigned++;
    }

    // Completed_Tasks = COUNT(Task_Status = "Completed")
    if (taskStatus === 'completed') completed++;

    totalDelay += taskDelayDays;
    totalActualHours += actualHours;
    totalPlannedHours += plannedHours;
    // Overtime_Hours = Actual_Hours - Planned_Hours (prefer form field)
    totalOvertimeHours += overtimeHours > 0 ? overtimeHours : Math.max(actualHours - plannedHours, 0);

    totalDefects += defectCount;
    totalTasks++;

    // Quality_Score from form field
    if (qualityScoreField > 0) { sumQualityScore += qualityScoreField; qualityCount++; }

    // Utilization (%) from form field
    if (utilizationField > 0) { sumUtilization += utilizationField; utilizationCount++; }

    // Productivity Score from form field
    if (productivityField > 0) { sumProductivity += productivityField; productivityCount++; }

    // Engineering_Risk_Count = COUNT(Risk_Owner = Logged_In_User)
    if (userId && riskOwner && riskOwner.toLowerCase().includes(userId.toLowerCase())) {
      engRisks++;
    }
  }

  // Quality_Score = 100 - ((Defect_Count / COUNT(Task_ID)) × 100)
  // Use form field average if available, otherwise calculate from defects
  const calculatedQuality = totalTasks > 0 ? 100 - ((totalDefects / totalTasks) * 100) : 100;
  const qualityScore = qualityCount > 0 ? sumQualityScore / qualityCount : calculatedQuality;

  // Resource_Utilization (%) = (Actual_Hours / Planned_Hours) × 100
  // Prefer form's "Utilization (%)" field
  const resourceUtilization = utilizationCount > 0
    ? sumUtilization / utilizationCount
    : (totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0);

  // Productivity_Score = Planned_Hours / Actual_Hours
  // Prefer form's "Productivity Score" field (rating 1-5, scale to percentage)
  const productivityScore = productivityCount > 0
    ? sumProductivity / productivityCount
    : (totalActualHours > 0 ? totalPlannedHours / totalActualHours : 0);

  return {
    assignedTasks: assigned,
    completedTasks: completed,
    taskCompletionRate: assigned > 0 ? (completed / assigned) * 100 : 0,
    taskDelayDays: totalDelay,
    resourceUtilization,
    productivityScore,
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
  let sumFormCPI = 0, formCPICount = 0;
  let sumFormEAC = 0, sumFormETC = 0, sumFormVAC = 0;
  let formFinancialCount = 0;
  let sumFormCostPerTask = 0, costPerTaskCount = 0;

  for (const sub of submissions) {
    const d = sub.submission_data || {};
    sumBudget += num(resolveField(d, mappings, 'Planned Budget'));
    sumActual += num(resolveField(d, mappings, 'Actual Cost'));
    sumEV += num(resolveField(d, mappings, 'Earned Value (EV)'));
    sumAC += num(resolveField(d, mappings, 'Actual Cost Value (AC)'));
    sumForecastedCost += num(resolveField(d, mappings, 'Forecasted Cost'));

    // Form has pre-calculated fields
    const formCPI = num(resolveField(d, mappings, 'CPI (Cost Performance Index)'));
    const formEAC = num(resolveField(d, mappings, 'Estimate at Completion (EAC)'));
    const formETC = num(resolveField(d, mappings, 'Estimate to Complete (ETC)'));
    const formVAC = num(resolveField(d, mappings, 'Variance at Completion (VAC)'));
    const formCostPerTask = num(resolveField(d, mappings, 'Cost Per Task'));

    if (formCPI > 0) { sumFormCPI += formCPI; formCPICount++; }
    if (formEAC > 0 || formETC > 0 || formVAC !== 0) {
      sumFormEAC += formEAC;
      sumFormETC += formETC;
      sumFormVAC += formVAC;
      formFinancialCount++;
    }
    if (formCostPerTask > 0) { sumFormCostPerTask += formCostPerTask; costPerTaskCount++; }

    const taskId = str(resolveField(d, mappings, 'Task ID'));
    if (taskId) totalTasks++;
  }

  // CPI = EV / AC (prefer form's CPI average)
  const cpi = formCPICount > 0 ? sumFormCPI / formCPICount : (sumAC > 0 ? sumEV / sumAC : 0);
  // EAC = Planned_Budget / CPI (prefer form's EAC)
  const eac = formFinancialCount > 0 ? sumFormEAC : (cpi > 0 ? sumBudget / cpi : 0);
  // ETC = EAC - Actual_Cost (prefer form's ETC)
  const etc = formFinancialCount > 0 ? sumFormETC : Math.max(eac - sumActual, 0);
  // VAC = Planned_Budget - EAC (prefer form's VAC)
  const vac = formFinancialCount > 0 ? sumFormVAC : (sumBudget - eac);
  // Cost_Per_Task = Actual_Cost / COUNT(Task_ID) (prefer form field)
  const costPerTask = costPerTaskCount > 0 ? sumFormCostPerTask / costPerTaskCount : (totalTasks > 0 ? sumActual / totalTasks : 0);
  // Predicted_Cost_Overrun (%) = ((Forecasted_Cost - Planned_Budget) / Planned_Budget) × 100
  const predictedCostOverrunPercent = sumBudget > 0 && sumForecastedCost > 0
    ? ((sumForecastedCost - sumBudget) / sumBudget) * 100
    : 0;

  return {
    plannedBudget: sumBudget,
    actualCost: sumActual,
    // Budget_Utilization (%) = (Actual_Cost / Planned_Budget) × 100
    budgetUtilization: sumBudget > 0 ? (sumActual / sumBudget) * 100 : 0,
    // Cost_Variance = EV - AC
    costVariance: sumEV - sumAC,
    costPerTask,
    cpi,
    eac,
    etc,
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
    // Form field: "Risk Status" (select)
    const riskStatus = str(resolveField(d, mappings, 'Risk Status')).toLowerCase();
    const riskScore = num(resolveField(d, mappings, 'Risk Score'));
    const issueId = str(resolveField(d, mappings, 'Issue ID'));
    // Form fields: "Created Date", "Resolved Date" (date)
    const createdDate = str(resolveField(d, mappings, 'Created Date'));
    const resolvedDate = str(resolveField(d, mappings, 'Resolved Date'));
    // Form field: "Resolution Time" (number) — direct value in days
    const resolutionTime = num(resolveField(d, mappings, 'Resolution Time'));
    // Form field: "Compliance Status" (select) — e.g., "Compliant", "Non-Compliant", "Partial"
    const complianceStatus = str(resolveField(d, mappings, 'Compliance Status')).toLowerCase();
    // Form field: "Audit Findings" (textarea)
    const auditFindings = str(resolveField(d, mappings, 'Audit Findings'));
    const predDelay = num(resolveField(d, mappings, 'Predicted Delay Days'));
    const predCostOverrun = num(resolveField(d, mappings, 'Predicted Cost Overrun (%)'));
    const riskPredictionScore = num(resolveField(d, mappings, 'Risk Prediction Score'));
    // Form field: "Anomaly Flag" (toggle-switch — boolean true/false)
    const anomalyFlagField = resolveField(d, mappings, 'Anomaly Flag');

    // Total_Risks = COUNT(Risk_ID)
    if (riskId) {
      totalRisks++;
      // Open_Risks = COUNT(Risk_Status = "Open")
      if (riskStatus === 'open') openRisks++;
      // High_Risks = COUNT(Risk_Score > 70)
      if (riskScore > 70) highRisks++;
      else if (riskScore >= 40) mediumRisks++;
      else if (riskScore > 0) lowRisks++;
      if (riskScore > 0) { sumRiskScore += riskScore; riskCount++; }
    }

    // Total_Issues = COUNT(Issue_ID)
    if (issueId) {
      totalIssues++;
      // Average_Resolution_Time = AVG(Resolution_Time) or AVG(Resolved_Date - Created_Date)
      // Prefer the direct "Resolution Time" field
      if (resolutionTime > 0) {
        resolutionTimeSum += resolutionTime;
        resolvedCount++;
      } else if (createdDate && resolvedDate) {
        const days = dateDiffDays(resolvedDate, createdDate);
        if (days >= 0) { resolutionTimeSum += days; resolvedCount++; }
      }
    }

    // Compliance_Status (%) = (Passed_Controls / Total_Controls) × 100
    // Form has "Compliance Status" as select — "Compliant"/"Non-Compliant"/"Partial"
    if (complianceStatus) {
      totalControls++;
      if (complianceStatus === 'compliant' || complianceStatus === 'pass' || complianceStatus === 'passed' || complianceStatus === 'met') {
        passedControls++;
      }
    }

    // Audit_Findings_Count = COUNT(Audit_Findings)
    if (auditFindings && auditFindings.trim().length > 0) auditFindingsCount++;

    // Anomaly_Flag logic:
    // If Predicted_Delay_Days > 7 OR Predicted_Cost_Overrun (%) > 15 OR Risk_Prediction_Score > 75
    // Also check the form's toggle-switch Anomaly Flag
    if (predDelay > 7 || predCostOverrun > 15 || riskPredictionScore > 75) {
      hasAnomaly = true;
    }
    // Handle toggle-switch boolean
    if (anomalyFlagField === true || anomalyFlagField === 'true' || anomalyFlagField === 'Yes') {
      hasAnomaly = true;
    }
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
    complianceStatus: totalControls > 0 ? (passedControls / totalControls) * 100 : 0,
    auditFindingsCount,
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
  // Anomaly_Flag = Yes
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

  // Fetch submissions and AUTO-DETECT field mappings from form_fields table
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

      // AUTO-DETECT: Fetch form field definitions to get field labels directly
      const { data: formFields } = await supabase
        .from('form_fields')
        .select('id, label')
        .eq('form_id', ds.source_form_id)
        .order('field_order', { ascending: true });

      let fieldMappings: FieldMapping[] = [];

      if (formFields && formFields.length > 0) {
        // Auto-generate mappings from form field definitions
        fieldMappings = formFields.map((field) => ({
          formFieldId: field.id,
          formFieldLabel: field.label,
        }));
      }

      // Fallback to manual mappings if form fields not available
      if (fieldMappings.length === 0 && Array.isArray(ds.field_mappings)) {
        fieldMappings = (ds.field_mappings as any[]).map((m: any) => ({
          formFieldId: m.formFieldId || '',
          formFieldLabel: m.formFieldLabel || '',
          mappedTo: m.mappedTo,
        }));
      }

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
