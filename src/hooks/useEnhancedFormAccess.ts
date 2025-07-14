
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

      // Use the any type to bypass TypeScript checks for the RPC call
      const { data, error } = await supabase.rpc('get_enhanced_form_user_permissions' as any, {
        _project_id: currentProject.id,
        _form_id: formId
      });

      if (error) {
        console.error('❌ [ENHANCED FORM ACCESS] Error loading users:', error);
        toast({
          title: "Error",
          description: "Failed to load form permissions",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ [ENHANCED FORM ACCESS] Loaded users:', data);
      
      // Cast the data to the expected type
      const enhancedUsers = (data || []) as EnhancedFormUser[];
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

      const { error } = await supabase
        .from('form_user_access')
        .insert({
          form_id: formId,
          user_id: userId,
          role: 'viewer',
          status: 'active'
        });

      if (error) throw error;

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

      if (error) throw error;

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
