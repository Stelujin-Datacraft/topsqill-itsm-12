
import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types/project';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Settings, 
  Shield, 
  Eye, 
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProjectsTableProps {
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (project: Project) => void;
  onManageAccess: (project: Project) => void;
  onManageSettings: (project: Project) => void;
}

export function ProjectsTable({ 
  projects, 
  currentProject, 
  onSelectProject, 
  onManageAccess, 
  onManageSettings 
}: ProjectsTableProps) {
  const { userProfile } = useAuth();
  const { userProjectPermissions, loadProjects } = useProject();
  const navigate = useNavigate();

  const getUserProjectRole = (project: Project) => {
    if (!userProfile) return 'No Access';
    
    // Check if user is organization admin
    if (userProfile.role === 'admin') {
      return 'Organization Admin';
    }
    
    // Check if user is project creator
    if (project.created_by === userProfile.id) {
      return 'Project Creator';
    }
    
    // Check permissions from context
    const permissions = userProjectPermissions[project.id] || [];
    if (permissions.includes('admin')) {
      return 'Project Admin';
    } else if (permissions.includes('editor')) {
      return 'Project Editor';
    } else if (permissions.includes('viewer')) {
      return 'Project Viewer';
    }
    
    return 'Member';
  };

  const canManageProject = (project: Project) => {
    if (!userProfile) return false;
    
    // Organization admin can manage all projects
    if (userProfile.role === 'admin') return true;
    
    // Project creator can manage their project
    if (project.created_by === userProfile.id) return true;
    
    // Check if user has admin permissions on this project
    const permissions = userProjectPermissions[project.id] || [];
    return permissions.includes('admin') || permissions.includes('manage_access');
  };

  const getStatusIcon = (status: string) => {
    return status === 'active' ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <AlertCircle className="h-4 w-4 text-orange-600" />
    );
  };

  const handleRowClick = (project: Project) => {
    onSelectProject(project);
    navigate(`/projects/${project.id}/overview`);
  };

  const handleManageAccess = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    console.log('Navigating to access management for project:', project.id);
    navigate(`/projects/${project.id}/access`);
  };

  const handleManageSettings = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    console.log('Navigating to settings for project:', project.id);
    // For now, just show console log since settings page isn't implemented
    console.log('Settings page not yet implemented for project:', project.id);
  };

  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    
    const confirmMessage = `Are you sure you want to delete "${project.name}"? This action cannot be undone and will delete all forms, workflows, and reports in this project.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) {
        console.error('Error deleting project:', error);
        toast.error('Failed to delete project');
        return;
      }

      toast.success('Project deleted successfully');
      
      // Refresh the projects list
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('An unexpected error occurred');
    }
  };

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">No projects found or you don't have access to any projects</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Your Role</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Selected</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const userRole = getUserProjectRole(project);
              const canManage = canManageProject(project);
              
              return (
                <TableRow 
                  key={project.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(project)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{project.name}</div>
                      {project.description && (
                        <div className="text-sm text-muted-foreground">
                          {project.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(project.status)}
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Badge 
                        variant={userRole.includes('Admin') ? 'default' : 'outline'}
                        className={
                          userRole.includes('Admin') ? 'bg-blue-100 text-blue-800' :
                          userRole.includes('Editor') ? 'bg-green-100 text-green-800' :
                          userRole.includes('Viewer') ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }
                      >
                        {userRole}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(project.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {currentProject?.id === project.id && (
                      <Badge variant="outline">
                        <Eye className="h-3 w-3 mr-1" />
                        Current
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {canManage ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleManageAccess(e, project)}
                            title="Manage Access"
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleManageSettings(e, project)}
                            title="Settings"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleDeleteProject(e, project)}
                            title="Delete Project"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {userRole === 'No Access' ? 'No access' : 'Limited access'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
