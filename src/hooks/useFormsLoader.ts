
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

  // Helper function to get accessible forms with proper access control
  const getAccessibleForms = async (organizationId: string, projectId: string, userId: string) => {
    console.log('🔍 Getting accessible forms for user:', userId, 'in project:', projectId);

    // Get user's organization role
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.log('Error getting user profile:', profileError);
    }

    const isOrgAdmin = userProfile?.role === 'admin';

    // Check if user is project admin or creator
    const { data: projectAccess, error: accessError } = await supabase
      .from('project_users')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (accessError) {
      console.log('Error checking project access:', accessError);
    }

    // Check if user is project creator
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.log('Error getting project info:', projectError);
    }

    const isProjectCreator = project?.created_by === userId;
    const isProjectAdmin = projectAccess?.role === 'admin';
    const isAnyAdmin = isOrgAdmin || isProjectAdmin || isProjectCreator;

    console.log('🔐 Access check results:', {
      isOrgAdmin,
      isProjectAdmin,
      isProjectCreator,
      isAnyAdmin
    });

    // If user is any type of admin, get all forms
    if (isAnyAdmin) {
      console.log('👑 Admin user - loading all forms');
      const { data: allForms, error } = await supabase
        .from('forms')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading all forms for admin:', error);
        throw error;
      }

      return allForms || [];
    }

    // For non-admin users, we need to filter based on form visibility and permissions
    console.log('👤 Regular user - filtering forms by access');

    // Get all forms first
    const { data: allForms, error: formsError } = await supabase
      .from('forms')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (formsError) {
      console.error('Error loading forms:', formsError);
      throw formsError;
    }

    if (!allForms || allForms.length === 0) {
      return [];
    }

    // Get user's role permissions for forms
    const { data: roleAssignments, error: roleError } = await supabase
      .from('user_role_assignments')
      .select(`
        role_id,
        roles!inner(
          name,
          role_permissions!inner(
            resource_type,
            resource_id,
            permission_type
          )
        )
      `)
      .eq('user_id', userId);

    if (roleError) {
      console.error('Error loading role assignments:', roleError);
    }

    // Extract form IDs that user has explicit access to
    const accessibleFormIds = new Set<string>();
    
    if (roleAssignments && roleAssignments.length > 0) {
      roleAssignments.forEach(assignment => {
        const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
        if (role && role.role_permissions) {
          role.role_permissions.forEach((perm: any) => {
            if (perm.resource_type === 'form' && perm.resource_id && perm.permission_type === 'read') {
              accessibleFormIds.add(perm.resource_id);
              console.log('📋 User has read access to form:', perm.resource_id);
            }
          });
        }
      });
    }

    // Filter forms based on visibility rules
    const accessibleForms = allForms.filter(form => {
      // Rule 1: If form is public, user can see it (they already have project access)
      if (form.is_public) {
        console.log('🌐 Public form accessible:', form.name);
        return true;
      }

      // Rule 2: If form is private, user needs explicit permission
      if (accessibleFormIds.has(form.id)) {
        console.log('🔒 Private form accessible via role:', form.name);
        return true;
      }

      // Rule 3: If user created the form, they can see it
      if (form.created_by === userId) {
        console.log('👤 Form accessible as creator:', form.name);
        return true;
      }

      console.log('❌ Form not accessible:', form.name, 'is_public:', form.is_public);
      return false;
    });

    console.log('✅ Filtered forms:', accessibleForms.length, 'out of', allForms.length);
    return accessibleForms;
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
        console.log('useFormsLoader: User has project access, loading accessible forms');
        
        // Get forms with proper access control filtering
        const formsData = await getAccessibleForms(organizationId, projectId, user.id);

        console.log('useFormsLoader: Accessible forms loaded:', formsData?.length || 0, 'forms found');

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
            
            const updatedPages = parsedPages;
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
