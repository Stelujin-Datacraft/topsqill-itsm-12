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
  } catch {
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
        
        // Create a map of all field IDs for quick lookup
        const allFieldIds = (fieldsData || []).map(field => field.id);

        // Assign fields to pages properly
        const updatedPages = parsedPages.map(page => {
          // If page already has fields assigned, keep them
          if (page.fields && page.fields.length > 0) {
            // Filter to only include fields that actually exist in the database
            const existingFields = page.fields.filter(fieldId => allFieldIds.includes(fieldId));
            return { ...page, fields: existingFields };
          }
          return page;
        });

        // Find unassigned fields (fields not in any page)
        const assignedFieldIds = updatedPages.flatMap(page => page.fields || []);
        const unassignedFields = allFieldIds.filter(fieldId => !assignedFieldIds.includes(fieldId));

        // If there are unassigned fields, assign them to the first page
        if (unassignedFields.length > 0) {
          const firstPage = updatedPages[0];
          if (firstPage) {
            firstPage.fields = [...(firstPage.fields || []), ...unassignedFields];
          }
        }

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
          pages: updatedPages,
          reference_id: formData.reference_id,
          fields: (fieldsData || []).map(field => {
            // Find which page this field belongs to after our assignment logic
            let assignedPageId = 'default';
            for (const page of updatedPages) {
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
