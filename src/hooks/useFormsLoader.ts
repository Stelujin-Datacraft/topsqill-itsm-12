
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField } from '@/types/form';
import { toast } from '@/hooks/use-toast';

export function useFormsLoader() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper function to safely parse JSON
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

  const loadForms = async (organizationId: string, projectId?: string) => {
    try {
      setLoading(true);
      console.log('useFormsLoader: Loading forms for organization:', organizationId, 'project:', projectId);

      if (!projectId) {
        console.log('useFormsLoader: No project selected, loading no forms');
        setForms([]);
        return;
      }

      // Get current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('useFormsLoader: No authenticated user');
        setForms([]);
        return;
      }

      console.log('useFormsLoader: Current user ID:', user.id);

      // Check if user has ANY access to this project (member, admin, or creator)
      const { data: projectAccess, error: accessError } = await supabase
        .from('project_users')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (accessError) {
        console.log('useFormsLoader: Error checking project access:', accessError);
      }

      // Check if user is project creator
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.log('useFormsLoader: Error getting project info:', projectError);
      }

      const isProjectCreator = project?.created_by === user.id;
      const isProjectMember = !!projectAccess;

      // Get user's organization role
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.log('useFormsLoader: Error getting user profile:', profileError);
      }

      const isOrgAdmin = userProfile?.role === 'admin';

      console.log('useFormsLoader: Access check results:', {
        isOrgAdmin,
        isProjectCreator,
        isProjectMember,
        projectRole: projectAccess?.role
      });

      // Allow access if user has ANY connection to the project
      if (isOrgAdmin || isProjectCreator || isProjectMember) {
        console.log('useFormsLoader: User has project access, loading forms');
        
        const { data: formsData, error } = await supabase
          .from('forms')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('useFormsLoader: Error loading forms:', error);
          throw error;
        }

        console.log('useFormsLoader: Raw forms data:', formsData?.length || 0, 'forms found');

        // Load fields for each form
        const formsWithFields = await Promise.all(
          (formsData || []).map(async (form) => {
            const { data: fieldsData, error: fieldsError } = await supabase
              .from('form_fields')
              .select('*')
              .eq('form_id', form.id)
              .order('field_order', { ascending: true });

            if (fieldsError) {
              console.error('useFormsLoader: Error loading fields for form', form.id, fieldsError);
            }

            // Parse pages first to determine correct field assignments
            const parsedPages = safeParseJson(form.pages, [{ id: 'default', name: 'Page 1', order: 0, fields: [] }]);
            console.log('useFormsLoader: Parsed pages:', parsedPages);
            
            // Create a map of all field IDs for quick lookup
            const allFieldIds = (fieldsData || []).map(field => field.id);
            console.log('useFormsLoader: All field IDs:', allFieldIds);
            console.log()
            // Assign unassigned fields to the first page if pages exist but don't have field assignments
            // const updatedPages = parsedPages.map(page => {
            //   // If page already has fields assigned, keep them
            //   if (page.fields && page.fields.length > 0) {
            //     // Filter to only include fields that actually exist in the database
            //     const existingFields = page.fields.filter(fieldId => allFieldIds.includes(fieldId));
            //     return { ...page, fields: existingFields };
            //   }
            //   return page;
            // });
            const updatedPages = parsedPages;
            console.log(" UPDATED FORM  ")
            console.log('useFormsLoader: Updated pages after filtering:', updatedPages);

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

            return {
              id: form.id,
              name: form.name,
              description: form.description || '',
              organizationId: form.organization_id || '',
              projectId: form.project_id || '',
              status: form.status as 'draft' | 'published',
              createdAt: form.created_at,
              updatedAt: form.updated_at,
              createdBy: form.created_by,
              isPublic: form.is_public || false,
              fields: (fieldsData || []).map(field => {
                // Find which page this field belongs to after our assignment logic
                let assignedPageId = 'default';
                for (const page of updatedPages) {
                  if (page.fields && page.fields.includes(field.id)) {
                    assignedPageId = page.id;
                    break;
                  }
                }
                console.log(`useFormsLoader: Field ${field.id} (${field.label}) assigned to page: ${assignedPageId}`);
                
                return {
                  id: field.id,
                  type: field.field_type as FormField['type'],
                  label: field.label,
                  placeholder: field.placeholder || '',
                  required: field.required || false,
                  defaultValue: field.default_value || '',
                  options: safeParseJson(field.options, []),
                  validation: safeParseJson(field.validation, {}),
                  permissions: safeParseJson(field.permissions, { read: ['*'], write: ['*'] }),
                  triggers: safeParseJson(field.triggers, []),
                  isVisible: field.is_visible !== false,
                  isEnabled: field.is_enabled !== false,
                  currentValue: field.current_value || '',
                  tooltip: field.tooltip || '',
                  errorMessage: field.error_message || '',
                  pageId: assignedPageId,
                };
              }),
              permissions: safeParseJson(form.permissions, { view: ['*'], submit: ['*'], edit: ['admin'] }),
              fieldRules: safeParseJson(form.field_rules, []),
              formRules: safeParseJson(form.form_rules, []),
              shareSettings: safeParseJson(form.share_settings, { allowPublicAccess: false, sharedUsers: [] }),
              layout: safeParseJson(form.layout, { columns: 1 }),
              pages: updatedPages,
            } as Form;
          })
        );

        setForms(formsWithFields);
        console.log('useFormsLoader: Forms loaded successfully:', formsWithFields.length, 'forms');
      } else {
        console.log('useFormsLoader: User has no project access');
        setForms([]);
      }
    } catch (error) {
      console.error('useFormsLoader: Error loading forms:', error);
      toast({
        title: "Error loading forms",
        description: "Failed to load your forms from the database.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    forms,
    setForms,
    loading,
    loadForms,
  };
}
