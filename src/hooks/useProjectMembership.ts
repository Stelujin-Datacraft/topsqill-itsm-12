
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectMember {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'editor' | 'viewer' | 'member';
  user_id: string;
}

export function useProjectMembership(projectId: string) {
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const loadProjectMembers = async () => {
    if (!projectId) {
      setProjectMembers([]);
      setLoading(false);
      return;
    }

    try {
      console.log('Loading project members for project:', projectId);

      // Get project users first
      const { data: projectUsersData, error: projectUsersError } = await supabase
        .from('project_users')
        .select('id, user_id, role')
        .eq('project_id', projectId);

      if (projectUsersError) {
        console.error('Error loading project users:', projectUsersError);
        throw projectUsersError;
      }

      if (!projectUsersData || projectUsersData.length === 0) {
        console.log('No users found for project:', projectId);
        return;
      }

      // Get user profiles separately
      const userIds = projectUsersData.map(pu => pu.user_id);
      
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      if (usersError) {
        console.error('Error loading user profiles:', usersError);
        throw usersError;
      }

      // Transform and combine the data
      const transformedMembers = (projectUsersData || []).map(projectUser => {
        const userProfile = (usersData || []).find(u => u.id === projectUser.user_id);
        return {
          id: projectUser.id,
          user_id: projectUser.user_id,
          role: projectUser.role as 'admin' | 'editor' | 'viewer' | 'member',
          email: userProfile?.email || '',
          first_name: userProfile?.first_name,
          last_name: userProfile?.last_name,
        };
      });

      console.log('Project members loaded:', transformedMembers);
      setProjectMembers(transformedMembers);
    } catch (error) {
      console.error('Error loading project members:', error);
      setProjectMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const isProjectMember = (userId: string): boolean => {
    return projectMembers.some(member => member.user_id === userId);
  };

  const canAssignAsEditor = (userId: string): boolean => {
    return isProjectMember(userId);
  };

  const canAssignAsAdmin = (userId: string): boolean => {
    return isProjectMember(userId);
  };

  useEffect(() => {
    loadProjectMembers();
  }, [projectId]);

  return {
    projectMembers,
    loading,
    isProjectMember,
    canAssignAsEditor,
    canAssignAsAdmin,
    loadProjectMembers
  };
}
