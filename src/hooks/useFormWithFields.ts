
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField } from '@/types/form';

interface FormWithFields extends Omit<Form, 'fields'> {
  fields: FormField[];
}

  // Helper function to safely parse JSON - EXACT COPY from useFormsLoader
  const safeParseJson = (jsonString: any, fallback: any = null) => {
    if (!jsonString) return fallback;
    if (typeof jsonString === 'object') return jsonString;
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Failed to parse JSON:', jsonString, error);
      return fallback;
    }
  };

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

        // Transform the database data to match our Form type - EXACT LOGIC from useFormsLoader
        const parsedPages = safeParseJson(formData.pages, [{ id: 'default', name: 'Page 1', order: 0, fields: [] }]);
        
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
          permissions: safeParseJson(formData.permissions, { view: ['*'], submit: ['*'], edit: ['admin'] }),
          shareSettings: safeParseJson(formData.share_settings, { allowPublicAccess: false, sharedUsers: [] }),
          fieldRules: safeParseJson(formData.field_rules, []),
          formRules: safeParseJson(formData.form_rules, []),
          layout: safeParseJson(formData.layout, { columns: 1 }),
          pages: parsedPages,
          reference_id: formData.reference_id,
          fields: (fieldsData || []).map(field => {
            // Find which page this field belongs to
            let assignedPageId = 'default';
            for (const page of parsedPages) {
              if (page.fields && page.fields.includes(field.id)) {
                assignedPageId = page.id;
                break;
              }
            }
            
            return {
              id: field.id,
              type: field.field_type as FormField['type'],
              label: field.label,
              placeholder: field.placeholder || '',
              required: field.required || false,
              defaultValue: field.default_value || '',
              options: safeParseJson(field.options, []),
              validation: safeParseJson(field.validation, {}),
              validationRules: [],
              permissions: safeParseJson(field.permissions, { read: ['*'], write: ['*'] }),
              triggers: safeParseJson(field.triggers, []),
              isVisible: field.is_visible !== false,
              isEnabled: field.is_enabled !== false,
              currentValue: field.current_value || '',
              tooltip: field.tooltip || '',
              errorMessage: field.error_message || '',
              customConfig: safeParseJson(field.custom_config, {}),
              pageId: assignedPageId
            };
          })
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
