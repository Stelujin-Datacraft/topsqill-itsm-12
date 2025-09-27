
import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { FieldConfigurationDialog } from './FieldConfigurationDialog';
import { OptimizedFormDataTable } from './OptimizedFormDataTable';
import { useForm } from '@/contexts/FormContext';
import { useCrossReferenceSync } from '@/hooks/useCrossReferenceSync';

interface CrossReferenceFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  onFieldUpdate?: (fieldId: string, updates: Partial<FormField>) => void;
  isPreview?: boolean;
  error?: string;
  disabled?: boolean;
  currentFormId?: string;
  onCrossReferenceSync?: (options: any) => Promise<void>;
}

export function CrossReferenceField({ field, value, onChange, onFieldUpdate, isPreview, error, disabled, currentFormId, onCrossReferenceSync }: CrossReferenceFieldProps) {
  const { forms } = useForm();
  const { syncCrossReferenceField } = useCrossReferenceSync();
  const [configOpen, setConfigOpen] = useState(false);

  const handleConfigSave = async (config: any) => {
    console.log('Saving cross reference configuration:', config);
    
    const previousTargetFormId = field.customConfig?.targetFormId;
    const newTargetFormId = config.targetFormId;
    
    // Update the field's customConfig first
    if (onFieldUpdate) {
      onFieldUpdate(field.id, {
        customConfig: {
          ...field.customConfig,
          ...config
        }
      });
    }

    // Sync child cross-reference field if target form changed and we have the required data
    if (currentFormId && newTargetFormId && newTargetFormId !== previousTargetFormId) {
      const currentForm = forms.find(f => f.id === currentFormId);
      
      try {
        console.log('Syncing child cross-reference field');
        
        const syncOptions = {
          parentFormId: currentFormId,
          parentFieldId: field.id,
          parentFormName: currentForm?.name || 'Unknown Form',
          targetFormId: newTargetFormId,
          previousTargetFormId: previousTargetFormId
        };

        // Use the provided sync function first, fallback to hook
        if (onCrossReferenceSync) {
          await onCrossReferenceSync(syncOptions);
        } else {
          await syncCrossReferenceField(syncOptions);
        }
        
        console.log('Successfully synced child cross-reference field');
      } catch (error) {
        console.error('Error syncing child cross-reference field:', error);
        // Don't throw error to prevent blocking the config save
      }
    }
  };

  const handleSelectionChange = (selectedRecords: any[]) => {
    console.log('Cross reference selection changed:', selectedRecords);
    // Call onChange with the selected records
    if (onChange) {
      onChange(selectedRecords);
    }
  };

  const targetForm = forms.find(f => f.id === field.customConfig?.targetFormId);

  // Create properly typed config object with better defaults
  const tableConfig = field.customConfig?.targetFormId ? {
    targetFormId: field.customConfig.targetFormId,
    targetFormName: field.customConfig.targetFormName || targetForm?.name || 'Unknown Form',
    filters: field.customConfig.filters || [],
    displayColumns: field.customConfig.displayColumns || [],
    enableSorting: field.customConfig.enableSorting ?? true,
    enableSearch: field.customConfig.enableSearch ?? true,
    pageSize: field.customConfig.pageSize || 10,
    isParentReference: field.customConfig.isParentReference || false
  } : null;

  // If no configuration exists, show configuration prompt
  if (!tableConfig || !tableConfig.displayColumns || tableConfig.displayColumns.length === 0) {
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          {/* <label className="block text-sm font-medium">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label> */}
          {/* {!isPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigOpen(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          )} */}
        </div>
        
        <div className="w-full p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center">
          <p className="text-muted-foreground mb-2">Cross Reference: {field.label}</p>
          <p className="text-sm text-muted-foreground">
            {isPreview ? 'Configure to create relationships between forms' : 'This field needs to be configured to display related data'}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {!isPreview && (
          <FieldConfigurationDialog
            field={field}
            open={configOpen}
            onClose={() => setConfigOpen(false)}
            onSave={handleConfigSave}
          />
        )}
      </div>
    );
  }

  // Show the optimized data table for both preview and actual form view
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {/* {!isPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        )} */}
      </div>
      
      <OptimizedFormDataTable
        config={tableConfig}
        fieldType="cross-reference"
        value={value}
        onChange={handleSelectionChange}
      />
      
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!isPreview && (
        <FieldConfigurationDialog
          field={field}
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          onSave={handleConfigSave}
        />
      )}
    </div>
  );
}
