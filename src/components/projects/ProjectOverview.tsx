
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Shield, 
  Users, 
  Calendar, 
  User,
  Settings,
  FileText,
  Workflow,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import DashboardLayout from '@/components/DashboardLayout';

interface ProjectUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export default function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, getProjectUsers } = useProject();
  const { userProfile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [teamMembers, setTeamMembers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const foundProject = projects.find(p => p.id === projectId);
      setProject(foundProject || null);
      
      if (foundProject) {
        loadTeamMembers(foundProject.id);
      }
    }
    setLoading(false);
  }, [projectId, projects]);

  const loadTeamMembers = async (id: string) => {
    try {
      const users = await getProjectUsers(id);
      setTeamMembers(users);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const isProjectAdmin = () => {
    if (!project || !userProfile) return false;
    
    console.log('Checking admin access in overview:');
    console.log('Project created_by:', project.created_by);
    console.log('User profile id:', userProfile.id);
    console.log('User role:', userProfile.role);
    
    // Check if user is the project creator OR organization admin
    const isCreator = project.created_by === userProfile.id;
    const isOrgAdmin = userProfile.role === 'admin';
    
    console.log('Is creator:', isCreator);
    console.log('Is org admin:', isOrgAdmin);
    
    return isCreator || isOrgAdmin;
  };

  const handleManageAccess = () => {
    if (project) {
      console.log('Navigating to access management for project:', project.id);
      navigate(`/projects/${project.id}/access`);
    }
  };

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  if (loading) {
    return (
      <DashboardLayout title="Project Overview">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading project...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout title="Project Not Found">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground mb-4">Project not found</div>
            <Button onClick={() => navigate('/projects')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const hasAdminAccess = isProjectAdmin();
  console.log('Final admin access check result:', hasAdminAccess);

  return (
    <DashboardLayout 
      title={project.name}
      actions={
        <div className="flex items-center gap-2">
          {hasAdminAccess && (
            <Button onClick={handleManageAccess}>
              <Shield className="h-4 w-4 mr-2" />
              Manage Access
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Debug Info - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="text-sm space-y-1">
                <div><strong>Debug Info:</strong></div>
                <div>Project ID: {project.id}</div>
                <div>Project Created By: {project.created_by}</div>
                <div>User ID: {userProfile?.id}</div>
                <div>User Role: {userProfile?.role}</div>
                <div>Has Admin Access: {hasAdminAccess ? 'Yes' : 'No'}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    {project.status}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created By</label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{project.created_by}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created Date</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(new Date(project.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Team Size</label>
                <div className="flex items-center gap-2 mt-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{teamMembers.length} members</span>
                </div>
              </div>
            </div>
            {project.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="mt-1 text-sm">{project.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamMembers.length > 0 ? (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getInitials(member.first_name, member.last_name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {member.first_name && member.last_name
                            ? `${member.first_name} ${member.last_name}`
                            : member.email
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                    <Badge variant="outline">{member.role}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No team members found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Assets Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Project Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <FileText className="h-8 w-8 text-green-600" />
                <div>
                  <div className="font-medium">Forms</div>
                  <div className="text-sm text-muted-foreground">Coming soon</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Workflow className="h-8 w-8 text-purple-600" />
                <div>
                  <div className="font-medium">Workflows</div>
                  <div className="text-sm text-muted-foreground">Coming soon</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <BarChart3 className="h-8 w-8 text-orange-600" />
                <div>
                  <div className="font-medium">Reports</div>
                  <div className="text-sm text-muted-foreground">Coming soon</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
