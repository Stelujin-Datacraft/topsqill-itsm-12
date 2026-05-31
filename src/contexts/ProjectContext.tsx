import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useImpersonation } from './ImpersonationContext';
import { Project, ProjectPermission } from '@/types/project';

const normalizeProject = (project: any): Project => ({
  ...project,
  status: project.status as 'active' | 'archived'
});

const sortProjectsByUpdatedAt = (projectList: Project[]) =>
  [...projectList].sort(
    (a, b) =>
      new Date((b as any).updated_at || b.created_at).getTime() -
      new Date((a as any).updated_at || a.created_at).getTime()
  );

interface ProjectUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'editor' | 'viewer' | 'member';
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  loading: boolean;
  createProject: (projectData: any) => Promise<Project | null>;
  loadProjects: () => Promise<void>;
  getProjectUsers: (projectId: string) => Promise<ProjectUser[]>;
  addUserToProject: (projectId: string, userId: string, role: string) => Promise<void>;
  removeUserFromProject: (projectId: string, userId: string) => Promise<void>;
  updateUserRole: (projectId: string, userId: string, role: string) => Promise<void>;
  hasProjectPermission: (projectId: string, resourceType: string, requiredLevel: string) => Promise<boolean>;
  canCreateAssets: (projectId: string, userId: string) => Promise<boolean>;
  userProjectPermissions: Record<string, string[]>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProjectPermissions, setUserProjectPermissions] = useState<Record<string, string[]>>({});
  const latestLoadRequestRef = useRef(0);
  const { userProfile } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();

  // Determine effective user for project loading
  const effectiveUser = isImpersonating && impersonatedUser ? impersonatedUser : userProfile;
  const effectiveRole = effectiveUser?.role || 'user';

  const loadProjects = useCallback(async () => {
    const requestId = ++latestLoadRequestRef.current;
    const isStaleRequest = () => latestLoadRequestRef.current !== requestId;

    if (!effectiveUser?.organization_id || !effectiveUser?.id) {
      if (isStaleRequest()) return;
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      let projectsData = [];
      let permissionsMap: Record<string, string[]> = {};

      // Use effective role instead of userProfile.role
      if (effectiveRole === 'admin') {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('organization_id', effectiveUser.organization_id)
          .order('updated_at', { ascending: false });

        if (error) {
          throw error;
        }

        projectsData = data || [];
        
        projectsData.forEach(project => {
          permissionsMap[project.id] = ['admin', 'editor', 'viewer', 'create', 'edit', 'delete', 'view'];
        });
      } else {
        // Non-admin: fetch only projects the effective user has access to
        const { data: userProjects, error: userProjectsError } = await supabase
          .from('project_users')
          .select(`
            project_id,
            role,
            projects (*)
          `)
          .eq('user_id', effectiveUser.id);

        if (userProjectsError) {
          throw userProjectsError;
        }

        const { data: createdProjects, error: createdProjectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('created_by', effectiveUser.id)
          .eq('organization_id', effectiveUser.organization_id);

        if (createdProjectsError) {
          throw createdProjectsError;
        }

        const allProjectsMap = new Map();
        
        (userProjects || []).forEach(up => {
          if (up.projects) {
            allProjectsMap.set(up.projects.id, {
              ...up.projects,
              userRole: up.role
            });
            
            const rolePermissions = getRolePermissions(up.role);
            permissionsMap[up.projects.id] = rolePermissions;
          }
        });

        (createdProjects || []).forEach(project => {
          if (!allProjectsMap.has(project.id)) {
            allProjectsMap.set(project.id, {
              ...project,
              userRole: 'admin'
            });
          }
          permissionsMap[project.id] = getRolePermissions('admin');
        });

        projectsData = Array.from(allProjectsMap.values());
      }
      
      const typedProjects: Project[] = projectsData.map(normalizeProject);
      const sortedProjects = sortProjectsByUpdatedAt(typedProjects);

      if (isStaleRequest()) return;

      setProjects(sortedProjects);
      setUserProjectPermissions(permissionsMap);

      const savedProjectId = localStorage.getItem('currentProjectId');
      setCurrentProject((previousProject) => {
        if (previousProject) {
          const refreshedCurrentProject = sortedProjects.find(project => project.id === previousProject.id);
          if (refreshedCurrentProject) {
            return refreshedCurrentProject;
          }
        }

        if (savedProjectId) {
          const savedProject = sortedProjects.find(project => project.id === savedProjectId);
          if (savedProject) {
            return savedProject;
          }
        }

        return sortedProjects[0] || null;
      });
    } catch (error) {
      if (isStaleRequest()) return;
      console.warn('[ProjectContext] Failed to refresh projects, preserving current project state:', error);
    } finally {
      if (!isStaleRequest()) {
        setLoading(false);
      }
    }
  }, [effectiveRole, effectiveUser?.id, effectiveUser?.organization_id]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, isImpersonating]);

  const getRolePermissions = (role: string): string[] => {
    switch (role) {
      case 'admin':
        return ['admin', 'editor', 'viewer', 'create', 'edit', 'delete', 'view', 'manage_access'];
      case 'editor':
        return ['editor', 'viewer', 'create', 'edit', 'view'];
      case 'viewer':
        return ['viewer', 'view'];
      case 'member':
        return ['viewer', 'view'];
      default:
        return ['view'];
    }
  };

  const createProject = async (projectData: any) => {
    // Use real user profile for mutations, not effective user
    if (!userProfile?.organization_id) {
      return null;
    }

    if (!userProfile?.id) {
      return null;
    }

    // Only real admins can create projects (not impersonated users)
    if (userProfile.role !== 'admin') {
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          organization_id: userProfile.organization_id,
          created_by: userProfile.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      const typedProject: Project = {
        ...data,
        status: data.status as 'active' | 'archived'
      };

      await loadProjects();
      setCurrentProject(typedProject);
      
      return typedProject;
    } catch (error) {
      return null;
    }
  };

  const getProjectUsers = async (projectId: string): Promise<ProjectUser[]> => {
    try {
      const { data: projectUsersData, error: projectUsersError } = await supabase
        .from('project_users')
        .select('user_id, role')
        .eq('project_id', projectId);

      if (projectUsersError) {
        return [];
      }

      if (!projectUsersData || projectUsersData.length === 0) {
        return [];
      }

      const userIds = projectUsersData.map(pu => pu.user_id);
      
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      if (usersError) {
        return [];
      }

      const projectUsers: ProjectUser[] = (usersData || []).map(user => {
        const projectUser = projectUsersData.find(pu => pu.user_id === user.id);
        return {
          id: user.id,
          email: user.email,
          first_name: user.first_name || undefined,
          last_name: user.last_name || undefined,
          role: (projectUser?.role || 'member') as 'admin' | 'editor' | 'viewer' | 'member',
        };
      });

      return projectUsers;
    } catch (error) {
      return [];
    }
  };

  const addUserToProject = async (projectId: string, userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: userId,
          role,
          assigned_by: userProfile?.id
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const removeUserFromProject = async (projectId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const updateUserRole = async (projectId: string, userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('project_users')
        .update({ role })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const hasProjectPermission = async (projectId: string, resourceType: string, requiredLevel: string): Promise<boolean> => {
    // Use effective user for permission checks
    const userId = effectiveUser?.id;
    if (!userId) return false;

    try {
      const { data, error } = await supabase
        .rpc('has_project_permission', {
          _project_id: projectId,
          _user_id: userId,
          _resource_type: resourceType,
          _required_level: requiredLevel
        });

      if (error) {
        return false;
      }

      return data || false;
    } catch (error) {
      return false;
    }
  };

  const canCreateAssets = async (projectId: string, userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .rpc('can_create_asset_in_project', {
          _project_id: projectId,
          _user_id: userId
        });

      if (error) {
        return false;
      }

      return data || false;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('currentProjectId', currentProject.id);
    }
  }, [currentProject]);

  // If current project is deleted/removed from list, switch to next or clear
  useEffect(() => {
    if (!currentProject) return;
    if (loading) return;
    const stillExists = projects.some(p => p.id === currentProject.id);
    if (!stillExists) {
      const next = projects[0] || null;
      setCurrentProject(next);
      if (!next) {
        localStorage.removeItem('currentProjectId');
      }
    }
  }, [projects, currentProject, loading]);

  // Realtime: react to project deletions instantly
  useEffect(() => {
    if (!effectiveUser?.organization_id) return;
    const channel = supabase
      .channel(`projects-changes-${effectiveUser.organization_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'projects',
          filter: `organization_id=eq.${effectiveUser.organization_id}`,
        },
        (payload) => {
          const createdProject = payload.new ? normalizeProject(payload.new) : null;
          if (!createdProject) return;
          setProjects(prev => {
            const withoutDuplicate = prev.filter(p => p.id !== createdProject.id);
            return sortProjectsByUpdatedAt([createdProject, ...withoutDuplicate]);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `organization_id=eq.${effectiveUser.organization_id}`,
        },
        (payload) => {
          const updatedProject = payload.new ? normalizeProject(payload.new) : null;
          if (!updatedProject) return;
          setProjects(prev =>
            sortProjectsByUpdatedAt(
              prev.map(project => project.id === updatedProject.id ? updatedProject : project)
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'projects',
          filter: `organization_id=eq.${effectiveUser.organization_id}`,
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) return;
          setProjects(prev => prev.filter(p => p.id !== deletedId));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [effectiveUser?.organization_id, effectiveUser?.id]);

  return (
    <ProjectContext.Provider value={{
      projects,
      currentProject,
      setCurrentProject,
      loading,
      createProject,
      loadProjects,
      getProjectUsers,
      addUserToProject,
      removeUserFromProject,
      updateUserRole,
      hasProjectPermission,
      canCreateAssets,
      userProjectPermissions,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    // Return a default safe object during hot reload instead of throwing
    return {
      projects: [],
      currentProject: null,
      loading: true,
      setCurrentProject: () => {},
      createProject: async () => null,
      loadProjects: async () => {},
      getProjectUsers: async () => [],
      addUserToProject: async () => {},
      removeUserFromProject: async () => {},
      updateUserRole: async () => {},
      hasProjectPermission: async () => false,
      canCreateAssets: async () => false,
      userProjectPermissions: {},
    } as ProjectContextType;
  }
  return context;
}
