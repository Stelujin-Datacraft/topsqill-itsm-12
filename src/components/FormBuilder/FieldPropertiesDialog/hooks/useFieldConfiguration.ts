
import { useState, useCallback, useEffect, useMemo } from 'react';
import { FormField } from '@/types/form';
import { getFieldDefaults } from '../utils/fieldDefaults';
import { validateConfiguration } from '../utils/configValidation';

export interface FieldConfiguration {
  // Basic properties
  label: string;
  placeholder: string;
  required: boolean;
  tooltip: string;
  defaultValue: string | boolean | string[];
  
  // Custom configuration
  customConfig: Record<string, any>;
  
  // Options for select-type fields
  options: Array<{ id: string; value: string; label: string }>;
  
  // Validation rules
  validation: Record<string, any>;
}

export function useFieldConfiguration(field: FormField | null) {
  const [localConfig, setLocalConfig] = useState<FieldConfiguration | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize configuration when field changes
  useEffect(() => {
    if (field) {
      console.log('useFieldConfiguration: Initializing config for field:', field.label, field.type);
      console.log('useFieldConfiguration: Saved customConfig:', field.customConfig);
      
      // Get field defaults but don't override existing saved values
      const fieldDefaults = getFieldDefaults(field.type);
      console.log('useFieldConfiguration: Field defaults:', fieldDefaults);
      
      // Smart merge: saved config takes precedence, defaults only fill in missing keys
      const mergedCustomConfig = { ...fieldDefaults };
      if (field.customConfig && typeof field.customConfig === 'object') {
        // Preserve all saved values, including arrays and objects
        Object.keys(field.customConfig).forEach(key => {
          const savedValue = field.customConfig![key];
          if (savedValue !== undefined && savedValue !== null) {
            mergedCustomConfig[key] = savedValue;
          }
        });
      }
      
      console.log('useFieldConfiguration: Final merged customConfig:', mergedCustomConfig);
      
      const config: FieldConfiguration = {
        label: field.label || '',
        placeholder: field.placeholder || '',
        required: field.required || false,
        tooltip: field.tooltip || '',
        defaultValue: field.defaultValue || '',
        customConfig: mergedCustomConfig,
        options: field.options || [],
        validation: field.validation || {},
      };
      
      console.log('useFieldConfiguration: Final configuration applied:', config);
      setLocalConfig(config);
      setHasChanges(false);
      setValidationErrors({});
    }
  }, [field?.id]); // Only depend on field.id to prevent constant re-initialization

  // Update configuration with validation
  const updateConfig = useCallback((updates: Partial<FieldConfiguration>) => {
    if (!localConfig || !field) return;

    const newConfig = { ...localConfig, ...updates };
    const errors = validateConfiguration(field.type, newConfig);
    
    setLocalConfig(newConfig);
    setValidationErrors(errors);
    setHasChanges(true);
  }, [localConfig, field]);

  // Update custom config specifically
  const updateCustomConfig = useCallback((configUpdates: Record<string, any>) => {
    console.log('useFieldConfiguration: Updating custom config with:', configUpdates);
    updateConfig({
      customConfig: { ...localConfig?.customConfig, ...configUpdates }
    });
  }, [localConfig, updateConfig]);

  // Reset to original values
  const resetConfig = useCallback(() => {
    if (field) {
      console.log('useFieldConfiguration: Resetting config for field:', field.label);
      
      const fieldDefaults = getFieldDefaults(field.type);
      const mergedCustomConfig = { ...fieldDefaults };
      
      if (field.customConfig && typeof field.customConfig === 'object') {
        Object.keys(field.customConfig).forEach(key => {
          const savedValue = field.customConfig![key];
          if (savedValue !== undefined && savedValue !== null) {
            mergedCustomConfig[key] = savedValue;
          }
        });
      }
      
      const config: FieldConfiguration = {
        label: field.label || '',
        placeholder: field.placeholder || '',
        required: field.required || false,
        tooltip: field.tooltip || '',
        defaultValue: field.defaultValue || '',
        customConfig: mergedCustomConfig,
        options: field.options || [],
        validation: field.validation || {},
      };
      
      setLocalConfig(config);
      setHasChanges(false);
      setValidationErrors({});
    }
  }, [field]);

  // Check if configuration is valid
  const isValid = useMemo(() => {
    return Object.keys(validationErrors).length === 0;
  }, [validationErrors]);

  return {
    localConfig,
    hasChanges,
    validationErrors,
    isValid,
    updateConfig,
    updateCustomConfig,
    resetConfig,
  };
}
