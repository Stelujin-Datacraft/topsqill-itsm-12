import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormField } from '@/types/form';
import { Button } from '@/components/ui/button';
import { Settings, ArrowUp, Link, Plus } from 'lucide-react';
import { FieldConfigurationDialog } from './FieldConfigurationDialog';
import { OptimizedFormDataTable } from './OptimizedFormDataTable';
import { useForm } from '@/contexts/FormContext';
import { Badge } from '@/components/ui/badge';
import { useChildCrossReferenceAutoSelection } from '@/hooks/useChildCrossReferenceAutoSelection';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { useFormAccess } from '@/components/FormBuilder/FieldPropertiesDialog/hooks/useFormAccess';
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
    if (targetForm) {
      navigate(`/form/${targetForm.id}`);
    }
  };

  // Check if field has proper configuration - allow empty displayColumns
  // Only need parentFormId and parentFieldId since targetFormId should always be parentFormId
  const hasAutoConfig = field.customConfig?.parentFormId && field.customConfig?.parentFieldId;

  // Get auto-selected records for child cross-reference
  const {
    autoSelectedRecords,
    loading: autoSelectionLoading
  } = useChildCrossReferenceAutoSelection({
    currentFormId: currentFormId || '',
    currentSubmissionId,
    parentFormId: field.customConfig?.parentFormId,
    crossReferenceFieldId: field.customConfig?.parentFieldId,
    displayColumns: field.customConfig?.tableDisplayFields || field.customConfig?.displayColumns || [],
    enabled: hasAutoConfig && !!currentSubmissionId && !isPreview
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
      {canCreateRecord && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateRecord}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Record
          </Button>
        </div>
      )}
      
      <OptimizedFormDataTable config={tableConfig} fieldType="child-cross-reference" value={value} onChange={handleSelectionChange} autoSelectedRecords={autoSelectedRecords} isAutoSelectionLoading={autoSelectionLoading} key={refreshTrigger} />
      
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!isPreview && <FieldConfigurationDialog field={field} open={configOpen} onClose={() => setConfigOpen(false)} onSave={handleConfigSave} />}
    </div>;
}