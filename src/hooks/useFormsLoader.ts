import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField } from '@/types/form';
import { toast } from '@/hooks/use-toast';

export function useFormsLoader() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  const safeParseJson = (jsonString: any, fallback: any = null) => {
    if (!jsonString) return fallback;
    if (typeof jsonString === 'object') return jsonString;
    
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  };

  const getAccessibleForms = async (organizationId: string, projectId: string, userId: string) => {
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isOrgAdmin = userProfile?.role === 'admin';

    const { data: projectAccess, error: accessError } = await supabase
      .from('project_users')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single();

    const isProjectCreator = project?.created_by === userId;
    const isProjectAdmin = projectAccess?.role === 'admin';
    const isAnyAdmin = isOrgAdmin || isProjectAdmin || isProjectCreator;

    const { data: roleAssignments, error: roleError } = await supabase
      .from('user_role_assignments')
      .select(`
        id,
        role_id,
        roles (
          id,
          name,
          description
        )
      `)
      .eq('user_id', userId);

    const rolePermissionsMap = new Map<string, any[]>();
    
    if (roleAssignments && roleAssignments.length > 0) {
      const roleIds = roleAssignments.map(assignment => assignment.role_id);
      
      const { data: rolePermissions, error: permError } = await supabase
        .from('role_permissions')
        .select('*')
        .in('role_id', roleIds);

      if (!permError) {
        rolePermissions?.forEach(perm => {
          if (!rolePermissionsMap.has(perm.role_id)) {
            rolePermissionsMap.set(perm.role_id, []);
          }
          rolePermissionsMap.get(perm.role_id)?.push(perm);
        });
      }
    }

    const userFormPermissions = new Map<string, Set<string>>();

    if (roleAssignments && roleAssignments.length > 0) {
      roleAssignments.forEach((assignment) => {
        const permissions = rolePermissionsMap.get(assignment.role_id) || [];

        permissions.forEach((perm: any) => {
          if (perm.resource_type === 'form' && perm.resource_id) {
            if (!userFormPermissions.has(perm.resource_id)) {
              userFormPermissions.set(perm.resource_id, new Set());
            }
            userFormPermissions.get(perm.resource_id)?.add(perm.permission_type);
          }
        });
      });
    }

    if (isAnyAdmin) {
      const { data: allForms, error } = await supabase
        .from('forms')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return allForms || [];
    }

    const { data: allForms, error: formsError } = await supabase
      .from('forms')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (formsError) {
      throw formsError;
    }

    if (!allForms || allForms.length === 0) {
      return [];
    }

    const accessibleForms = allForms.filter((form) => {
      if (form.is_public) {
        return true;
      }

      if (form.created_by === userId) {
        return true;
      }

      const formPermissions = userFormPermissions.get(form.id);

      if (formPermissions && formPermissions.has('read')) {
        return true;
      }

      return false;
    });

    return accessibleForms;
  };

  const loadForms = async (organizationId: string, projectId?: string) => {
    try {
      setLoading(true);

      if (!projectId) {
        setForms([]);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setForms([]);
        return;
      }

      const { data: projectAccess, error: accessError } = await supabase
        .from('project_users')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .single();

      const isProjectCreator = project?.created_by === user.id;
      const isProjectMember = !!projectAccess;

      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isOrgAdmin = userProfile?.role === 'admin';

      if (isOrgAdmin || isProjectCreator || isProjectMember) {
        const formsData = await getAccessibleForms(organizationId, projectId, user.id);

        const formsWithFields = await Promise.all(
          (formsData || []).map(async (form) => {
            const { data: fieldsData, error: fieldsError } = await supabase
              .from('form_fields')
              .select('*')
              .eq('form_id', form.id)
              .order('field_order', { ascending: true });

            const parsedPages = safeParseJson(form.pages, [{ id: 'default', name: 'Page 1', order: 0, fields: [] }]);
            
            const allFieldIds = (fieldsData || []).map(field => field.id);
            
            const updatedPages = parsedPages;

            const assignedFieldIds = updatedPages.flatMap(page => page.fields || []);
            const unassignedFields = allFieldIds.filter(fieldId => !assignedFieldIds.includes(fieldId));
            
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
                  permissions: safeParseJson(field.permissions, { read: ['*'], write: ['*'] }),
                  triggers: safeParseJson(field.triggers, []),
                  isVisible: field.is_visible !== false,
                  isEnabled: field.is_enabled !== false,
                  currentValue: field.current_value || '',
                  tooltip: field.tooltip || '',
                  errorMessage: field.error_message || '',
                  pageId: assignedPageId,
                  customConfig: safeParseJson(field.custom_config, {}),
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
      } else {
        setForms([]);
      }
    } catch (error) {
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
