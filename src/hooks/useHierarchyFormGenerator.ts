import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/hooks/use-toast';

export interface HierarchyFormDefinition {
  level: number;
  key: string;
  name: string;
  description: string;
  fields: Array<{
    label: string;
    type: string;
    required?: boolean;
    placeholder?: string;
    options?: string[];
    tooltip?: string;
  }>;
  parentKey?: string; // key of parent form
  parentRefLabel?: string; // label of the parent reference field
}

const HIERARCHY_FORMS: HierarchyFormDefinition[] = [
  {
    level: 1,
    key: 'projects',
    name: 'Projects',
    description: 'High-level project information for portfolio management',
    fields: [
      { label: 'Project_ID', type: 'text', required: true, placeholder: 'e.g. PRJ-001' },
      { label: 'Project_Name', type: 'text', required: true },
      { label: 'Project_Type', type: 'dropdown', options: ['Construction', 'IT', 'Engineering', 'Consulting', 'Other'] },
      { label: 'Business_Unit', type: 'text' },
      { label: 'Client_Name', type: 'text' },
      { label: 'Project_Manager', type: 'text' },
      { label: 'Start_Date', type: 'date', required: true },
      { label: 'End_Date_Planned', type: 'date', required: true },
      { label: 'End_Date_Actual', type: 'date' },
      { label: 'Project_Status', type: 'dropdown', required: true, options: ['Planned', 'In Progress', 'Completed', 'On Hold'] },
      { label: 'Planned_Budget', type: 'currency', required: true },
      { label: 'Actual_Cost', type: 'currency' },
      { label: 'Forecasted_Cost', type: 'currency' },
      { label: 'Earned_Value', type: 'currency', tooltip: 'EV - Budgeted cost of work performed' },
      { label: 'Planned_Value', type: 'currency', tooltip: 'PV - Budgeted cost of work scheduled' },
      { label: 'Actual_Cost_Value', type: 'currency', tooltip: 'AC - Actual cost of work performed' },
      { label: 'Risk_Score', type: 'number', placeholder: '0-100' },
      { label: 'Predicted_Delay_Days', type: 'number' },
    ],
  },
  {
    level: 2,
    key: 'wbs',
    name: 'WBS',
    description: 'Work Breakdown Structure groups under each project',
    parentKey: 'projects',
    parentRefLabel: 'Project_ID',
    fields: [
      { label: 'WBS_ID', type: 'text', required: true, placeholder: 'e.g. WBS-001' },
      { label: 'WBS_Code', type: 'text', required: true },
      { label: 'WBS_Name', type: 'text', required: true },
      { label: 'WBS_Description', type: 'textarea' },
      { label: 'WBS_Manager', type: 'text' },
      { label: 'Planned_Start_Date', type: 'date' },
      { label: 'Planned_End_Date', type: 'date' },
      { label: 'Actual_Start_Date', type: 'date' },
      { label: 'Actual_End_Date', type: 'date' },
      { label: 'WBS_Status', type: 'dropdown', options: ['Not Started', 'In Progress', 'Completed', 'On Hold'] },
      { label: 'Planned_Budget', type: 'currency' },
      { label: 'Actual_Cost', type: 'currency' },
      { label: 'Earned_Value', type: 'currency' },
      { label: 'Planned_Value', type: 'currency' },
    ],
  },
  {
    level: 3,
    key: 'activities',
    name: 'Activities',
    description: 'Activities under each WBS element',
    parentKey: 'wbs',
    parentRefLabel: 'WBS_ID',
    fields: [
      { label: 'Activity_ID', type: 'text', required: true, placeholder: 'e.g. ACT-001' },
      { label: 'Activity_Name', type: 'text', required: true },
      { label: 'Activity_Description', type: 'textarea' },
      { label: 'Activity_Type', type: 'dropdown', options: ['Design', 'Construction', 'Testing', 'Review', 'Procurement', 'Other'] },
      { label: 'Planned_Start_Date', type: 'date' },
      { label: 'Planned_End_Date', type: 'date' },
      { label: 'Actual_Start_Date', type: 'date' },
      { label: 'Actual_End_Date', type: 'date' },
      { label: 'Activity_Status', type: 'dropdown', options: ['Not Started', 'In Progress', 'Completed', 'On Hold'] },
      { label: 'Planned_Hours', type: 'number' },
      { label: 'Actual_Hours', type: 'number' },
      { label: 'Schedule_Variance', type: 'number', tooltip: 'Days ahead (+) or behind (-)' },
      { label: 'Cost_Per_Task', type: 'currency' },
      { label: 'Risk_Category', type: 'dropdown', options: ['Low', 'Medium', 'High', 'Critical'] },
      { label: 'Risk_Score', type: 'number', placeholder: '0-100' },
    ],
  },
  {
    level: 4,
    key: 'tasks',
    name: 'Tasks',
    description: 'Detailed tasks under each activity',
    parentKey: 'activities',
    parentRefLabel: 'Activity_ID',
    fields: [
      { label: 'Task_ID', type: 'text', required: true, placeholder: 'e.g. TSK-001' },
      { label: 'Task_Name', type: 'text', required: true },
      { label: 'Task_Description', type: 'textarea' },
      { label: 'Task_Status', type: 'dropdown', options: ['Not Started', 'In Progress', 'Completed', 'Blocked'] },
      { label: 'Planned_Start_Date', type: 'date' },
      { label: 'Planned_End_Date', type: 'date' },
      { label: 'Actual_Start_Date', type: 'date' },
      { label: 'Actual_End_Date', type: 'date' },
      { label: 'Planned_Hours', type: 'number' },
      { label: 'Actual_Hours', type: 'number' },
      { label: 'Task_Delay_Days', type: 'number' },
      { label: 'Productivity_Score', type: 'number', placeholder: '0-100' },
      { label: 'Quality_Score', type: 'number', placeholder: '0-100' },
      { label: 'Defect_Count', type: 'number' },
    ],
  },
  {
    level: 5,
    key: 'resources',
    name: 'Resource Assignments',
    description: 'Resource allocation for each task',
    parentKey: 'tasks',
    parentRefLabel: 'Task_ID',
    fields: [
      { label: 'Resource_Assignment_ID', type: 'text', required: true, placeholder: 'e.g. RES-001' },
      { label: 'Resource_ID', type: 'text' },
      { label: 'Resource_Name', type: 'text', required: true },
      { label: 'Role', type: 'text' },
      { label: 'Skill_Set', type: 'text' },
      { label: 'Allocation', type: 'number', placeholder: '0-100', tooltip: 'Allocation percentage' },
      { label: 'Planned_Hours', type: 'number' },
      { label: 'Actual_Hours', type: 'number' },
      { label: 'Overtime_Hours', type: 'number' },
      { label: 'Utilization', type: 'number', placeholder: '0-100', tooltip: 'Utilization percentage' },
      { label: 'Productivity_Score', type: 'number', placeholder: '0-100' },
    ],
  },
];

export function useHierarchyFormGenerator() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const generateHierarchyForms = async (): Promise<Record<string, string> | null> => {
    if (!userProfile?.organization_id || !userProfile?.id || !currentProject?.id) {
      toast({ title: 'Error', description: 'No active project or user session.', variant: 'destructive' });
      return null;
    }

    setGenerating(true);
    const formIds: Record<string, string> = {};

    try {
      // Step 1: Create all 5 forms
      for (const def of HIERARCHY_FORMS) {
        const { data: form, error } = await supabase
          .from('forms')
          .insert({
            name: def.name,
            description: def.description,
            organization_id: userProfile.organization_id,
            project_id: currentProject.id,
            status: 'published',
            created_by: userProfile.id,
            is_public: false,
            permissions: JSON.stringify({ view: ['*'], submit: ['*'], edit: ['admin'] }),
            layout: JSON.stringify({ columns: 1 }),
            pages: JSON.stringify([{ id: 'page-1', name: 'Page 1', order: 0, fields: [] }]),
          })
          .select('id')
          .single();

        if (error) throw new Error(`Failed to create ${def.name} form: ${error.message}`);
        formIds[def.key] = form.id;
      }

      // Step 2: Create fields for each form (including cross-reference to parent)
      for (const def of HIERARCHY_FORMS) {
        const formId = formIds[def.key];
        const fieldInserts: any[] = [];
        let order = 0;

        // Add parent cross-reference field if applicable
        if (def.parentKey && def.parentRefLabel) {
          const parentFormId = formIds[def.parentKey];
          const parentFormDef = HIERARCHY_FORMS.find(f => f.key === def.parentKey);
          
          fieldInserts.push({
            form_id: formId,
            field_type: 'cross-reference',
            label: `${def.parentRefLabel} (${parentFormDef?.name})`,
            required: true,
            placeholder: `Select ${parentFormDef?.name} record`,
            field_order: order++,
            is_visible: true,
            is_enabled: true,
            permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
            triggers: JSON.stringify([]),
            custom_config: JSON.stringify({
              targetFormId: parentFormId,
              targetFormName: parentFormDef?.name || '',
              displayColumns: [],
              filters: [],
              enableSorting: true,
              enableSearch: true,
              pageSize: 10,
              isParentReference: true,
            }),
          });
        }

        // Add regular fields
        for (const field of def.fields) {
          const fieldData: any = {
            form_id: formId,
            field_type: field.type,
            label: field.label,
            required: field.required || false,
            placeholder: field.placeholder || '',
            field_order: order++,
            is_visible: true,
            is_enabled: true,
            tooltip: field.tooltip || '',
            permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
            triggers: JSON.stringify([]),
          };

          if (field.options) {
            fieldData.options = JSON.stringify(field.options.map(o => ({ label: o, value: o })));
          }

          fieldInserts.push(fieldData);
        }

        const { data: insertedFields, error: fieldsError } = await supabase
          .from('form_fields')
          .insert(fieldInserts)
          .select('id');

        if (fieldsError) throw new Error(`Failed to create fields for ${def.name}: ${fieldsError.message}`);

        // Update form pages with field IDs
        if (insertedFields) {
          const fieldIds = insertedFields.map(f => f.id);
          await supabase
            .from('forms')
            .update({
              pages: JSON.stringify([{ id: 'page-1', name: 'Page 1', order: 0, fields: fieldIds }]),
            })
            .eq('id', formId);
        }
      }

      // Step 3: Create child cross-reference fields on parent forms
      for (const def of HIERARCHY_FORMS) {
        if (!def.parentKey) continue;
        
        const parentFormId = formIds[def.parentKey];
        const childFormId = formIds[def.key];

        // Find the cross-reference field we just created on the child form
        const { data: crossRefFields } = await supabase
          .from('form_fields')
          .select('id')
          .eq('form_id', childFormId)
          .eq('field_type', 'cross-reference')
          .limit(1);

        const crossRefFieldId = crossRefFields?.[0]?.id;
        if (!crossRefFieldId) continue;

        // Create child-cross-reference field on parent form
        const { data: childField } = await supabase
          .from('form_fields')
          .insert({
            form_id: parentFormId,
            field_type: 'child-cross-reference',
            label: `${def.name} (linked)`,
            required: false,
            field_order: 99 + def.level,
            is_visible: true,
            is_enabled: true,
            permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
            triggers: JSON.stringify([]),
            custom_config: JSON.stringify({
              isChildField: true,
              parentFormId: parentFormId,
              parentFieldId: crossRefFieldId,
              parentFormName: HIERARCHY_FORMS.find(f => f.key === def.parentKey)?.name || '',
              targetFormId: childFormId,
              targetFormName: def.name,
              displayColumns: [],
              filters: [],
              enableSorting: true,
              enableSearch: true,
              pageSize: 10,
              isParentReference: false,
            }),
          })
          .select('id')
          .single();

        // Add the child field to parent form's page
        if (childField) {
          const { data: parentForm } = await supabase
            .from('forms')
            .select('pages')
            .eq('id', parentFormId)
            .single();

          if (parentForm?.pages) {
            const pages = typeof parentForm.pages === 'string' ? JSON.parse(parentForm.pages) : parentForm.pages;
            if (Array.isArray(pages) && pages[0]) {
              pages[0].fields = [...(pages[0].fields || []), childField.id];
              await supabase.from('forms').update({ pages: JSON.stringify(pages) }).eq('id', parentFormId);
            }
          }
        }
      }

      toast({ title: 'Hierarchy Created', description: 'All 5 forms with cross-references have been created successfully.' });
      return formIds;
    } catch (error: any) {
      console.error('Hierarchy generation error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to generate hierarchy forms.', variant: 'destructive' });
      
      // Cleanup: delete any forms that were created
      for (const key of Object.keys(formIds)) {
        await supabase.from('forms').delete().eq('id', formIds[key]).catch(() => {});
      }
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generateHierarchyForms, generating, HIERARCHY_FORMS };
}
