
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
    console.log('🔍 useFieldData: Starting field data fetch');
    console.log('📋 useFieldData: Field ID:', fieldId);
    
    if (!fieldId) {
      console.warn('⚠️ useFieldData: No field ID provided');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 useFieldData: Querying form_fields table...');
      
      const { data: fieldData, error: fetchError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('id', fieldId)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ useFieldData: Database query error:', fetchError);
        setError(`Failed to fetch field data: ${fetchError.message}`);
        return null;
      }

      if (!fieldData) {
        console.warn('⚠️ useFieldData: No field data found for ID:', fieldId);
        setError('Field not found in database');
        return null;
      }

      console.log('✅ useFieldData: Successfully fetched field data');
      console.log('📊 useFieldData: Raw database response:', fieldData);
      console.log('📝 useFieldData: Form ID:', fieldData.form_id);
      console.log('🏷️ useFieldData: Field type:', fieldData.field_type);
      console.log('📋 useFieldData: Field label:', fieldData.label);
      console.log('⚙️ useFieldData: Raw custom_config:', fieldData.custom_config);
      console.log('🔧 useFieldData: Custom config type:', typeof fieldData.custom_config);

      return fieldData;

    } catch (exception) {
      console.error('💥 useFieldData: Exception during fetch:', exception);
      setError(`Unexpected error: ${exception instanceof Error ? exception.message : 'Unknown error'}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const parseCustomConfig = useCallback((customConfig: any): Record<string, any> => {
    console.log('🔧 useFieldData: Parsing custom config...');
    console.log('📥 useFieldData: Input custom config:', customConfig);
    console.log('📋 useFieldData: Input type:', typeof customConfig);
    
    if (!customConfig) {
      console.log('⭕ useFieldData: No custom config provided, returning empty object');
      return {};
    }

    // Handle null or undefined
    if (customConfig === null || customConfig === undefined) {
      console.log('⭕ useFieldData: Custom config is null/undefined, returning empty object');
      return {};
    }

    // If it's already a proper object
    if (typeof customConfig === 'object' && customConfig !== null) {
      console.log('📦 useFieldData: Custom config is object, analyzing structure...');
      
      // Check for undefined wrapper pattern
      if (customConfig._type === "undefined" && customConfig.value === "undefined") {
        console.log('⭕ useFieldData: Found undefined wrapper pattern, returning empty object');
        return {};
      }
      
      // Check for string wrapper pattern
      if (customConfig.value && typeof customConfig.value === 'string') {
        console.log('📄 useFieldData: Found string wrapper, attempting to parse...');
        try {
          const parsed = JSON.parse(customConfig.value);
          console.log('✅ useFieldData: Successfully parsed wrapped string:', parsed);
          return parsed;
        } catch (parseError) {
          console.warn('⚠️ useFieldData: Failed to parse wrapped string:', parseError);
          return {};
        }
      }
      
      // If it looks like a direct config object (no wrapper)
      if (!customConfig._type && !customConfig.value) {
        console.log('✅ useFieldData: Using custom config as direct object:', customConfig);
        return customConfig;
      }
      
      // Fallback for object with unknown structure
      console.log('⚠️ useFieldData: Unknown object structure, returning as-is');
      return customConfig;
    }

    // If it's a string, try to parse it as JSON
    if (typeof customConfig === 'string') {
      console.log('📄 useFieldData: Custom config is string, attempting JSON parse...');
      try {
        const parsed = JSON.parse(customConfig);
        console.log('✅ useFieldData: Successfully parsed JSON string:', parsed);
        return parsed;
      } catch (parseError) {
        console.warn('⚠️ useFieldData: Failed to parse JSON string:', parseError);
        console.log('📄 useFieldData: Original string value:', customConfig);
        return {};
      }
    }

    console.log('❓ useFieldData: Unrecognized custom config format, returning empty object');
    return {};
  }, []);

  const transformToFormField = useCallback((dbData: DatabaseFieldData, pageId?: string): FormField => {
    console.log('🔄 useFieldData: Transforming database data to FormField...');
    
    const parsedCustomConfig = parseCustomConfig(dbData.custom_config);
    console.log('✅ useFieldData: Final parsed custom config:', parsedCustomConfig);

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

    console.log('🎯 useFieldData: Final transformed FormField:', transformedField);
    console.log('📊 useFieldData: Custom config in final field:', transformedField.customConfig);
    
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
