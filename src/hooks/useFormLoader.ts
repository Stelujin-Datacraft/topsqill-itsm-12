
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField, FormPage, FieldRule, FormRule } from '@/types/form';

export function useFormLoader(formId: string | undefined) {
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadForm = async () => {
      if (!formId) {
        setError('Form ID not provided');
        setLoading(false);
        return;
      }

      try {
        console.log('useFormLoader: Loading form:', formId);
        
        // Load form from Supabase
        const { data: formData, error: formError } = await supabase
          .from('forms')
          .select(`
            *,
            fields:form_fields(*)
          `)
          .eq('id', formId)
          .eq('status', 'active')
          .single();

        if (formError) {
          console.error('useFormLoader: Error loading form:', formError);
          setError('Form not found or not active');
          return;
        }

        if (!formData) {
          setError('Form not found');
          return;
        }

        // Helper function to safely parse JSON with type checking
        const safeParseJson = <T>(jsonData: any, fallback: T): T => {
          if (!jsonData) return fallback;
          if (typeof jsonData === 'string') {
            try {
              return JSON.parse(jsonData);
            } catch (error) {
              console.warn('useFormLoader: Failed to parse JSON:', jsonData, error);
              return fallback;
            }
          }
          return jsonData as T;
        };

        // Helper function to parse pages with proper typing
        const parsePages = (pagesData: any): FormPage[] => {
          if (!pagesData) {
            // Create default page if no pages exist
            return [{
              id: 'default',
              name: 'Page 1',
              order: 0,
              fields: formData.fields ? formData.fields.map((f: any) => f.id) : []
            }];
          }
          
          let parsed: any;
          if (typeof pagesData === 'string') {
            try {
              parsed = JSON.parse(pagesData);
            } catch {
              // Create default page on parse error
              return [{
                id: 'default',
                name: 'Page 1',
                order: 0,
                fields: formData.fields ? formData.fields.map((f: any) => f.id) : []
              }];
            }
          } else {
            parsed = pagesData;
          }
          
          if (Array.isArray(parsed) && parsed.length > 0) {
            const pages = parsed.map((page: any) => ({
              id: page.id || '',
              name: page.name || '',
              order: page.order || 0,
              fields: Array.isArray(page.fields) ? page.fields : []
            })) as FormPage[];
            
            // Ensure all fields are assigned to at least one page
            const allAssignedFields = pages.flatMap(p => p.fields);
            const unassignedFields = formData.fields ? 
              formData.fields.filter((f: any) => !allAssignedFields.includes(f.id)) : [];
            
            if (unassignedFields.length > 0) {
              // Add unassigned fields to the first page
              pages[0].fields = [...pages[0].fields, ...unassignedFields.map((f: any) => f.id)];
            }
            
            return pages;
          }
          
          // Fallback to default page
          return [{
            id: 'default',
            name: 'Page 1',
            order: 0,
            fields: formData.fields ? formData.fields.map((f: any) => f.id) : []
          }];
        };

        // Helper function to parse custom config based on field type
        const parseCustomConfig = (customConfigData: any, fieldType: string): any => {
          if (!customConfigData) return {};
          
          let parsed = {};
          if (typeof customConfigData === 'string') {
            try {
              parsed = JSON.parse(customConfigData);
            } catch (error) {
              console.warn('useFormLoader: Failed to parse custom_config for field type:', fieldType, error);
              return {};
            }
          } else {
            parsed = customConfigData;
          }

          console.log('useFormLoader: Parsed custom config for field type:', fieldType, parsed);
          
          // Ensure proper structure based on field type with safe property access
          const safeParsed = parsed as any;
          
          switch (fieldType) {
            case 'record-table':
            case 'matrix-grid':
            case 'cross-reference':
              return {
                targetFormId: safeParsed.targetFormId || '',
                targetFormName: safeParsed.targetFormName || '',
                displayColumns: Array.isArray(safeParsed.displayColumns) ? safeParsed.displayColumns : [],
                filters: Array.isArray(safeParsed.filters) ? safeParsed.filters : [],
                joinField: safeParsed.joinField || '',
                enableSorting: safeParsed.enableSorting !== false,
                enableSearch: safeParsed.enableSearch !== false,
                pageSize: safeParsed.pageSize || 10,
                includeMetadata: safeParsed.includeMetadata || false,
                showOnlyUserRecords: safeParsed.showOnlyUserRecords !== false,
                ...safeParsed
              };
            
            case 'select':
            case 'multi-select':
              return {
                maxSelections: safeParsed.maxSelections,
                allowOther: safeParsed.allowOther || false,
                ...safeParsed
              };
            
            case 'dynamic-dropdown':
              return {
                dataSource: safeParsed.dataSource || 'form',
                sourceFormId: safeParsed.sourceFormId || '',
                displayField: safeParsed.displayField || '',
                valueField: safeParsed.valueField || '',
                apiEndpoint: safeParsed.apiEndpoint || '',
                apiHeaders: safeParsed.apiHeaders || {},
                ...safeParsed
              };
            
            case 'calculated':
              return {
                formula: safeParsed.formula || '',
                calculateOn: safeParsed.calculateOn || 'change',
                showFormula: safeParsed.showFormula || false,
                decimalPlaces: safeParsed.decimalPlaces || 2,
                ...safeParsed
              };
            
            case 'conditional-section':
              return {
                conditions: Array.isArray(safeParsed.conditions) ? safeParsed.conditions : [],
                logic: safeParsed.logic || 'AND',
                ...safeParsed
              };
            
            default:
              return safeParsed;
          }
        };

        // Parse pages first to ensure proper field assignment
        const parsedPages = parsePages(formData.pages);

        // Transform the data to match our Form type
        const transformedForm: Form = {
          id: formData.id,
          name: formData.name,
          description: formData.description || '',
          organizationId: formData.organization_id,
          projectId: formData.project_id,
          status: formData.status as Form['status'],
          fields: (formData.fields || []).map((field: any): FormField => {
            const customConfig = parseCustomConfig(field.custom_config, field.field_type);
            console.log('useFormLoader: Processing field:', field.label, 'type:', field.field_type, 'customConfig:', customConfig);
            
            // Determine which page this field belongs to
            const fieldPageId = parsedPages.find(page => page.fields.includes(field.id))?.id || 'default';
            
            return {
              id: field.id,
              type: field.field_type as FormField['type'],
              label: field.label,
              placeholder: field.placeholder || undefined,
              required: field.required || false,
              defaultValue: field.default_value || undefined,
              options: field.options ? safeParseJson(field.options, []) : undefined,
              validation: field.validation ? safeParseJson(field.validation, {}) : undefined,
              permissions: field.permissions ? safeParseJson(field.permissions, { read: ['*'], write: ['*'] }) : undefined,
              triggers: field.triggers ? safeParseJson(field.triggers, []) : undefined,
              isVisible: field.is_visible !== false,
              isEnabled: field.is_enabled !== false,
              currentValue: field.current_value || undefined,
              tooltip: field.tooltip || undefined,
              errorMessage: field.error_message || undefined,
              pageId: fieldPageId,
              customConfig: customConfig,
            };
          }),
          permissions: safeParseJson(formData.permissions, { view: [], submit: [], edit: [] }),
          createdAt: formData.created_at,
          updatedAt: formData.updated_at,
          createdBy: formData.created_by,
          isPublic: formData.is_public,
          shareSettings: safeParseJson(formData.share_settings, { allowPublicAccess: false, sharedUsers: [] }),
          fieldRules: safeParseJson(formData.field_rules, []) as FieldRule[],
          formRules: safeParseJson(formData.form_rules, []) as FormRule[],
          layout: safeParseJson(formData.layout, { columns: 1 }),
          pages: parsedPages,
        };

        console.log('useFormLoader: Form loaded successfully with', transformedForm.fields.length, 'fields');
        console.log('useFormLoader: Pages:', transformedForm.pages);
        console.log('useFormLoader: Fields with custom config:', transformedForm.fields.filter(f => f.customConfig && Object.keys(f.customConfig).length > 0).map(f => ({ label: f.label, type: f.type, config: f.customConfig })));
        setForm(transformedForm);
      } catch (error) {
        console.error('useFormLoader: Unexpected error loading form:', error);
        setError('Failed to load form');
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [formId]);

  return { form, loading, error };
}
