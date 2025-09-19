import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Button } from '@/components/ui/button';
import { Settings, ArrowUp, Link } from 'lucide-react';
import { FieldConfigurationDialog } from './FieldConfigurationDialog';
import { OptimizedFormDataTable } from './OptimizedFormDataTable';
import { useForm } from '@/contexts/FormContext';
import { Badge } from '@/components/ui/badge';
import { useChildCrossReferenceAutoSelection } from '@/hooks/useChildCrossReferenceAutoSelection';
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
  const {
    forms
  } = useForm();
  const [configOpen, setConfigOpen] = useState(false);
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
  const parentForm = forms.find(f => f.id === field.customConfig?.parentFormId);
  const targetForm = forms.find(f => f.id === field.customConfig?.targetFormId);

  // Check if field has proper auto-generated configuration
  const hasAutoConfig = field.customConfig?.targetFormId && field.customConfig?.displayColumns && field.customConfig?.displayColumns.length > 0;

  // Get auto-selected records for child cross-reference
  const {
    autoSelectedRecords,
    loading: autoSelectionLoading
  } = useChildCrossReferenceAutoSelection({
    currentFormId: currentFormId || '',
    currentSubmissionId,
    parentFormId: field.customConfig?.parentFormId,
    crossReferenceFieldId: field.customConfig?.parentFieldId,
    displayColumns: field.customConfig?.displayColumns,
    enabled: hasAutoConfig && !!currentSubmissionId && !isPreview
  });

  console.log('🔍 ChildCrossReferenceField Debug:', {
    fieldId: field.id,
    fieldLabel: field.label,
    hasAutoConfig,
    currentFormId,
    currentSubmissionId,
    parentFormId: field.customConfig?.parentFormId,
    crossReferenceFieldId: field.customConfig?.parentFieldId,
    displayColumns: field.customConfig?.displayColumns,
    autoSelectedRecords,
    autoSelectionLoading,
    isPreview,
    enabled: hasAutoConfig && !!currentSubmissionId && !isPreview
  });

  // Create properly typed config object with better defaults
  const tableConfig = hasAutoConfig ? {
    targetFormId: field.customConfig.targetFormId,
    targetFormName: field.customConfig.targetFormName || targetForm?.name || 'Unknown Form',
    filters: field.customConfig.filters || [],
    displayColumns: field.customConfig.displayColumns || [],
    enableSorting: field.customConfig.enableSorting ?? true,
    enableSearch: field.customConfig.enableSearch ?? true,
    pageSize: field.customConfig.pageSize || 10,
    isParentReference: false,
    isChildField: true
  } : null;

  // Show configuration prompt only if no auto-configuration exists
  if (!hasAutoConfig) {
    return <div className="w-full space-y-2">
        {/* Parent Form Indicator */}
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md border-l-4 border-blue-400">
          <ArrowUp className="h-4 w-4 text-blue-600" />
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-800">
              Child Reference from: {parentForm?.name || 'Unknown Parent Form'}
            </div>
            <div className="text-xs text-blue-600">
              This field is automatically managed and references the parent form
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            Auto-generated
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
        
        <div className="w-full p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center">
          <Link className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">Child Cross Reference: {field.label}</p>
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
      {/* Parent Form Indicator */}
      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md border-l-4 border-blue-400">
        <ArrowUp className="h-4 w-4 text-blue-600" />
        <div className="flex-1">
          <div className="text-sm font-medium text-blue-800">
            Child Reference from: {parentForm?.name || 'Unknown Parent Form'}
          </div>
          <div className="text-xs text-blue-600">
            This field is automatically managed and references the parent form
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          Auto-generated
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="flex items-center gap-2">
          {!isPreview}
        </div>
      </div>
      
      <OptimizedFormDataTable 
        config={tableConfig} 
        fieldType="cross-reference" 
        value={value} 
        onChange={handleSelectionChange} 
        autoSelectedRecords={autoSelectedRecords} 
        isAutoSelectionLoading={autoSelectionLoading} 
      />
      
      {/* Debug info */}
      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
        <strong>Debug Info:</strong><br/>
        Auto-selected records: {autoSelectedRecords?.length || 0}<br/>
        Loading: {autoSelectionLoading ? 'Yes' : 'No'}<br/>
        Has config: {hasAutoConfig ? 'Yes' : 'No'}<br/>
        Current submission: {currentSubmissionId || 'None'}<br/>
        Parent form: {field.customConfig?.parentFormId || 'None'}
      </div>
      
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!isPreview && <FieldConfigurationDialog field={field} open={configOpen} onClose={() => setConfigOpen(false)} onSave={handleConfigSave} />}
    </div>;
}