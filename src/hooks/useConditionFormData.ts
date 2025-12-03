
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
            
            if (field.options && Array.isArray(field.options)) {
              processedOptions = field.options.map((opt: any) => ({
                id: opt.id || opt.value || String(opt),
                value: opt.value || String(opt),
                label: opt.label || opt.value || String(opt)
              }));
            }

            return {
              id: field.id,
              label: field.label,
              type: field.field_type,
              options: processedOptions,
              required: field.required || false
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
        console.log('🔍 Fetching fields for form:', formId);
        const { data, error } = await supabase
          .from('form_fields')
          .select('*')
          .eq('form_id', formId)
          .order('field_order');

        if (error) throw error;

        const formattedFields: FormFieldOption[] = data.map(field => {
          let processedOptions: Array<{ id: string; value: string; label: string }> = [];
          
          if (field.options && Array.isArray(field.options)) {
            processedOptions = field.options.map((opt: any) => ({
              id: opt.id || opt.value || String(opt),
              value: opt.value || String(opt),
              label: opt.label || opt.value || String(opt)
            }));
          }

          return {
            id: field.id,
            label: field.label,
            type: field.field_type,
            options: processedOptions,
            required: field.required || false
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
