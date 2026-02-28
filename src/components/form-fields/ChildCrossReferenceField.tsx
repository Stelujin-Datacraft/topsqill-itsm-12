import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormField } from '@/types/form';
import { Button } from '@/components/ui/button';
import { Settings, ArrowUp, Link, Plus } from 'lucide-react';
import { FieldConfigurationDialog } from './FieldConfigurationDialog';
import { OptimizedFormDataTable } from './OptimizedFormDataTable';
import { CreateRecordDialog } from './CreateRecordDialog';
import { useForm } from '@/contexts/FormContext';
import { Badge } from '@/components/ui/badge';
import { useChildCrossReferenceAutoSelection } from '@/hooks/useChildCrossReferenceAutoSelection';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { useFormAccess } from '@/components/FormBuilder/FieldPropertiesDialog/hooks/useFormAccess';
import { supabase } from '@/integrations/supabase/client';
interface ChildCrossReferenceFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  onFieldUpdate?: (fieldId: string, updates: Partial<FormField>) => void;
  isPreview?: boolean;
  error?: string;
  disabled?: boolean;
  currentFormId?: string;
  currentSubmissionId?: string;
}
export function ChildCrossReferenceField({
  field,
  value,
  onChange,
  onFieldUpdate,
  isPreview,
  error,
  disabled,
  currentFormId,
  currentSubmissionId
}: ChildCrossReferenceFieldProps) {
  const navigate = useNavigate();
  const { forms } = useForm();
  const { accessibleForms } = useFormAccess();
  const { currentProject } = useProject();
  const { hasPermission } = useUnifiedAccessControl(currentProject?.id);
  const [configOpen, setConfigOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Use accessible forms for finding target form
  const formsToUse = accessibleForms.length > 0 ? accessibleForms : forms;
  const handleConfigSave = (config: any) => {
    console.log('Saving child cross reference configuration:', config);

    // Update the field's customConfig
    if (onFieldUpdate) {
      onFieldUpdate(field.id, {
        customConfig: {
          ...field.customConfig,
          ...config
        }
      });
    }
  };
  const handleSelectionChange = (selectedRecords: any[]) => {
    console.log('Child cross reference selection changed:', selectedRecords);
    if (onChange) {
      onChange(selectedRecords);
    }
  };
  const parentForm = formsToUse.find(f => f.id === field.customConfig?.parentFormId);
  
  // CRITICAL FIX: For child cross-reference, the targetForm should ALWAYS be the parentForm
  // because we want to show records FROM the parent form that reference this record
  // The targetFormId in config should point to parentFormId, but we ensure this here
  const actualTargetFormId = field.customConfig?.parentFormId; // Always use parentFormId as target
  const targetForm = formsToUse.find(f => f.id === actualTargetFormId);
  
  // Check if user has permission to create records in the target form (based on read access)
  // For users with roles, check both top-level AND specific form permission
  // This ensures role-based users can only create records in forms they have explicit access to
  const canCreateRecord = !isPreview && targetForm && hasPermission('forms', 'read', targetForm.id);

  const handleCreateRecord = () => {
    setCreateDialogOpen(true);
  };

  const handleRecordCreated = async () => {
    if (targetForm) {
      const { data } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, form_id')
        .eq('form_id', targetForm.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single();

      if (data && onChange) {
        const currentValue = Array.isArray(value) ? value : [];
        const newRecord = {
          id: data.id,
          submission_ref_id: data.submission_ref_id,
          form_id: data.form_id,
        };
        onChange([...currentValue, newRecord]);
      }
      setRefreshTrigger(prev => prev + 1);
    }
  };

  // Check if field has proper configuration - allow empty displayColumns
  // Only need parentFormId and parentFieldId since targetFormId should always be parentFormId
  const hasAutoConfig = field.customConfig?.parentFormId && field.customConfig?.parentFieldId;

  // Determine if we're in edit mode (existing submission) vs create mode (new submission)
  const isEditMode = !!currentSubmissionId;

  // Get auto-selected records for child cross-reference
  // Only fetch when in edit mode (has a submission ID to look for references)
  const {
    autoSelectedRecords,
    loading: autoSelectionLoading
  } = useChildCrossReferenceAutoSelection({
    currentFormId: currentFormId || '',
    currentSubmissionId,
    parentFormId: field.customConfig?.parentFormId,
    crossReferenceFieldId: field.customConfig?.parentFieldId,
    displayColumns: field.customConfig?.tableDisplayFields || field.customConfig?.displayColumns || [],
    enabled: hasAutoConfig && isEditMode && !isPreview
  });

  // Create properly typed config object with better defaults
  // If no display columns configured, the table will show submission_ref_id by default
  // CRITICAL: Always use parentFormId as targetFormId for child cross-reference fields
  const tableConfig = hasAutoConfig ? {
    targetFormId: actualTargetFormId, // Use parentFormId as the target
    targetFormName: parentForm?.name || 'Unknown Form',
    filters: field.customConfig.filters || [],
    displayColumns: field.customConfig.displayColumns || [], // Empty array is fine, table handles it
    tableDisplayFields: field.customConfig.tableDisplayFields || [],
    enableSorting: field.customConfig.enableSorting ?? true,
    enableSearch: field.customConfig.enableSearch ?? true,
    pageSize: field.customConfig.pageSize || 10,
    isParentReference: false,
    isChildField: true
  } : null;

  // Show configuration prompt only if no auto-configuration exists
  if (!hasAutoConfig) {
    return <div className="w-full space-y-2">
        <div className="w-full p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center">
          <Link className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isPreview ? 'Shows related data from parent form' : 'Waiting for configuration to be auto-generated...'}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {!isPreview && <FieldConfigurationDialog field={field} open={configOpen} onClose={() => setConfigOpen(false)} onSave={handleConfigSave} />}
      </div>;
  }

  // Show the optimized data table with auto-generated configuration
  return <div className="w-full space-y-2">
      <OptimizedFormDataTable config={tableConfig} fieldType="child-cross-reference" value={value} onChange={handleSelectionChange} autoSelectedRecords={autoSelectedRecords} isAutoSelectionLoading={autoSelectionLoading} key={refreshTrigger} canCreateRecord={canCreateRecord} onCreateRecord={handleCreateRecord} createRecordLabel="Create & Link" createRecordDisabled={disabled} />
      
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!isPreview && <FieldConfigurationDialog field={field} open={configOpen} onClose={() => setConfigOpen(false)} onSave={handleConfigSave} />}

      {targetForm && (
        <CreateRecordDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          targetForm={targetForm as any}
          onRecordCreated={handleRecordCreated}
        />
      )}
    </div>;
}