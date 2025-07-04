
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField } from '@/types/form';

interface FormWithFields extends Omit<Form, 'fields'> {
  fields: FormField[];
}

export function useFormWithFields(formId: string | undefined) {
  const [form, setForm] = useState<FormWithFields | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) {
      setForm(null);
      return;
    }

    const loadFormWithFields = async () => {
      try {
        setLoading(true);
        setError(null);

        // First load the form
        const { data: formData, error: formError } = await supabase
          .from('forms')
          .select('*')
          .eq('id', formId)
          .single();

        if (formError) {
          setError('Failed to load form: ' + formError.message);
          return;
        }

        // Then load the form fields
        const { data: fieldsData, error: fieldsError } = await supabase
          .from('form_fields')
          .select('*')
          .eq('form_id', formId)
          .order('field_order');

        if (fieldsError) {
          setError('Failed to load form fields: ' + fieldsError.message);
          return;
        }

        // Transform the database data to match our Form type with proper type casting
        const transformedForm: FormWithFields = {
          id: formData.id,
          name: formData.name,
          description: formData.description || '',
          organizationId: formData.organization_id,
          projectId: formData.project_id,
          status: formData.status as Form['status'],
          createdAt: formData.created_at,
          updatedAt: formData.updated_at,
          createdBy: formData.created_by,
          isPublic: formData.is_public || false,
          permissions: (formData.permissions as any) || { view: ['*'], submit: ['*'], edit: ['admin'] },
          shareSettings: (formData.share_settings as any) || { allowPublicAccess: false, sharedUsers: [] },
          fieldRules: (formData.field_rules as any) || [],
          formRules: (formData.form_rules as any) || [],
          layout: (formData.layout as any) || { columns: 1 },
          pages: (formData.pages as any) || [],
          reference_id: formData.reference_id,
          fields: fieldsData?.map(field => ({
            id: field.id,
            type: field.field_type as FormField['type'],
            label: field.label,
            placeholder: field.placeholder,
            required: field.required || false,
            defaultValue: field.default_value,
            options: field.options as FormField['options'],
            validation: field.validation as FormField['validation'],
            validationRules: [],
            permissions: (field.permissions as any) || { read: ['*'], write: ['*'] },
            triggers: (field.triggers as any) || [],
            isVisible: field.is_visible !== false,
            isEnabled: field.is_enabled !== false,
            currentValue: field.current_value,
            tooltip: field.tooltip,
            errorMessage: field.error_message,
            customConfig: (field.custom_config as any) || {}
          })) || []
        };

        setForm(transformedForm);
      } catch (err) {
        setError('Unexpected error loading form: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadFormWithFields();
  }, [formId]);

  return { form, loading, error };
}
