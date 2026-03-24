import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ========================
// FORM & FIELD ID CONSTANTS
// ========================
export const FORM_IDS = {
  PROJECTS: 'a1000001-0000-0000-0000-000000000001',
  WBS: 'a1000002-0000-0000-0000-000000000001',
  ACTIVITIES: 'a1000003-0000-0000-0000-000000000001',
  TASKS: 'a1000004-0000-0000-0000-000000000001',
  RESOURCES: 'a1000005-0000-0000-0000-000000000001',
} as const;

// Cross-reference field IDs (parent → child link)
export const CROSSREF_FIELDS = {
  PROJECT_TO_WBS: '0340bb1c-a584-44fb-a96e-1beadc4a0ed2',
  WBS_TO_ACTIVITIES: '9a4fe57f-e14c-4840-a39a-7a9e5d17829c',
  ACTIVITY_TO_TASKS: '0678c0b5-38bd-4bdb-987a-1584730c1567',
  TASK_TO_RESOURCES: 'b93457b4-e136-4733-884b-620fd141b63d',
} as const;

// Project field IDs
const PF = {
  Project_ID: 'b1000001-0001-0000-0000-000000000001',
  Project_Name: 'b1000001-0002-0000-0000-000000000001',
  Project_Type: 'b1000001-0003-0000-0000-000000000001',
  Business_Unit: 'b1000001-0004-0000-0000-000000000001',
  Client_Name: 'b1000001-0005-0000-0000-000000000001',
  Project_Manager: 'b1000001-0006-0000-0000-000000000001',
  Start_Date: 'b1000001-0007-0000-0000-000000000001',
  End_Date_Planned: 'b1000001-0008-0000-0000-000000000001',
  End_Date_Actual: 'b1000001-0009-0000-0000-000000000001',
  Project_Status: 'b1000001-0010-0000-0000-000000000001',
  Planned_Budget: 'b1000001-0011-0000-0000-000000000001',
  Actual_Cost: 'b1000001-0012-0000-0000-000000000001',
  Forecasted_Cost: 'b1000001-0013-0000-0000-000000000001',
  Earned_Value: 'b1000001-0014-0000-0000-000000000001',
  Planned_Value: 'b1000001-0015-0000-0000-000000000001',
  Actual_Cost_Value: 'b1000001-0016-0000-0000-000000000001',
  Risk_Score: 'b1000001-0017-0000-0000-000000000001',
  Predicted_Delay_Days: 'b1000001-0018-0000-0000-000000000001',
};

// Task field IDs
const TF = {
  Task_ID: 'b4000001-0001-0000-0000-000000000001',
  Task_Name: 'b4000001-0003-0000-0000-000000000001',
  Task_Status: 'b4000001-0005-0000-0000-000000000001',
  Planned_Start_Date: 'b4000001-0006-0000-0000-000000000001',
  Planned_End_Date: 'b4000001-0007-0000-0000-000000000001',
  Actual_Start_Date: 'b4000001-0008-0000-0000-000000000001',
  Actual_End_Date: 'b4000001-0009-0000-0000-000000000001',
  Planned_Hours: 'b4000001-0010-0000-0000-000000000001',
  Actual_Hours: 'b4000001-0011-0000-0000-000000000001',
  Defect_Count: 'b4000001-0015-0000-0000-000000000001',
};

// Resource field IDs
const RF = {
  Resource_Name: 'b5000001-0004-0000-0000-000000000001',
  Role: 'b5000001-0005-0000-0000-000000000001',
  Allocation: 'b5000001-0007-0000-0000-000000000001',
  Planned_Hours: 'b5000001-0008-0000-0000-000000000001',
  Actual_Hours: 'b5000001-0009-0000-0000-000000000001',
  Overtime_Hours: 'b5000001-0010-0000-0000-000000000001',
};

// Activity field IDs
const AF = {
  Activity_Name: 'b3000001-0003-0000-0000-000000000001',
  Activity_Status: 'b3000001-0010-0000-0000-000000000001',
  Planned_Hours: 'b3000001-0011-0000-0000-000000000001',
  Actual_Hours: 'b3000001-0012-0000-0000-000000000001',
  Cost_Per_Task: 'b3000001-0014-0000-0000-000000000001',
};

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
  if (typeof val === 'object' && 'label' in val) return String(val.label);
  return String(val);
}

function normalizeStatus(val: any): string {
  return str(val).toLowerCase().replace(/[\s_-]+/g, '');
}

function isInProgressStatus(val: any): boolean {
  const normalized = normalizeStatus(val);
  return normalized === 'inprogress' || normalized === 'active' || normalized === 'ongoing';
}

function isCompletedStatus(val: any): boolean {
  const normalized = normalizeStatus(val);
  return normalized === 'completed' || normalized === 'complete' || normalized === 'done' || normalized === 'closed' || normalized === 'finished';
}

function dateDiffDays(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  return Math.round((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24));
}

/** Extract submission_ref_ids from a cross-reference field value */
function extractRefIds(crossRefValue: any): string[] {
  if (!crossRefValue) return [];
  if (Array.isArray(crossRefValue)) {
    return crossRefValue
      .map((item: any) => item?.submission_ref_id || (typeof item === 'string' ? item : null))
      .filter(Boolean);
  }
  if (typeof crossRefValue === 'string') {
    return crossRefValue.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// ========================
// DATA TYPES
// ========================
export interface HierarchyData {
  projects: any[];
  wbsByProject: Map<string, any[]>;
  activitiesByWbs: Map<string, any[]>;
  tasksByActivity: Map<string, any[]>;
  resourcesByTask: Map<string, any[]>;
  // Flattened for selected project
  allWbs: any[];
  allActivities: any[];
  allTasks: any[];
  allResources: any[];
}

// ========================
// KPI INTERFACES
// ========================
export interface HierarchySeniorKPIs {
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
  averagePredictedDelay: number;
  averagePredictedCostOverrun: number;
  projectList: Array<{
    id: string;
    refId: string;
    name: string;
    status: string;
    riskScore: number;
    cpi: number;
    spi: number;
    plannedBudget: number;
    actualCost: number;
  }>;
}

export interface HierarchyPMKPIs {
  projectProgress: number;
  delayedTasks: number;
  totalTasks: number;
  scheduleVariancePercent: number;
  costVariance: number;
  costVariancePercent: number;
  cpi: number;
  spi: number;
  burnRate: number;
  predictedDelayDays: number;
  predictedCostOverrunPercent: number;
}

export interface HierarchyEngineerKPIs {
  assignedTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  taskDelayDays: number;
  resourceUtilization: number;
  productivityScore: number;
  overtimeHours: number;
  qualityScore: number;
}

export interface HierarchyFinanceKPIs {
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

export interface HierarchyRiskKPIs {
  totalProjects: number;
  delayedProjects: number;
  predictedRiskProjects: number;
  averagePredictedDelay: number;
}

// ========================
// KPI CALCULATION FUNCTIONS
// ========================

export function calcSeniorManagementKPIs(projects: any[]): HierarchySeniorKPIs {
  const total = projects.length;
  let active = 0, completed = 0, delayed = 0, onTime = 0;
  let sumBudget = 0, sumActualCost = 0, sumEV = 0, sumPV = 0, sumAC = 0;
  let sumPredDelay = 0, costOverrunCount = 0, sumCostOverrun = 0;
  const projectList: HierarchySeniorKPIs['projectList'] = [];

  for (const sub of projects) {
    const d = sub.submission_data || {};
    const status = d[PF.Project_Status];
    const plannedEnd = str(d[PF.End_Date_Planned]);
    const actualEnd = str(d[PF.End_Date_Actual]);
    const plannedBudget = num(d[PF.Planned_Budget]);
    const actualCost = num(d[PF.Actual_Cost]);
    const ev = num(d[PF.Earned_Value]);
    const pv = num(d[PF.Planned_Value]);
    const ac = num(d[PF.Actual_Cost_Value]);
    const riskScore = num(d[PF.Risk_Score]);
    const predDelay = num(d[PF.Predicted_Delay_Days]);
    const forecastedCost = num(d[PF.Forecasted_Cost]);
    const projectName = str(d[PF.Project_Name]);
    const projectIdValue = str(d[PF.Project_ID]);

    if (isInProgressStatus(status)) active++;
    if (isCompletedStatus(status)) completed++;
    if (actualEnd && plannedEnd && dateDiffDays(actualEnd, plannedEnd) > 0) delayed++;
    if (actualEnd && plannedEnd && dateDiffDays(actualEnd, plannedEnd) <= 0) onTime++;

    sumBudget += plannedBudget;
    sumActualCost += actualCost;
    sumEV += ev;
    sumPV += pv;
    sumAC += ac;
    sumPredDelay += predDelay;

    // Average_Predicted_Cost_Overrun (%) = AVG(((Forecasted_Cost - Planned_Budget) / Planned_Budget) * 100)
    if (plannedBudget > 0) {
      sumCostOverrun += ((forecastedCost - plannedBudget) / plannedBudget) * 100;
      costOverrunCount++;
    }

    projectList.push({
      id: sub.id,
      refId: sub.submission_ref_id || sub.id.slice(0, 8),
      name: projectName || projectIdValue || sub.submission_ref_id || sub.id.slice(0, 8),
      status: str(d[PF.Project_Status]),
      riskScore,
      cpi: ac > 0 ? ev / ac : 0,
      spi: pv > 0 ? ev / pv : 0,
      plannedBudget,
      actualCost,
    });
  }

  return {
    totalProjects: total,
    activeProjects: active,
    completedProjects: completed,
    delayedProjects: delayed,
    onTimeDeliveryRate: total > 0 ? (onTime / total) * 100 : 0,
    portfolioPlannedBudget: sumBudget,
    portfolioActualCost: sumActualCost,
    budgetUtilization: sumBudget > 0 ? (sumActualCost / sumBudget) * 100 : 0,
    portfolioCPI: sumAC > 0 ? sumEV / sumAC : 0,
    portfolioSPI: sumPV > 0 ? sumEV / sumPV : 0,
    averagePredictedDelay: total > 0 ? sumPredDelay / total : 0,
    averagePredictedCostOverrun: costOverrunCount > 0 ? sumCostOverrun / costOverrunCount : 0,
    projectList,
  };
}

export function calcProjectManagerKPIs(projectData: any, tasks: any[]): HierarchyPMKPIs {
  const d = projectData?.submission_data || {};
  const ev = num(d[PF.Earned_Value]);
  const pv = num(d[PF.Planned_Value]);
  const ac = num(d[PF.Actual_Cost_Value]);
  const actualCost = num(d[PF.Actual_Cost]);
  const plannedBudget = num(d[PF.Planned_Budget]);
  const startDate = str(d[PF.Start_Date]);
  const forecastedCost = num(d[PF.Forecasted_Cost]);
  const predDelay = num(d[PF.Predicted_Delay_Days]);

  // Task-based KPIs
  const totalTasks = tasks.length;
  let completedTasks = 0;
  let delayedTasks = 0;

  for (const task of tasks) {
    const td = task.submission_data || {};
    const taskStatus = td[TF.Task_Status];
    const actualEnd = str(td[TF.Actual_End_Date]);
    const plannedEnd = str(td[TF.Planned_End_Date]);

    if (isCompletedStatus(taskStatus)) completedTasks++;
    if (actualEnd && plannedEnd && dateDiffDays(actualEnd, plannedEnd) > 0) delayedTasks++;
  }

  // Project_Progress (%) = (COUNT(Tasks.Task_Status = "Completed") / COUNT(Tasks.Task_ID)) * 100
  const projectProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Schedule_Variance (%) = ((EV - PV) / PV) * 100
  const scheduleVariancePercent = pv > 0 ? ((ev - pv) / pv) * 100 : 0;

  // Cost_Variance = EV - AC
  const costVariance = ev - ac;

  // Cost_Variance (%) = ((EV - AC) / EV) * 100
  const costVariancePercent = ev > 0 ? ((ev - ac) / ev) * 100 : 0;

  // CPI = EV / AC
  const cpi = ac > 0 ? ev / ac : 0;

  // SPI = EV / PV
  const spi = pv > 0 ? ev / pv : 0;

  // Burn_Rate = Actual_Cost / (DAYS_BETWEEN(Current_Date, Start_Date) + 1)
  const projectDuration = startDate ? Math.max(dateDiffDays(new Date().toISOString(), startDate), 0) + 1 : 1;
  const burnRate = actualCost / projectDuration;

  // Predicted_Cost_Overrun (%) = ((Forecasted_Cost or EAC - Planned_Budget) / Planned_Budget) * 100
  const eacVal = cpi > 0 ? plannedBudget / cpi : 0;
  const forecastForOverrun = forecastedCost > 0 ? forecastedCost : eacVal;
  const predictedCostOverrunPercent = plannedBudget > 0 && forecastForOverrun > 0
    ? ((forecastForOverrun - plannedBudget) / plannedBudget) * 100
    : 0;

  return {
    projectProgress,
    delayedTasks,
    totalTasks,
    scheduleVariancePercent,
    costVariance,
    costVariancePercent,
    cpi,
    spi,
    burnRate,
    predictedDelayDays: predDelay,
    predictedCostOverrunPercent,
  };
}

export function calcEngineerKPIs(tasks: any[], resources: any[]): HierarchyEngineerKPIs {
  const totalTasks = tasks.length;
  let completedTasks = 0;
  let totalDelayDays = 0;
  let totalDefects = 0;

  for (const task of tasks) {
    const td = task.submission_data || {};
    const status = td[TF.Task_Status];
    const actualEnd = str(td[TF.Actual_End_Date]);
    const plannedEnd = str(td[TF.Planned_End_Date]);
    const defects = num(td[TF.Defect_Count]);

    if (isCompletedStatus(status)) completedTasks++;
    if (actualEnd && plannedEnd) totalDelayDays += dateDiffDays(actualEnd, plannedEnd);
    totalDefects += defects;
  }

  // Assigned_Tasks = COUNT(Task_ID)
  const assignedTasks = totalTasks;

  // Task_Completion_Rate (%) = (Completed / Total) * 100
  const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Resource metrics from Resource Assignments
  let totalActualHours = 0, totalPlannedHours = 0;

  for (const res of resources) {
    const rd = res.submission_data || {};
    totalActualHours += num(rd[RF.Actual_Hours]);
    totalPlannedHours += num(rd[RF.Planned_Hours]);
  }

  // Resource_Utilization (%) = (Actual_Hours / Planned_Hours) * 100
  const resourceUtilization = totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0;

  // Productivity_Score = Planned_Hours / Actual_Hours
  const productivityScore = totalActualHours > 0 ? totalPlannedHours / totalActualHours : 0;

  // Overtime_Hours = Actual_Hours - Planned_Hours
  const overtimeHours = totalActualHours - totalPlannedHours;

  // Quality_Score = 100 - ((SUM(Defect_Count) / COUNT(Task_ID)) * 100)
  const qualityScore = totalTasks > 0 ? 100 - ((totalDefects / totalTasks) * 100) : 100;

  return {
    assignedTasks,
    completedTasks,
    taskCompletionRate,
    taskDelayDays: totalDelayDays,
    resourceUtilization,
    productivityScore,
    overtimeHours,
    qualityScore: Math.max(qualityScore, 0),
  };
}

export function calcFinanceKPIs(projects: any[], tasks: any[]): HierarchyFinanceKPIs {
  let sumBudget = 0, sumActual = 0, sumEV = 0, sumAC = 0, sumForecastedCost = 0;
  const totalTasks = tasks.length;

  for (const sub of projects) {
    const d = sub.submission_data || {};
    sumBudget += num(d[PF.Planned_Budget]);
    sumActual += num(d[PF.Actual_Cost]);
    sumEV += num(d[PF.Earned_Value]);
    sumAC += num(d[PF.Actual_Cost_Value]);
    sumForecastedCost += num(d[PF.Forecasted_Cost]);
  }

  // CPI = EV / AC
  const cpi = sumAC > 0 ? sumEV / sumAC : 0;
  // EAC = Planned_Budget / CPI
  const eac = cpi > 0 ? sumBudget / cpi : 0;
  // ETC = EAC - Actual_Cost
  const etc = eac - sumActual;
  // VAC = Planned_Budget - EAC
  const vac = sumBudget - eac;
  // Cost_Per_Task = SUM(Actual_Cost) / COUNT(Tasks.Task_ID)
  const costPerTask = totalTasks > 0 ? sumActual / totalTasks : 0;
  // Predicted_Cost_Overrun (%) = ((Forecasted_Cost or EAC - Planned_Budget) / Planned_Budget) * 100
  const forecastForOverrun = sumForecastedCost > 0 ? sumForecastedCost : eac;
  const predictedCostOverrunPercent = sumBudget > 0 && forecastForOverrun > 0
    ? ((forecastForOverrun - sumBudget) / sumBudget) * 100
    : 0;

  return {
    plannedBudget: sumBudget,
    actualCost: sumActual,
    budgetUtilization: sumBudget > 0 ? (sumActual / sumBudget) * 100 : 0,
    costVariance: sumEV - sumAC,
    costPerTask,
    cpi,
    eac,
    etc,
    vac,
    predictedCostOverrunPercent,
  };
}

export function calcRiskKPIs(projects: any[]): HierarchyRiskKPIs {
  const total = projects.length;
  let delayed = 0, predictedRisk = 0;
  let sumPredDelay = 0;

  for (const sub of projects) {
    const d = sub.submission_data || {};
    const actualEnd = str(d[PF.End_Date_Actual]);
    const plannedEnd = str(d[PF.End_Date_Planned]);
    const predDelay = num(d[PF.Predicted_Delay_Days]);

    if (actualEnd && plannedEnd && dateDiffDays(actualEnd, plannedEnd) > 0) delayed++;
    if (predDelay > 0) predictedRisk++;
    sumPredDelay += predDelay;
  }

  return {
    totalProjects: total,
    delayedProjects: delayed,
    predictedRiskProjects: predictedRisk,
    averagePredictedDelay: total > 0 ? sumPredDelay / total : 0,
  };
}

// ========================
// HIERARCHY DATA FETCHER
// ========================

async function fetchLinkedSubmissions(
  formId: string,
  refIds: string[]
): Promise<any[]> {
  if (refIds.length === 0) return [];
  const { data, error } = await supabase
    .from('form_submissions')
    .select('id, submission_ref_id, form_id, submission_data')
    .eq('form_id', formId)
    .in('submission_ref_id', refIds);
  if (error) {
    console.error('Error fetching linked submissions:', error);
    return [];
  }
  return data || [];
}

export async function fetchHierarchyForProject(
  projectSubmission: any
): Promise<{ wbs: any[]; activities: any[]; tasks: any[]; resources: any[] }> {
  const pd = projectSubmission.submission_data || {};

  // Level 1: Projects → WBS
  const wbsRefIds = extractRefIds(pd[CROSSREF_FIELDS.PROJECT_TO_WBS]);
  const wbs = await fetchLinkedSubmissions(FORM_IDS.WBS, wbsRefIds);

  // Level 2: WBS → Activities
  const activityRefIds: string[] = [];
  for (const w of wbs) {
    const wd = w.submission_data || {};
    activityRefIds.push(...extractRefIds(wd[CROSSREF_FIELDS.WBS_TO_ACTIVITIES]));
  }
  const activities = await fetchLinkedSubmissions(FORM_IDS.ACTIVITIES, [...new Set(activityRefIds)]);

  // Level 3: Activities → Tasks
  const taskRefIds: string[] = [];
  for (const a of activities) {
    const ad = a.submission_data || {};
    taskRefIds.push(...extractRefIds(ad[CROSSREF_FIELDS.ACTIVITY_TO_TASKS]));
  }
  const tasks = await fetchLinkedSubmissions(FORM_IDS.TASKS, [...new Set(taskRefIds)]);

  // Level 4: Tasks → Resources
  const resourceRefIds: string[] = [];
  for (const t of tasks) {
    const td = t.submission_data || {};
    resourceRefIds.push(...extractRefIds(td[CROSSREF_FIELDS.TASK_TO_RESOURCES]));
  }
  const resources = await fetchLinkedSubmissions(FORM_IDS.RESOURCES, [...new Set(resourceRefIds)]);

  return { wbs, activities, tasks, resources };
}

// ========================
// MAIN HOOK
// ========================

export function useHierarchyKPI(selectedProjectId?: string) {
  const [projects, setProjects] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<{ wbs: any[]; activities: any[]; tasks: any[]; resources: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);

  // Fetch all project submissions
  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, form_id, submission_data, submitted_at')
        .eq('form_id', FORM_IDS.PROJECTS)
        .order('submitted_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching projects:', error);
        setProjects([]);
      } else {
        setProjects(data || []);
      }
      setLoading(false);
    };
    fetchProjects();
  }, []);

  // Fetch hierarchy when a project is selected
  useEffect(() => {
    if (!selectedProjectId || selectedProjectId === '__all__') {
      setHierarchy(null);
      return;
    }

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    if (!selectedProject) {
      setHierarchy(null);
      return;
    }

    const fetchHierarchy = async () => {
      setHierarchyLoading(true);
      try {
        const result = await fetchHierarchyForProject(selectedProject);
        setHierarchy(result);
      } catch (err) {
        console.error('Error fetching hierarchy:', err);
        setHierarchy(null);
      } finally {
        setHierarchyLoading(false);
      }
    };

    fetchHierarchy();
  }, [selectedProjectId, projects]);

  // Compute KPIs
  const kpis = useMemo(() => {
    if (projects.length === 0) return null;

    const selectedProject = (selectedProjectId && selectedProjectId !== '__all__')
      ? projects.find(p => p.id === selectedProjectId)
      : null;

    const projectsForCalc = selectedProject ? [selectedProject] : projects;
    const tasks = hierarchy?.tasks || [];
    const resources = hierarchy?.resources || [];

    return {
      seniorKPIs: calcSeniorManagementKPIs(projectsForCalc),
      pmKPIs: selectedProject
        ? calcProjectManagerKPIs(selectedProject, tasks)
        : calcProjectManagerKPIs(null, []),
      engineerKPIs: calcEngineerKPIs(tasks, resources),
      financeKPIs: calcFinanceKPIs(projectsForCalc, tasks),
      riskKPIs: calcRiskKPIs(projectsForCalc),
    };
  }, [projects, selectedProjectId, hierarchy]);

  // Build record selector options
  const recordOptions = useMemo(() => {
    return projects.map(sub => {
      const d = sub.submission_data || {};
      const name = str(d[PF.Project_Name]);
      const refId = sub.submission_ref_id || sub.id.slice(0, 8);
      return {
        id: sub.id,
        label: name ? `${refId} — ${name}` : refId,
      };
    });
  }, [projects]);

  return {
    projects,
    hierarchy,
    loading,
    hierarchyLoading,
    kpis,
    recordOptions,
  };
}
