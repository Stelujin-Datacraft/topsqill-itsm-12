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
      console.log('ProjectContext: No organization ID or user ID available for loading projects');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    console.log('ProjectContext: Loading projects for organization:', userProfile.organization_id, 'user:', userProfile.id);
    
    try {
      let projectsData = [];
      let permissionsMap: Record<string, string[]> = {};

      // If user is organization admin, get all projects in the organization
      if (userProfile.role === 'admin') {
        console.log('ProjectContext: User is organization admin, loading all projects');
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('organization_id', userProfile.organization_id)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('ProjectContext: Error loading all projects:', error);
          throw error;
        }

        projectsData = data || [];
        
        // Organization admins have full permissions on all projects
        projectsData.forEach(project => {
          permissionsMap[project.id] = ['admin', 'editor', 'viewer', 'create', 'edit', 'delete', 'view'];
        });
      } else {
        // For regular users, get projects they have access to
        console.log('ProjectContext: Loading projects with user access');
        
        // Get projects where user is explicitly added as a project member
        const { data: userProjects, error: userProjectsError } = await supabase
          .from('project_users')
          .select(`
            project_id,
            role,
            projects (*)
          `)
          .eq('user_id', userProfile.id);

        if (userProjectsError) {
          console.error('ProjectContext: Error loading user projects:', userProjectsError);
          throw userProjectsError;
        }

        // Get projects created by the user
        const { data: createdProjects, error: createdProjectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('created_by', userProfile.id)
          .eq('organization_id', userProfile.organization_id);

        if (createdProjectsError) {
          console.error('ProjectContext: Error loading created projects:', createdProjectsError);
          throw createdProjectsError;
        }

        // Combine and deduplicate projects
        const allProjectsMap = new Map();
        
        // Add user projects with their roles
        (userProjects || []).forEach(up => {
          if (up.projects) {
            allProjectsMap.set(up.projects.id, {
              ...up.projects,
              userRole: up.role
            });
            
            // Set permissions based on role
            const rolePermissions = getRolePermissions(up.role);
            permissionsMap[up.projects.id] = rolePermissions;
          }
        });

        // Add created projects (user is admin of their own projects)
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

      console.log('ProjectContext: Projects loaded:', projectsData.length, 'projects');
      console.log('ProjectContext: User permissions:', permissionsMap);
      
      const typedProjects: Project[] = projectsData.map(project => ({
        ...project,
        status: project.status as 'active' | 'archived'
      }));
      
      setProjects(typedProjects);
      setUserProjectPermissions(permissionsMap);
      
      // Set current project if none selected and user has access to projects
      if (!currentProject && typedProjects.length > 0) {
        setCurrentProject(typedProjects[0]);
      }
    } catch (error) {
      console.error('ProjectContext: Error loading projects:', error);
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
    console.log('ProjectContext: Starting project creation process');
    console.log('ProjectContext: User profile:', userProfile);
    console.log('ProjectContext: Project data:', projectData);

    if (!userProfile?.organization_id) {
      console.error('ProjectContext: No organization ID available - cannot create project');
      return null;
    }

    if (!userProfile?.id) {
      console.error('ProjectContext: No user ID available - cannot create project');
      return null;
    }

    if (userProfile.role !== 'admin') {
      console.error('ProjectContext: User is not admin - cannot create project. Current role:', userProfile.role);
      return null;
    }

    console.log('ProjectContext: All validation checks passed, proceeding with project creation');
    
    try {
      console.log('ProjectContext: Attempting to insert project into database');
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
        console.error('ProjectContext: Database error during project creation:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('ProjectContext: Project created successfully:', data);
      
      const typedProject: Project = {
        ...data,
        status: data.status as 'active' | 'archived'
      };

      await loadProjects();
      setCurrentProject(typedProject);
      
      console.log('ProjectContext: Project creation process completed successfully');
      return typedProject;
    } catch (error) {
      console.error('ProjectContext: Error in createProject function:', error);
      return null;
    }
  };

  const getProjectUsers = async (projectId: string): Promise<ProjectUser[]> => {
    console.log('ProjectContext: Getting users for project:', projectId);
    
    try {
      const { data: projectUsersData, error: projectUsersError } = await supabase
        .from('project_users')
        .select('user_id, role')
        .eq('project_id', projectId);

      if (projectUsersError) {
        console.error('ProjectContext: Error fetching project users:', projectUsersError);
        return [];
      }

      if (!projectUsersData || projectUsersData.length === 0) {
        console.log('ProjectContext: No users found for project:', projectId);
        return [];
      }

      const userIds = projectUsersData.map(pu => pu.user_id);
      
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      if (usersError) {
        console.error('ProjectContext: Error fetching user profiles:', usersError);
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

      console.log('ProjectContext: Project users retrieved:', projectUsers);
      return projectUsers;
    } catch (error) {
      console.error('ProjectContext: Error in getProjectUsers:', error);
      return [];
    }
  };

  const addUserToProject = async (projectId: string, userId: string, role: string) => {
    console.log('ProjectContext: Adding user to project:', { projectId, userId, role });
    
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
        console.error('ProjectContext: Error adding user to project:', error);
        throw error;
      }

      console.log('ProjectContext: User added to project successfully');
    } catch (error) {
      console.error('ProjectContext: Error in addUserToProject:', error);
      throw error;
    }
  };

  const removeUserFromProject = async (projectId: string, userId: string) => {
    console.log('ProjectContext: Removing user from project:', { projectId, userId });
    
    try {
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) {
        console.error('ProjectContext: Error removing user from project:', error);
        throw error;
      }

      console.log('ProjectContext: User removed from project successfully');
    } catch (error) {
      console.error('ProjectContext: Error in removeUserFromProject:', error);
      throw error;
    }
  };

  const updateUserRole = async (projectId: string, userId: string, role: string) => {
    console.log('ProjectContext: Updating user role:', { projectId, userId, role });
    
    try {
      const { error } = await supabase
        .from('project_users')
        .update({ role })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) {
        console.error('ProjectContext: Error updating user role:', error);
        throw error;
      }

      console.log('ProjectContext: User role updated successfully');
    } catch (error) {
      console.error('ProjectContext: Error in updateUserRole:', error);
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
        console.error('ProjectContext: Error checking project permission:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('ProjectContext: Error in hasProjectPermission:', error);
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
        console.error('ProjectContext: Error checking create permission:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('ProjectContext: Error in canCreateAssets:', error);
      return false;
    }
  };

  // Load project from localStorage on initialization
  useEffect(() => {
    const savedProjectId = localStorage.getItem('currentProjectId');
    if (savedProjectId && projects.length > 0) {
      const savedProject = projects.find(p => p.id === savedProjectId);
      if (savedProject && !currentProject) {
        setCurrentProject(savedProject);
        return;
      }
    }
    
    if (!currentProject && projects.length > 0) {
      setCurrentProject(projects[0]);
    }
  }, [projects, currentProject]);

  // Save project to localStorage when changed
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
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
