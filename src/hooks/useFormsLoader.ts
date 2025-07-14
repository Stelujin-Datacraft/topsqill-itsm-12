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

  // Enhanced helper function to get accessible forms with detailed logging
  const getAccessibleForms = async (organizationId: string, projectId: string, userId: string) => {
    console.log('🔍 [FORMS ACCESS] Getting accessible forms for user:', userId, 'in project:', projectId);

    // Get user's organization role
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.log('❌ [FORMS ACCESS] Error getting user profile:', profileError);
    }

    const isOrgAdmin = userProfile?.role === 'admin';
    console.log('👑 [FORMS ACCESS] User org admin status:', isOrgAdmin);

    // Check if user is project admin or creator
    const { data: projectAccess, error: accessError } = await supabase
      .from('project_users')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (accessError) {
      console.log('❌ [FORMS ACCESS] Error checking project access:', accessError);
    }

    // Check if user is project creator
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.log('❌ [FORMS ACCESS] Error getting project info:', projectError);
    }

    const isProjectCreator = project?.created_by === userId;
    const isProjectAdmin = projectAccess?.role === 'admin';
    const isAnyAdmin = isOrgAdmin || isProjectAdmin || isProjectCreator;

    console.log('🔐 [FORMS ACCESS] Access check results:', {
      isOrgAdmin,
      isProjectAdmin,
      isProjectCreator,
      isAnyAdmin,
      projectRole: projectAccess?.role
    });

    // Get user's role assignments with detailed logging
    const { data: roleAssignments, error: roleError } = await supabase
      .from('user_role_assignments')
      .select(`
        id,
        role_id,
        roles!inner(
          id,
          name,
          description,
          role_permissions!inner(
            id,
            resource_type,
            resource_id,
            permission_type
          )
        )
      `)
      .eq('user_id', userId);

    if (roleError) {
      console.error('❌ [FORMS ACCESS] Error loading role assignments:', roleError);
    }

    console.log('🎭 [FORMS ACCESS] User role assignments:', roleAssignments);

    // Process role permissions with detailed logging
    const userFormPermissions = new Map<string, Set<string>>(); // formId -> Set of permissions

    if (roleAssignments && roleAssignments.length > 0) {
      roleAssignments.forEach((assignment, index) => {
        const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
        console.log(`🎭 [FORMS ACCESS] Processing role assignment ${index + 1}:`, {
          assignmentId: assignment.id,
          roleId: assignment.role_id,
          roleName: role?.name,
          roleDescription: role?.description
        });

        if (role && role.role_permissions) {
          role.role_permissions.forEach((perm: any, permIndex: number) => {
            console.log(`  📋 [FORMS ACCESS] Processing permission ${permIndex + 1}:`, {
              permissionId: perm.id,
              resourceType: perm.resource_type,
              resourceId: perm.resource_id,
              permissionType: perm.permission_type
            });

            if (perm.resource_type === 'form' && perm.resource_id) {
              if (!userFormPermissions.has(perm.resource_id)) {
                userFormPermissions.set(perm.resource_id, new Set());
              }
              userFormPermissions.get(perm.resource_id)?.add(perm.permission_type);
              console.log(`  ✅ [FORMS ACCESS] Added ${perm.permission_type} permission for form ${perm.resource_id}`);
            }
          });
        }
      });
    }

    console.log('📊 [FORMS ACCESS] Final user form permissions map:', Object.fromEntries(
      Array.from(userFormPermissions.entries()).map(([formId, perms]) => [
        formId, 
        Array.from(perms)
      ])
    ));

    // If user is any type of admin, get all forms
    if (isAnyAdmin) {
      console.log('👑 [FORMS ACCESS] Admin user - loading all forms');
      const { data: allForms, error } = await supabase
        .from('forms')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ [FORMS ACCESS] Error loading all forms for admin:', error);
        throw error;
      }

      console.log('👑 [FORMS ACCESS] Admin loaded forms:', allForms?.length || 0);
      return allForms || [];
    }

    // For non-admin users, filter based on form visibility and permissions
    console.log('👤 [FORMS ACCESS] Regular user - filtering forms by access');

    // Get all forms first
    const { data: allForms, error: formsError } = await supabase
      .from('forms')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (formsError) {
      console.error('❌ [FORMS ACCESS] Error loading forms:', formsError);
      throw formsError;
    }

    if (!allForms || allForms.length === 0) {
      console.log('📝 [FORMS ACCESS] No forms found in project');
      return [];
    }

    console.log('📝 [FORMS ACCESS] Total forms in project:', allForms.length);

    // Filter forms based on visibility rules with detailed logging
    const accessibleForms = allForms.filter((form, index) => {
      console.log(`\n🔍 [FORMS ACCESS] Checking form ${index + 1}/${allForms.length}:`, {
        formId: form.id,
        formName: form.name,
        isPublic: form.is_public,
        createdBy: form.created_by
      });

      // Rule 1: If form is public, user can see it (they already have project access)
      if (form.is_public) {
        console.log('  🌐 [FORMS ACCESS] ✅ Public form - accessible');
        return true;
      }

      // Rule 2: If user created the form, they can see it
      if (form.created_by === userId) {
        console.log('  👤 [FORMS ACCESS] ✅ Form creator - accessible');
        return true;
      }

      // Rule 3: If form is private, check role permissions
      const formPermissions = userFormPermissions.get(form.id);
      console.log('  🔒 [FORMS ACCESS] Private form permissions check:', {
        formId: form.id,
        hasPermissions: formPermissions ? Array.from(formPermissions) : 'none'
      });

      if (formPermissions && formPermissions.has('read')) {
        console.log('  🔒 [FORMS ACCESS] ✅ Private form with read permission - accessible');
        return true;
      }

      console.log('  ❌ [FORMS ACCESS] Private form with no access - not accessible');
      return false;
    });

    console.log(`\n✅ [FORMS ACCESS] Final result: ${accessibleForms.length} out of ${allForms.length} forms accessible`);
    console.log('📋 [FORMS ACCESS] Accessible forms:', accessibleForms.map(f => ({
      id: f.id,
      name: f.name,
      isPublic: f.is_public
    })));

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
