import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';

export interface HierarchyLevel {
  level: number;
  key: string;
  name: string;
  formId: string;
  formName: string;
  parentFormId?: string;
  parentRefFieldId?: string; // cross-ref field ID on child form pointing to parent
  idFieldId?: string; // field that stores the record's ID (e.g. Project_ID)
  nameFieldId?: string; // field that stores the record's display name
}

export interface HierarchyRecord {
  id: string;
  submissionRefId: string;
  data: Record<string, any>;
  createdAt: string;
}

export interface HierarchyKPIs {
  totalRecords: number;
  completedRecords: number;
  inProgressRecords: number;
  plannedBudget: number;
  actualCost: number;
  earnedValue: number;
  plannedValue: number;
  cpi: number;
  spi: number;
  plannedHours: number;
  actualHours: number;
  resourceUtilization: number;
  avgRiskScore: number;
  avgDelayDays: number;
  completionRate: number;
}

function num(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object') {
    if ('amount' in val) return Number(val.amount) || 0;
    if ('value' in val) return Number(val.value) || 0;
    return 0;
  }
  return Number(val) || 0;
}

/**
 * Detect hierarchy forms in the current project by looking for forms
 * named 'Projects', 'WBS', 'Activities', 'Tasks', 'Resource Assignments'
 */
export function useHierarchyDetection() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  return useQuery({
    queryKey: ['hierarchy-detection', projectId],
    queryFn: async (): Promise<HierarchyLevel[] | null> => {
      if (!projectId) return null;

      const EXPECTED_NAMES = ['Projects', 'WBS', 'Activities', 'Tasks', 'Resource Assignments'];

      const { data: forms } = await supabase
        .from('forms')
        .select('id, name')
        .eq('project_id', projectId)
        .in('name', EXPECTED_NAMES);

      if (!forms || forms.length < 5) return null;

      const formMap = new Map(forms.map(f => [f.name, f.id]));
      if (!EXPECTED_NAMES.every(n => formMap.has(n))) return null;

      // Fetch fields for all hierarchy forms to find cross-ref and ID fields
      const formIds = forms.map(f => f.id);
      const { data: allFields } = await supabase
        .from('form_fields')
        .select('id, form_id, field_type, label, custom_config')
        .in('form_id', formIds);

      if (!allFields) return null;

      const fieldsByForm = new Map<string, typeof allFields>();
      allFields.forEach(f => {
        if (!fieldsByForm.has(f.form_id)) fieldsByForm.set(f.form_id, []);
        fieldsByForm.get(f.form_id)!.push(f);
      });

      const LEVEL_CONFIG = [
        { level: 1, key: 'projects', name: 'Projects', idLabel: 'Project_ID', nameLabel: 'Project_Name' },
        { level: 2, key: 'wbs', name: 'WBS', idLabel: 'WBS_ID', nameLabel: 'WBS_Name', parentName: 'Projects' },
        { level: 3, key: 'activities', name: 'Activities', idLabel: 'Activity_ID', nameLabel: 'Activity_Name', parentName: 'WBS' },
        { level: 4, key: 'tasks', name: 'Tasks', idLabel: 'Task_ID', nameLabel: 'Task_Name', parentName: 'Activities' },
        { level: 5, key: 'resources', name: 'Resource Assignments', idLabel: 'Resource_Assignment_ID', nameLabel: 'Resource_Name', parentName: 'Tasks' },
      ];

      const levels: HierarchyLevel[] = [];

      for (const cfg of LEVEL_CONFIG) {
        const formId = formMap.get(cfg.name)!;
        const fields = fieldsByForm.get(formId) || [];

        const idField = fields.find(f => f.label === cfg.idLabel);
        const nameField = fields.find(f => f.label === cfg.nameLabel);

        let parentFormId: string | undefined;
        let parentRefFieldId: string | undefined;

        if (cfg.parentName) {
          parentFormId = formMap.get(cfg.parentName);
          const crossRefField = fields.find(f => f.field_type === 'cross-reference');
          parentRefFieldId = crossRefField?.id;
        }

        levels.push({
          level: cfg.level,
          key: cfg.key,
          name: cfg.name,
          formId,
          formName: cfg.name,
          parentFormId,
          parentRefFieldId,
          idFieldId: idField?.id,
          nameFieldId: nameField?.id,
        });
      }

      return levels;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch records at a given hierarchy level, optionally filtered by parent record
 */
export function useHierarchyRecords(
  level: HierarchyLevel | null,
  parentSubmissionId?: string
) {
  return useQuery({
    queryKey: ['hierarchy-records', level?.formId, parentSubmissionId],
    queryFn: async (): Promise<HierarchyRecord[]> => {
      if (!level) return [];

      let query = supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submission_data, submitted_at')
        .eq('form_id', level.formId)
        .order('submitted_at', { ascending: true });

      const { data } = await query;
      if (!data) return [];

      let records = data.map(r => ({
        id: r.id,
        submissionRefId: r.submission_ref_id || r.id,
        data: typeof r.submission_data === 'string' ? JSON.parse(r.submission_data) : (r.submission_data as Record<string, any>) || {},
        createdAt: r.submitted_at,
      }));

      // Filter by parent if needed
      if (parentSubmissionId && level.parentRefFieldId) {
        records = records.filter(r => {
          const refValue = r.data[level.parentRefFieldId!];
          if (!refValue) return false;
          // Cross-reference values can be stored as the submission ID directly
          if (typeof refValue === 'string') return refValue === parentSubmissionId;
          if (typeof refValue === 'object' && refValue.id) return refValue.id === parentSubmissionId;
          return false;
        });
      }

      return records;
    },
    enabled: !!level?.formId,
  });
}

/**
 * Calculate aggregated KPIs from records at a given hierarchy level
 */
export function calculateHierarchyKPIs(
  records: HierarchyRecord[],
  fields: Array<{ id: string; label: string }>,
  levelKey: string
): HierarchyKPIs {
  const fieldMap = new Map(fields.map(f => [f.label, f.id]));
  const resolve = (record: HierarchyRecord, label: string) => {
    const fieldId = fieldMap.get(label);
    return fieldId ? record.data[fieldId] : undefined;
  };

  const total = records.length;
  let completed = 0;
  let inProgress = 0;
  let sumPlannedBudget = 0;
  let sumActualCost = 0;
  let sumEV = 0;
  let sumPV = 0;
  let sumPlannedHours = 0;
  let sumActualHours = 0;
  let sumRisk = 0;
  let riskCount = 0;
  let sumDelay = 0;
  let delayCount = 0;

  for (const record of records) {
    // Status detection
    const statusLabels = ['Project_Status', 'WBS_Status', 'Activity_Status', 'Task_Status'];
    for (const sl of statusLabels) {
      const status = String(resolve(record, sl) || '').toLowerCase();
      if (status === 'completed') completed++;
      else if (status === 'in progress') inProgress++;
    }

    sumPlannedBudget += num(resolve(record, 'Planned_Budget'));
    sumActualCost += num(resolve(record, 'Actual_Cost'));
    sumEV += num(resolve(record, 'Earned_Value'));
    sumPV += num(resolve(record, 'Planned_Value'));
    sumPlannedHours += num(resolve(record, 'Planned_Hours'));
    sumActualHours += num(resolve(record, 'Actual_Hours'));

    const risk = num(resolve(record, 'Risk_Score'));
    if (risk > 0) { sumRisk += risk; riskCount++; }

    const delay = num(resolve(record, 'Predicted_Delay_Days') || resolve(record, 'Task_Delay_Days'));
    if (delay !== 0) { sumDelay += delay; delayCount++; }
  }

  const sumAC = sumActualCost; // For CPI calculation, use actual cost
  const cpi = sumAC > 0 ? sumEV / sumAC : 0;
  const spi = sumPV > 0 ? sumEV / sumPV : 0;
  const resourceUtilization = sumPlannedHours > 0 ? (sumActualHours / sumPlannedHours) * 100 : 0;
  const completionRate = total > 0 ? (completed / total) * 100 : 0;

  return {
    totalRecords: total,
    completedRecords: completed,
    inProgressRecords: inProgress,
    plannedBudget: sumPlannedBudget,
    actualCost: sumActualCost,
    earnedValue: sumEV,
    plannedValue: sumPV,
    cpi,
    spi,
    plannedHours: sumPlannedHours,
    actualHours: sumActualHours,
    resourceUtilization,
    avgRiskScore: riskCount > 0 ? sumRisk / riskCount : 0,
    avgDelayDays: delayCount > 0 ? sumDelay / delayCount : 0,
    completionRate,
  };
}

/**
 * Fetch field definitions for a form
 */
export function useHierarchyFields(formId: string | undefined) {
  return useQuery({
    queryKey: ['hierarchy-fields', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId)
        .order('field_order', { ascending: true });
      return (data || []).map(f => ({ id: f.id, label: f.label, type: f.field_type }));
    },
    enabled: !!formId,
    staleTime: 5 * 60 * 1000,
  });
}
