
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
      console.log('🔍 Query:', 'project_users with left join to user_profiles');

      // Get project members with their user profile information
      const { data: members, error } = await supabase
        .from('project_users')
        .select(`
          id,
          user_id,
          role,
          user_profiles(
            email,
            first_name,
            last_name
          )
        `)
        .eq('project_id', projectId);

      console.log('🔍 Raw members data from Supabase:', members);

      if (error) {
        console.error('❌ Error loading project members:', error);
        throw error;
      }

      // Transform the data to match our interface
      const transformedMembers = (members || []).map((member: any) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        email: member.user_profiles?.email || 'Unknown',
        first_name: member.user_profiles?.first_name || '',
        last_name: member.user_profiles?.last_name || '',
      }));

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
