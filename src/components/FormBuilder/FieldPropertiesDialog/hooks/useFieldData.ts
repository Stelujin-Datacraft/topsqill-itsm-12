
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';

interface DatabaseFieldData {
  id: string;
  form_id: string;
  field_type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  default_value?: string;
  options?: any;
  validation?: any;
  permissions?: any;
  triggers?: any;
  is_visible: boolean;
  is_enabled: boolean;
  current_value?: string;
  tooltip?: string;
  error_message?: string;
  custom_config?: any;
  field_order: number;
  created_at: string;
  updated_at: string;
}

export function useFieldData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFieldData = useCallback(async (fieldId: string): Promise<DatabaseFieldData | null> => {
    if (!fieldId) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: fieldData, error: fetchError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('id', fieldId)
        .maybeSingle();

      if (fetchError) {
        setError(`Failed to fetch field data: ${fetchError.message}`);
        return null;
      }

      if (!fieldData) {
        setError('Field not found in database');
        return null;
      }

      return fieldData;

    } catch (exception) {
      setError(`Unexpected error: ${exception instanceof Error ? exception.message : 'Unknown error'}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const parseCustomConfig = useCallback((customConfig: any): Record<string, any> => {
    if (!customConfig) {
      return {};
    }

    // Handle null or undefined
    if (customConfig === null || customConfig === undefined) {
      return {};
    }

    // If it's already a proper object
    if (typeof customConfig === 'object' && customConfig !== null) {
      // Check for undefined wrapper pattern
      if (customConfig._type === "undefined" && customConfig.value === "undefined") {
        return {};
      }
      
      // Check for string wrapper pattern
      if (customConfig.value && typeof customConfig.value === 'string') {
        try {
          return JSON.parse(customConfig.value);
        } catch {
          return {};
        }
      }
      
      // If it looks like a direct config object (no wrapper)
      if (!customConfig._type && !customConfig.value) {
        return customConfig;
      }
      
      // Fallback for object with unknown structure
      return customConfig;
    }

    // If it's a string, try to parse it as JSON
    if (typeof customConfig === 'string') {
      try {
        return JSON.parse(customConfig);
      } catch {
        return {};
      }
    }

    return {};
  }, []);

  const transformToFormField = useCallback((dbData: DatabaseFieldData, pageId?: string): FormField => {
    const parsedCustomConfig = parseCustomConfig(dbData.custom_config);

    const transformedField: FormField = {
      id: dbData.id,
      type: dbData.field_type as FormField['type'],
      label: dbData.label,
      placeholder: dbData.placeholder || undefined,
      required: dbData.required || false,
      defaultValue: dbData.default_value || undefined,
      options: dbData.options || undefined,
      validation: dbData.validation || undefined,
      permissions: dbData.permissions || undefined,
      triggers: dbData.triggers || undefined,
      isVisible: dbData.is_visible !== false,
      isEnabled: dbData.is_enabled !== false,
      currentValue: dbData.current_value || undefined,
      tooltip: dbData.tooltip || undefined,
      errorMessage: dbData.error_message || undefined,
      pageId: pageId || 'default',
      customConfig: parsedCustomConfig,
    };
    
    return transformedField;
  }, [parseCustomConfig]);

  return {
    fetchFieldData,
    parseCustomConfig,
    transformToFormField,
    loading,
    error,
  };
}
