
import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { FieldConfigurationDialog } from './FieldConfigurationDialog';
import { FormDataTable } from './FormDataTable';
import { useForm } from '@/contexts/FormContext';

interface MatrixGridFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  onFieldUpdate?: (fieldId: string, updates: Partial<FormField>) => void;
  isPreview?: boolean;
  error?: string;
  disabled?: boolean;
}

export function MatrixGridField({ field, value, onChange, onFieldUpdate, isPreview, error, disabled }: MatrixGridFieldProps) {
  const { forms } = useForm();
  const [configOpen, setConfigOpen] = useState(false);

  const handleConfigSave = (config: any) => {
    // Update the field's customConfig
    if (onFieldUpdate) {
      onFieldUpdate(field.id, {
        customConfig: {
          ...field.customConfig,
          ...config
        }
      });
    }
    
    // Also call onChange if provided (for form submission context)
    onChange?.(config);
  };

  const targetForm = forms.find(f => f.id === field.customConfig?.targetFormId);
  const targetFormFields = targetForm?.fields.map(f => ({
    id: f.id,
    label: f.label,
    type: f.type
  })) || [];

  // Create properly typed config object
  const tableConfig = field.customConfig?.targetFormId ? {
    targetFormId: field.customConfig.targetFormId,
    targetFormName: field.customConfig.targetFormName || '',
    filters: field.customConfig.filters || [],
    displayColumns: field.customConfig.displayColumns || [],
    joinField: field.customConfig.joinField,
    enableSorting: field.customConfig.enableSorting ?? true,
    enableSearch: field.customConfig.enableSearch ?? true,
    pageSize: field.customConfig.pageSize || 10
  } : null;

  if (isPreview) {
    if (!tableConfig) {
      return (
        <div className="w-full p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center">
          <p className="text-muted-foreground mb-2">Matrix Grid: {field.label}</p>
          <p className="text-sm text-muted-foreground">Configure to display form records</p>
        </div>
      );
    }

    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="text-xs text-muted-foreground">
            Source: {tableConfig.targetFormName}
          </div>
        </div>
        <FormDataTable
          config={tableConfig}
          fieldType="matrix-grid"
          targetFormFields={targetFormFields}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {/* <Button
          variant="outline"
          size="sm"
          onClick={() => setConfigOpen(true)}
          className="h-6 px-2"
        >
          <Settings className="h-3 w-3 mr-1" />
          Configure
        </Button> */}
      </div>
      
      <div className="p-4 border border-dashed border-gray-300 rounded-md text-center text-gray-500">
        Matrix Grid Field - Configure to display form records with filtering
        {field.customConfig?.targetFormName && (
          <p className="text-xs mt-1">Target: {field.customConfig.targetFormName}</p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <FieldConfigurationDialog
        field={field}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSave={handleConfigSave}
      />
    </div>
  );
}
