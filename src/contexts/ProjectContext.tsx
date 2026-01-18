import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Project, ProjectPermission } from '@/types/project';

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
  const { userProfile } = useAuth();

  useEffect(() => {
    loadProjects();
  }, [userProfile?.organization_id]);

  const loadProjects = async () => {
    if (!userProfile?.organization_id || !userProfile?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      let projectsData = [];
      let permissionsMap: Record<string, string[]> = {};

      if (userProfile.role === 'admin') {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('organization_id', userProfile.organization_id)
          .order('updated_at', { ascending: false });

        if (error) {
          throw error;
        }

        projectsData = data || [];
        
        projectsData.forEach(project => {
          permissionsMap[project.id] = ['admin', 'editor', 'viewer', 'create', 'edit', 'delete', 'view'];
        });
      } else {
        const { data: userProjects, error: userProjectsError } = await supabase
          .from('project_users')
          .select(`
            project_id,
            role,
            projects (*)
          `)
          .eq('user_id', userProfile.id);

        if (userProjectsError) {
          throw userProjectsError;
        }

        const { data: createdProjects, error: createdProjectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('created_by', userProfile.id)
          .eq('organization_id', userProfile.organization_id);

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
      
      const typedProjects: Project[] = projectsData.map(project => ({
        ...project,
        status: project.status as 'active' | 'archived'
      }));
      
      setProjects(typedProjects);
      setUserProjectPermissions(permissionsMap);
      
      const savedProjectId = localStorage.getItem('currentProjectId');
      if (!currentProject && typedProjects.length > 0) {
        if (savedProjectId) {
          const savedProject = typedProjects.find(p => p.id === savedProjectId);
          if (savedProject) {
            setCurrentProject(savedProject);
          } else {
            setCurrentProject(typedProjects[0]);
          }
        } else {
          setCurrentProject(typedProjects[0]);
        }
      }
    } catch (error) {
      setProjects([]);
      setUserProjectPermissions({});
    } finally {
      setLoading(false);
    }
  };

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
    if (!userProfile?.organization_id) {
      return null;
    }

    if (!userProfile?.id) {
      return null;
    }

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
    if (!userProfile?.id) return false;

    try {
      const { data, error } = await supabase
        .rpc('has_project_permission', {
          _project_id: projectId,
          _user_id: userProfile.id,
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
    const savedProjectId = localStorage.getItem('currentProjectId');
    if (savedProjectId && projects.length > 0 && !currentProject) {
      const savedProject = projects.find(p => p.id === savedProjectId);
      if (savedProject) {
        setCurrentProject(savedProject);
        return;
      }
    }
    
    if (!currentProject && projects.length > 0 && !savedProjectId) {
      setCurrentProject(projects[0]);
    }
  }, [projects]);

  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('currentProjectId', currentProject.id);
    }
  }, [currentProject]);

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
