
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/hooks/use-toast';

export interface FormAccessSources {
  is_creator: boolean;
  project_role: string;
  assigned_roles: string[];
  direct_access: string | null;
  has_top_level_perms: boolean;
}

export interface FormPermissions {
  view_form: boolean;
  create_form: boolean;
  update_form: boolean;
  read_form: boolean;
  delete_form: boolean;
}

export interface EnhancedFormUser {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  access_sources: FormAccessSources;
  permissions: FormPermissions;
}

export function useEnhancedFormAccess(formId: string) {
  const [users, setUsers] = useState<EnhancedFormUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { currentProject } = useProject();

  const loadUsers = async () => {
    if (!formId || !currentProject?.id) return;

    try {
      setLoading(true);
      console.log('🔍 [ENHANCED FORM ACCESS] Loading users for form:', formId);

      // Get form info first
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('created_by, is_public')
        .eq('id', formId)
        .single();

      if (formError) {
        console.error('❌ [ENHANCED FORM ACCESS] Error loading form:', formError);
        throw formError;
      }

      // Get project users without the join first
      const { data: projectUsers, error: usersError } = await supabase
        .from('project_users')
        .select('user_id, role')
        .eq('project_id', currentProject.id);

      if (usersError) {
        console.error('❌ [ENHANCED FORM ACCESS] Error loading project users:', usersError);
        throw usersError;
      }

      // Get direct form access users (might not be in project_users)
      const { data: formAccess, error: accessError } = await supabase
        .from('form_user_access')
        .select('user_id, role, status')
        .eq('form_id', formId)
        .eq('status', 'active');

      if (accessError && accessError.code !== 'PGRST116') {
        console.error('❌ [ENHANCED FORM ACCESS] Error loading form access:', accessError);
      }

      // Combine all user IDs (project users + form access users)
      const projectUserIds = projectUsers?.map(u => u.user_id) || [];
      const formAccessUserIds = formAccess?.map(u => u.user_id) || [];
      const allUserIds = [...new Set([...projectUserIds, ...formAccessUserIds])];

      // Get user profiles for all users
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .in('id', allUserIds);

      if (profilesError) {
        console.error('❌ [ENHANCED FORM ACCESS] Error loading user profiles:', profilesError);
        throw profilesError;
      }

      // Get user role assignments for all users
      const { data: roleAssignments, error: rolesError } = await supabase
        .from('user_role_assignments')
        .select(`
          user_id,
          roles!inner(
            name,
            role_permissions!inner(
              permission_type,
              resource_type,
              resource_id
            )
          )
        `)
        .in('user_id', allUserIds);

      if (rolesError && rolesError.code !== 'PGRST116') {
        console.error('❌ [ENHANCED FORM ACCESS] Error loading role assignments:', rolesError);
      }

      // Get top-level permissions
      const { data: topLevelPerms, error: topLevelError } = await supabase
        .from('project_top_level_permissions')
        .select('user_id, can_create, can_read, can_update, can_delete')
        .eq('project_id', currentProject.id)
        .eq('entity_type', 'forms');

      if (topLevelError && topLevelError.code !== 'PGRST116') {
        console.error('❌ [ENHANCED FORM ACCESS] Error loading top-level permissions:', topLevelError);
      }

      // Process all users (both project users and form access users) and build enhanced user list
      const enhancedUsers: EnhancedFormUser[] = allUserIds.map(userId => {
        const userProfile = (userProfiles || []).find(p => p.id === userId);
        const projectUser = (projectUsers || []).find(pu => pu.user_id === userId);
        const directAccess = (formAccess || []).find(fa => fa.user_id === userId);
        const userRoles = (roleAssignments || []).filter(ra => ra.user_id === userId);
        const topLevelPerm = (topLevelPerms || []).find(tlp => tlp.user_id === userId);

        // Determine access sources
        const isCreator = formData?.created_by === userId;
        const projectRole = projectUser?.role || 'member'; // Default to member if not in project
        const isAdmin = projectRole === 'admin';
        const assignedRoles = userRoles.map(ur => ur.roles?.name || 'Unknown Role').filter(Boolean);
        const hasTopLevelPerms = !!topLevelPerm;

        // Calculate permissions based on hierarchy
        const hasFormPermissions = userRoles.some(ur => 
          ur.roles?.role_permissions?.some(rp => 
            rp.resource_type === 'form' && 
            (rp.resource_id === formId || rp.resource_id === null)
          )
        );

        const permissions: FormPermissions = {
          view_form: isCreator || isAdmin || !!directAccess || hasFormPermissions || formData?.is_public || false,
          create_form: isCreator || isAdmin || topLevelPerm?.can_create || hasFormPermissions || false,
          update_form: isCreator || isAdmin || topLevelPerm?.can_update || hasFormPermissions || false,
          read_form: isCreator || isAdmin || topLevelPerm?.can_read || hasFormPermissions || false,
          delete_form: isCreator || isAdmin || topLevelPerm?.can_delete || hasFormPermissions || false
        };

        return {
          user_id: userId,
          email: userProfile?.email || 'Unknown',
          first_name: userProfile?.first_name || null,
          last_name: userProfile?.last_name || null,
          access_sources: {
            is_creator: isCreator,
            project_role: projectRole,
            assigned_roles: assignedRoles,
            direct_access: directAccess?.role || null,
            has_top_level_perms: hasTopLevelPerms
          },
          permissions
        };
      });

      console.log('✅ [ENHANCED FORM ACCESS] Loaded enhanced users:', enhancedUsers);
      setUsers(enhancedUsers);
    } catch (error) {
      console.error('❌ [ENHANCED FORM ACCESS] Unexpected error:', error);
      toast({
        title: "Error",
        description: "Failed to load form permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addViewer = async (userId: string) => {
    if (!currentProject?.id) return;

    try {
      setUpdating(userId);
      console.log('👥 [ENHANCED FORM ACCESS] Adding viewer:', { userId, formId });

      // Check if form_user_access table exists, if not create the record in a different way
      const { error } = await supabase
        .from('form_user_access')
        .insert({
          form_id: formId,
          user_id: userId,
          role: 'viewer',
          status: 'active'
        });

      if (error) {
        // If table doesn't exist, we'll need to handle this differently
        if (error.code === 'PGRST116') {
          console.log('📝 [ENHANCED FORM ACCESS] form_user_access table not found, using workaround');
          toast({
            title: "Feature not available",
            description: "Direct viewer assignment requires database setup",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Viewer added",
        description: "User has been granted view access to the form",
      });

      await loadUsers();
    } catch (error) {
      console.error('❌ [ENHANCED FORM ACCESS] Error adding viewer:', error);
      toast({
        title: "Error",
        description: "Failed to add viewer access",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const removeViewer = async (userId: string) => {
    if (!currentProject?.id) return;

    try {
      setUpdating(userId);
      console.log('👥 [ENHANCED FORM ACCESS] Removing viewer:', { userId, formId });

      const { error } = await supabase
        .from('form_user_access')
        .delete()
        .eq('form_id', formId)
        .eq('user_id', userId);

      if (error) {
        // If table doesn't exist, handle gracefully
        if (error.code === 'PGRST116') {
          console.log('📝 [ENHANCED FORM ACCESS] form_user_access table not found');
          toast({
            title: "Feature not available",
            description: "Direct viewer management requires database setup",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Viewer removed",
        description: "User's view access has been revoked",
      });

      await loadUsers();
    } catch (error) {
      console.error('❌ [ENHANCED FORM ACCESS] Error removing viewer:', error);
      toast({
        title: "Error",
        description: "Failed to remove viewer access",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [formId, currentProject?.id]);

  return {
    users,
    loading,
    updating,
    addViewer,
    removeViewer,
    reloadUsers: loadUsers
  };
}
