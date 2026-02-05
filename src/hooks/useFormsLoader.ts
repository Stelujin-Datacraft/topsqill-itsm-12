import { useState } from 'react';
 import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField } from '@/types/form';
import { toast } from '@/hooks/use-toast';
 import { useCachedUserPermissions } from './useCachedUserPermissions';

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

  const loadForms = async (
    organizationId: string, 
    projectId?: string,
    cachedPermissions?: {
      userId: string;
      isAnyAdmin: boolean;
      formPermissions: Map<string, Set<string>>;
      isProjectMember: boolean;
    }
  ) => {
    try {
      setLoading(true);

      if (!projectId) {
        setForms([]);
        return;
      }

      // Use cached permissions if available, otherwise fetch fresh
      let userId: string;
      let isAnyAdmin: boolean;
      let formPermissions: Map<string, Set<string>>;
      let isProjectMember: boolean;
 
      if (cachedPermissions) {
        userId = cachedPermissions.userId;
        isAnyAdmin = cachedPermissions.isAnyAdmin;
        formPermissions = cachedPermissions.formPermissions;
        isProjectMember = cachedPermissions.isProjectMember;
      } else {
        // Fallback: fetch user directly (for cases where cached permissions aren't available)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setForms([]);
          return;
        }
        userId = user.id;
        
        // Fetch permissions in parallel
        const [profileResult, projectUserResult, projectResult] = await Promise.all([
          supabase.from('user_profiles').select('role').eq('id', userId).single(),
          supabase.from('project_users').select('role').eq('project_id', projectId).eq('user_id', userId).maybeSingle(),
          supabase.from('projects').select('created_by').eq('id', projectId).single()
        ]);
        
        const isOrgAdmin = profileResult.data?.role === 'admin';
        const isProjectAdmin = projectUserResult.data?.role === 'admin';
        const isProjectCreator = projectResult.data?.created_by === userId;
        isAnyAdmin = isOrgAdmin || isProjectAdmin || isProjectCreator;
        isProjectMember = !!projectUserResult.data;
        formPermissions = new Map();
        
        // Only fetch role permissions if not admin
        if (!isAnyAdmin) {
          const { data: roleAssignments } = await supabase
            .from('user_role_assignments')
            .select('role_id')
            .eq('user_id', userId);
          
          if (roleAssignments && roleAssignments.length > 0) {
            const roleIds = roleAssignments.map(a => a.role_id);
            const { data: perms } = await supabase
              .from('role_permissions')
              .select('*')
              .in('role_id', roleIds)
              .eq('resource_type', 'form');
            
            perms?.forEach(perm => {
              if (perm.resource_id) {
                if (!formPermissions.has(perm.resource_id)) {
                  formPermissions.set(perm.resource_id, new Set());
                }
                formPermissions.get(perm.resource_id)!.add(perm.permission_type);
              }
            });
          }
        }
      }
 
      // Check project access
      if (!isAnyAdmin && !isProjectMember) {
        setForms([]);
        return;
      }
 
      // Fetch all forms for the project
      const { data: allForms, error: formsError } = await supabase
        .from('forms')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });
 
      if (formsError) throw formsError;
 
      // Filter forms based on permissions
      let formsData = allForms || [];
      if (!isAnyAdmin) {
        formsData = formsData.filter(form => {
          if (form.is_public) return true;
          if (form.created_by === userId) return true;
          return formPermissions.get(form.id)?.has('read') ?? false;
        });
      }
 
      // OPTIMIZATION: Batch fetch all fields for all forms in a single query
      const formIds = formsData.map(form => form.id);
      let allFieldsData: any[] = [];
      
      if (formIds.length > 0) {
        const { data: fieldsData, error: fieldsError } = await supabase
          .from('form_fields')
          .select('*')
          .in('form_id', formIds)
          .order('field_order', { ascending: true });
        
        if (!fieldsError) {
          allFieldsData = fieldsData || [];
        }
      }
 
      // Group fields by form_id for O(1) lookup
      const fieldsByFormId = new Map<string, any[]>();
      allFieldsData.forEach(field => {
        const formId = field.form_id;
        if (!fieldsByFormId.has(formId)) {
          fieldsByFormId.set(formId, []);
        }
        fieldsByFormId.get(formId)!.push(field);
      });
 
      // Process forms synchronously
      const formsWithFields = formsData.map((form) => {
        const fieldsData = fieldsByFormId.get(form.id) || [];
        const parsedPages = safeParseJson(form.pages, [{ id: 'default', name: 'Page 1', order: 0, fields: [] }]);
        
        const allFieldIds = fieldsData.map(field => field.id);
        const updatedPages = parsedPages;
 
        const assignedFieldIds = updatedPages.flatMap((page: any) => page.fields || []);
        const unassignedFields = allFieldIds.filter((fieldId: string) => !assignedFieldIds.includes(fieldId));
        
        if (unassignedFields.length > 0 && updatedPages[0]) {
          updatedPages[0].fields = [...(updatedPages[0].fields || []), ...unassignedFields];
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
          fields: fieldsData.map(field => {
            let assignedPageId = 'default';
            for (const page of updatedPages) {
              if (page.fields?.includes(field.id)) {
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
      });
 
      setForms(formsWithFields);
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
