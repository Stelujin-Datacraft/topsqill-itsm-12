
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
      console.log('🔍 Loading project members for project:', projectId);

      // First, get project users
      const { data: projectUsers, error: projectUsersError } = await supabase
        .from('project_users')
        .select('id, user_id, role')
        .eq('project_id', projectId);

      console.log('🔍 Raw project users data:', projectUsers);

      if (projectUsersError) {
        console.error('❌ Error loading project users:', projectUsersError);
        throw projectUsersError;
      }

      if (!projectUsers || projectUsers.length === 0) {
        console.log('🔍 No project users found');
        setProjectMembers([]);
        setLoading(false);
        return;
      }

      // Extract user IDs
      const userIds = projectUsers.map(user => user.user_id);
      console.log('🔍 User IDs to fetch profiles for:', userIds);

      // Then, get user profiles for those users
      const { data: userProfiles, error: userProfilesError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      console.log('🔍 Raw user profiles data:', userProfiles);

      if (userProfilesError) {
        console.error('❌ Error loading user profiles:', userProfilesError);
        throw userProfilesError;
      }

      // Combine the data
      const transformedMembers = projectUsers.map((projectUser: any) => {
        const userProfile = userProfiles?.find(profile => profile.id === projectUser.user_id);
        return {
          id: projectUser.id,
          user_id: projectUser.user_id,
          role: projectUser.role,
          email: userProfile?.email || 'Unknown',
          first_name: userProfile?.first_name || '',
          last_name: userProfile?.last_name || '',
        };
      });

      console.log('🔍 Final transformed members:', transformedMembers);
      setProjectMembers(transformedMembers);
    } catch (error) {
      console.error('❌ Error loading project members:', error);
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
