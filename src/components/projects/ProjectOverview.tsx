
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
  BarChart3,
  Trash2,
  Plus,
  ExternalLink,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import DashboardLayout from '@/components/DashboardLayout';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProjectUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

interface ProjectAsset {
  id: string;
  name: string;
  status: string;
  created_at: string;
  created_by: string;
  reference_id?: string;
}

interface ProjectAssets {
  forms: ProjectAsset[];
  workflows: ProjectAsset[];
  reports: ProjectAsset[];
}

export default function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, getProjectUsers, loadProjects } = useProject();
  const { userProfile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [teamMembers, setTeamMembers] = useState<ProjectUser[]>([]);
  const [projectAssets, setProjectAssets] = useState<ProjectAssets>({ forms: [], workflows: [], reports: [] });
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [creatorEmail, setCreatorEmail] = useState<string>('');
  const { isProjectAdmin, isOrgAdmin } = useUnifiedAccessControl(projectId);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const foundProject = projects.find(p => p.id === projectId);
      setProject(foundProject || null);
      
      if (foundProject) {
        loadTeamMembers(foundProject.id);
        loadCreatorEmail(foundProject.created_by);
        loadProjectAssets(foundProject.id);
      }
    }
    setLoading(false);
  }, [projectId, projects]);

  const loadProjectAssets = async (id: string) => {
    setAssetsLoading(true);
    try {
      // Fetch forms for this project
      const { data: formsData, error: formsError } = await supabase
        .from('forms')
        .select('id, name, status, created_at, created_by, reference_id')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      // Fetch workflows for this project
      const { data: workflowsData, error: workflowsError } = await supabase
        .from('workflows')
        .select('id, name, status, created_at, created_by, reference_id')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      // Fetch reports for this project
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('id, name, created_at, created_by, reference_id')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (formsError) console.error('Error loading forms:', formsError);
      if (workflowsError) console.error('Error loading workflows:', workflowsError);
      if (reportsError) console.error('Error loading reports:', reportsError);

      setProjectAssets({
        forms: (formsData || []).map(f => ({ ...f, status: f.status || 'draft' })),
        workflows: (workflowsData || []).map(w => ({ ...w, status: w.status || 'draft' })),
        reports: (reportsData || []).map(r => ({ ...r, status: 'active' })),
      });
    } catch (error) {
      console.error('Error loading project assets:', error);
    } finally {
      setAssetsLoading(false);
    }
  };

  const loadTeamMembers = async (id: string) => {
    try {
      const users = await getProjectUsers(id);
      setTeamMembers(users);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadCreatorEmail = async (creatorId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', creatorId)
        .single();

      if (error) {
        console.error('Error loading creator email:', error);
        setCreatorEmail(creatorId); // fallback to ID
      } else {
        setCreatorEmail(data.email);
      }
    } catch (error) {
      console.error('Error loading creator email:', error);
      setCreatorEmail(creatorId); // fallback to ID
    }
  };

  const canDeleteProject = () => {
    return isProjectAdmin || isOrgAdmin;
  };

  const handleManageAccess = () => {
    if (project) {
      console.log('Navigating to access management for project:', project.id);
      navigate(`/projects/${project.id}/access`);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    const confirmMessage = `Are you sure you want to delete "${project.name}"? This action cannot be undone and will delete all forms, workflows, and reports in this project.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeleting(true);

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
      
      // Refresh the projects list and navigate
      await loadProjects();
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setDeleting(false);
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

  const hasAdminAccess = isProjectAdmin || isOrgAdmin;
  const canDelete = canDeleteProject();

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
          {canDelete && (
            <Button 
              variant="destructive" 
              onClick={handleDeleteProject}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? 'Deleting...' : 'Delete Project'}
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
        {/* {process.env.NODE_ENV === 'development' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="text-sm space-y-1">
                <div><strong>Debug Info:</strong></div>
                <div>Project ID: {project.id}</div>
                <div>Project Created By: {project.created_by}</div>
                <div>User ID: {userProfile?.id}</div>
                <div>User Role: {userProfile?.role}</div>
                <div>Has Admin Access: {hasAdminAccess ? 'Yes' : 'No'}</div>
                <div>Can Delete Project: {canDelete ? 'Yes' : 'No'}</div>
              </div>
            </CardContent>
          </Card>
        )} */}

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
                  <span className="text-sm">{creatorEmail || project.created_by}</span>
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
          <CardContent className="space-y-6">
            {assetsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/forms')}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Forms</p>
                          <p className="text-3xl font-bold">{projectAssets.forms.length}</p>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/workflows')}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Workflows</p>
                          <p className="text-3xl font-bold">{projectAssets.workflows.length}</p>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Workflow className="h-6 w-6 text-purple-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/reports')}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Reports</p>
                          <p className="text-3xl font-bold">{projectAssets.reports.length}</p>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <BarChart3 className="h-6 w-6 text-orange-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Forms List */}
                {projectAssets.forms.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600" />
                        Forms ({projectAssets.forms.length})
                      </h3>
                      <Button variant="outline" size="sm" onClick={() => navigate('/forms')}>
                        View All
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                    <div className="border rounded-lg divide-y">
                      {projectAssets.forms.slice(0, 5).map((form) => (
                        <div 
                          key={form.id} 
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/forms/${form.id}/edit`)}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{form.name}</p>
                              {form.reference_id && (
                                <p className="text-xs text-muted-foreground">{form.reference_id}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs capitalize ${
                                form.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                form.status === 'published' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                'bg-muted text-muted-foreground'
                              }`}
                            >
                              {form.status}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workflows List */}
                {projectAssets.workflows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-purple-600" />
                        Workflows ({projectAssets.workflows.length})
                      </h3>
                      <Button variant="outline" size="sm" onClick={() => navigate('/workflows')}>
                        View All
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                    <div className="border rounded-lg divide-y">
                      {projectAssets.workflows.slice(0, 5).map((workflow) => (
                        <div 
                          key={workflow.id} 
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/workflows/${workflow.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <Workflow className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{workflow.name}</p>
                              {workflow.reference_id && (
                                <p className="text-xs text-muted-foreground">{workflow.reference_id}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs capitalize ${
                                workflow.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                workflow.status === 'published' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                'bg-muted text-muted-foreground'
                              }`}
                            >
                              {workflow.status}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reports List */}
                {projectAssets.reports.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-orange-600" />
                        Reports ({projectAssets.reports.length})
                      </h3>
                      <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
                        View All
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                    <div className="border rounded-lg divide-y">
                      {projectAssets.reports.slice(0, 5).map((report) => (
                        <div 
                          key={report.id} 
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/reports/${report.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{report.name}</p>
                              {report.reference_id && (
                                <p className="text-xs text-muted-foreground">{report.reference_id}</p>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {projectAssets.forms.length === 0 && projectAssets.workflows.length === 0 && projectAssets.reports.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="flex justify-center gap-4 mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground/50" />
                      <Workflow className="h-8 w-8 text-muted-foreground/50" />
                      <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p>No assets in this project yet.</p>
                    <p className="text-sm mt-1">Create forms, workflows, or reports to get started.</p>
                    <div className="flex justify-center gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => navigate('/forms')}>
                        <Plus className="h-4 w-4 mr-1" />
                        Create Form
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate('/workflows')}>
                        <Plus className="h-4 w-4 mr-1" />
                        Create Workflow
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
                        <Plus className="h-4 w-4 mr-1" />
                        Create Report
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
