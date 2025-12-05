
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FormOption, FormFieldOption } from '@/types/conditions';
import { useProject } from '@/contexts/ProjectContext';

export function useConditionFormData() {
  const { currentProject } = useProject();
  
  const { data: forms, isLoading } = useQuery({
    queryKey: ['condition-forms', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) {
        console.log('🔍 No project selected, skipping form fetch');
        return [];
      }
      
      console.log('🔍 Fetching published forms for project:', currentProject.id);
      const { data: formsData, error: formsError } = await supabase
        .from('forms')
        .select(`
          id,
          name,
          status
        `)
        .eq('project_id', currentProject.id)
        .in('status', ['published', 'active']);

      if (formsError) {
        console.error('❌ Error fetching forms:', formsError);
        throw formsError;
      }

      console.log('✅ Fetched published forms:', formsData?.length || 0);

      const formsWithFields = await Promise.all(
        formsData.map(async (form) => {
          const { data: fieldsData, error: fieldsError } = await supabase
            .from('form_fields')
            .select('*')
            .eq('form_id', form.id)
            .order('field_order');

          if (fieldsError) {
            console.error('❌ Error fetching fields for form:', form.id, fieldsError);
            return {
              id: form.id,
              name: form.name,
              fields: []
            };
          }

          const fields: FormFieldOption[] = fieldsData.map(field => {
            let processedOptions: Array<{ id: string; value: string; label: string }> = [];
            
            // Handle options - could be array, JSON string, or null
            let rawOptions = field.options;
            
            if (typeof rawOptions === 'string') {
              try {
                rawOptions = JSON.parse(rawOptions);
              } catch (e) {
                rawOptions = [];
              }
            }
            
            if (rawOptions && Array.isArray(rawOptions) && rawOptions.length > 0) {
              processedOptions = rawOptions.map((opt: any) => ({
                id: String(opt.id || opt.value || opt.label || opt),
                value: String(opt.value || opt.id || opt.label || opt),
                label: String(opt.label || opt.value || opt.id || opt)
              }));
            }

            // Parse custom_config if it's a string or non-object
            let customConfig: Record<string, any> = {};
            if (field.custom_config) {
              if (typeof field.custom_config === 'string') {
                try {
                  customConfig = JSON.parse(field.custom_config);
                } catch (e) {
                  customConfig = {};
                }
              } else if (typeof field.custom_config === 'object' && !Array.isArray(field.custom_config)) {
                customConfig = field.custom_config as Record<string, any>;
              }
            }

            // Parse validation if needed
            let validation: Record<string, any> = {};
            if (field.validation) {
              if (typeof field.validation === 'string') {
                try {
                  validation = JSON.parse(field.validation);
                } catch (e) {
                  validation = {};
                }
              } else if (typeof field.validation === 'object' && !Array.isArray(field.validation)) {
                validation = field.validation as Record<string, any>;
              }
            }

            return {
              id: field.id,
              label: field.label,
              type: field.field_type,
              options: processedOptions,
              required: field.required || false,
              custom_config: customConfig,
              validation: validation
            };
          });

          return {
            id: form.id,
            name: form.name,
            fields
          };
        })
      );

      return formsWithFields as FormOption[];
    },
    enabled: !!currentProject?.id
  });

  return {
    forms: forms || [],
    isLoading
  };
}

export function useFormFields(formId: string | undefined) {
  const [fields, setFields] = useState<FormFieldOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!formId) {
      setFields([]);
      return;
    }

    const fetchFields = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('*')
          .eq('form_id', formId)
          .order('field_order');

        if (error) throw error;

        const formattedFields: FormFieldOption[] = data.map(field => {
          let processedOptions: Array<{ id: string; value: string; label: string }> = [];
          
          // Handle options - could be array, JSON string, or null
          let rawOptions = field.options;
          
          // If options is a string, try to parse it as JSON
          if (typeof rawOptions === 'string') {
            try {
              rawOptions = JSON.parse(rawOptions);
            } catch (e) {
              rawOptions = [];
            }
          }
          
          // Now process the options array
          if (rawOptions && Array.isArray(rawOptions) && rawOptions.length > 0) {
            processedOptions = rawOptions.map((opt: any) => ({
              id: String(opt.id || opt.value || opt.label || opt),
              value: String(opt.value || opt.id || opt.label || opt),
              label: String(opt.label || opt.value || opt.id || opt)
            }));
          }

          // Parse custom_config if it's a string or non-object
          let customConfig: Record<string, any> = {};
          if (field.custom_config) {
            if (typeof field.custom_config === 'string') {
              try {
                customConfig = JSON.parse(field.custom_config);
              } catch (e) {
                customConfig = {};
              }
            } else if (typeof field.custom_config === 'object' && !Array.isArray(field.custom_config)) {
              customConfig = field.custom_config as Record<string, any>;
            }
          }

          // Parse validation if needed
          let validation: Record<string, any> = {};
          if (field.validation) {
            if (typeof field.validation === 'string') {
              try {
                validation = JSON.parse(field.validation);
              } catch (e) {
                validation = {};
              }
            } else if (typeof field.validation === 'object' && !Array.isArray(field.validation)) {
              validation = field.validation as Record<string, any>;
            }
          }

          return {
            id: field.id,
            label: field.label,
            type: field.field_type,
            options: processedOptions,
            required: field.required || false,
            custom_config: customConfig,
            validation: validation
          };
        });

        console.log('✅ Fetched fields:', formattedFields.length);
        setFields(formattedFields);
      } catch (error) {
        console.error('❌ Error fetching form fields:', error);
        setFields([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [formId]);

  return { fields, loading };
}
