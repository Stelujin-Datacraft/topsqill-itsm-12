
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
  Eye,
  ChevronRight,
  X,
  Edit,
  Share2,
  Archive,
  Clock,
  Activity,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [selectedAssetType, setSelectedAssetType] = useState<'forms' | 'workflows' | 'reports' | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [creatorEmail, setCreatorEmail] = useState<string>('');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const { isProjectAdmin, isOrgAdmin } = useUnifiedAccessControl(projectId);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const foundProject = projects.find(p => p.id === projectId);
      setProject(foundProject || null);
      
      if (foundProject) {
        loadTeamMembers(foundProject.id);
        loadCreatorEmail(foundProject.created_by);
        loadProjectAssets(foundProject.id);
        loadRecentActivity(foundProject.id);
        setEditedName(foundProject.name);
        setEditedDescription(foundProject.description || '');
        setEditedStatus(foundProject.status);
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

  const loadRecentActivity = async (id: string) => {
    setActivityLoading(true);
    try {
      // Fetch recent form submissions
      const { data: submissions } = await supabase
        .from('form_submissions')
        .select(`
          id,
          submitted_at,
          form_id,
          forms!inner(name, project_id)
        `)
        .eq('forms.project_id', id)
        .order('submitted_at', { ascending: false })
        .limit(5);

      // Fetch recent workflow executions
      const { data: executions } = await supabase
        .from('workflow_executions')
        .select(`
          id,
          started_at,
          status,
          workflow_id,
          workflows!inner(name, project_id)
        `)
        .eq('workflows.project_id', id)
        .order('started_at', { ascending: false })
        .limit(5);

      const activities: any[] = [];
      
      (submissions || []).forEach(sub => {
        activities.push({
          id: sub.id,
          type: 'submission',
          name: (sub as any).forms?.name || 'Unknown Form',
          timestamp: sub.submitted_at,
          status: 'completed'
        });
      });

      (executions || []).forEach(exec => {
        activities.push({
          id: exec.id,
          type: 'workflow',
          name: (exec as any).workflows?.name || 'Unknown Workflow',
          timestamp: exec.started_at,
          status: exec.status
        });
      });

      // Sort by timestamp and take top 5
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 5));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleSaveProjectInfo = async () => {
    if (!project) return;
    
    setSavingInfo(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: editedName,
          description: editedDescription,
          status: editedStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;

      toast.success('Project updated successfully');
      setIsEditingInfo(false);
      await loadProjects();
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    } finally {
      setSavingInfo(false);
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

        {/* Project Info - Enhanced */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Project Information
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasAdminAccess && !isEditingInfo && (
                <Button variant="outline" size="sm" onClick={() => setIsEditingInfo(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              {isEditingInfo && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditingInfo(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveProjectInfo} disabled={savingInfo}>
                    {savingInfo ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEditingInfo ? (
              /* Edit Mode */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Project Name</label>
                    <Input 
                      value={editedName} 
                      onChange={(e) => setEditedName(e.target.value)}
                      placeholder="Enter project name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={editedStatus} onValueChange={setEditedStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea 
                    value={editedDescription} 
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Enter project description"
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className={`${
                          project.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                            : project.status === 'archived'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {project.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {project.status === 'archived' && <Archive className="h-3 w-3 mr-1" />}
                        {project.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created By</label>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {creatorEmail?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{creatorEmail || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(project.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Updated</label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(project.updated_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                  <p className="text-sm text-foreground">
                    {project.description || <span className="text-muted-foreground italic">No description provided</span>}
                  </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{teamMembers.length}</div>
                    <div className="text-xs text-muted-foreground">Team Members</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{projectAssets.forms.length}</div>
                    <div className="text-xs text-muted-foreground">Forms</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{projectAssets.workflows.length}</div>
                    <div className="text-xs text-muted-foreground">Workflows</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{projectAssets.reports.length}</div>
                    <div className="text-xs text-muted-foreground">Reports</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/forms')}
              >
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm">Create Form</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/workflows')}
              >
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Workflow className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-sm">Create Workflow</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/reports')}
              >
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                </div>
                <span className="text-sm">Create Report</span>
              </Button>
              {hasAdminAccess && (
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={handleManageAccess}
                >
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm">Invite Member</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Members - Enhanced */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
              <Badge variant="secondary" className="ml-2">{teamMembers.length}</Badge>
            </CardTitle>
            {hasAdminAccess && (
              <Button variant="outline" size="sm" onClick={handleManageAccess}>
                <UserPlus className="h-4 w-4 mr-1" />
                Manage Team
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {teamMembers.length > 0 ? (
              <div className="space-y-3">
                {/* Avatar Row Preview */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex -space-x-2">
                    {teamMembers.slice(0, 5).map((member) => (
                      <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                        <AvatarFallback className="text-xs">
                          {getInitials(member.first_name, member.last_name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {teamMembers.length > 5 && (
                      <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                        <span className="text-xs font-medium">+{teamMembers.length - 5}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground ml-2">
                    {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
                  </span>
                </div>

                {/* Member List */}
                <div className="border rounded-lg divide-y">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>
                            {getInitials(member.first_name, member.last_name, member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {member.first_name && member.last_name
                              ? `${member.first_name} ${member.last_name}`
                              : member.email
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={`${
                          member.role === 'admin' 
                            ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' 
                            : member.role === 'editor'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>No team members found</p>
                {hasAdminAccess && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleManageAccess}>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Invite Members
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                      activity.type === 'submission' 
                        ? 'bg-green-500/10' 
                        : 'bg-purple-500/10'
                    }`}>
                      {activity.type === 'submission' 
                        ? <FileText className="h-4 w-4 text-green-600" />
                        : <Workflow className="h-4 w-4 text-purple-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {activity.type === 'submission' ? 'Form Submission' : 'Workflow Execution'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{activity.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          activity.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : activity.status === 'running'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : activity.status === 'failed'
                            ? 'bg-red-500/10 text-red-600 border-red-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {activity.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>No recent activity</p>
                <p className="text-xs mt-1">Form submissions and workflow runs will appear here</p>
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
                  <Card 
                    className={`hover:shadow-md transition-all cursor-pointer ${selectedAssetType === 'forms' ? 'ring-2 ring-primary' : ''}`} 
                    onClick={() => setSelectedAssetType(selectedAssetType === 'forms' ? null : 'forms')}
                  >
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
                      <div className="flex items-center justify-end mt-2 text-xs text-muted-foreground">
                        <span>Click to view</span>
                        <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${selectedAssetType === 'forms' ? 'rotate-90' : ''}`} />
                      </div>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`hover:shadow-md transition-all cursor-pointer ${selectedAssetType === 'workflows' ? 'ring-2 ring-primary' : ''}`} 
                    onClick={() => setSelectedAssetType(selectedAssetType === 'workflows' ? null : 'workflows')}
                  >
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
                      <div className="flex items-center justify-end mt-2 text-xs text-muted-foreground">
                        <span>Click to view</span>
                        <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${selectedAssetType === 'workflows' ? 'rotate-90' : ''}`} />
                      </div>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`hover:shadow-md transition-all cursor-pointer ${selectedAssetType === 'reports' ? 'ring-2 ring-primary' : ''}`} 
                    onClick={() => setSelectedAssetType(selectedAssetType === 'reports' ? null : 'reports')}
                  >
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
                      <div className="flex items-center justify-end mt-2 text-xs text-muted-foreground">
                        <span>Click to view</span>
                        <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${selectedAssetType === 'reports' ? 'rotate-90' : ''}`} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Forms List - Show when selected */}
                {selectedAssetType === 'forms' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600" />
                        Forms ({projectAssets.forms.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate('/forms'); }}>
                          View All
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedAssetType(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {projectAssets.forms.length > 0 ? (
                      <div className="border rounded-lg divide-y">
                        {projectAssets.forms.map((form) => (
                          <div 
                            key={form.id} 
                            className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => navigate(`/form/${form.id}`)}
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
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p>No forms in this project yet.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/forms')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Create Form
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Workflows List - Show when selected */}
                {selectedAssetType === 'workflows' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-purple-600" />
                        Workflows ({projectAssets.workflows.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate('/workflows'); }}>
                          View All
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedAssetType(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {projectAssets.workflows.length > 0 ? (
                      <div className="border rounded-lg divide-y">
                        {projectAssets.workflows.map((workflow) => (
                          <div 
                            key={workflow.id} 
                            className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => navigate(`/workflow-view/${workflow.id}`)}
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
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <Workflow className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p>No workflows in this project yet.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/workflows')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Create Workflow
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Reports List - Show when selected */}
                {selectedAssetType === 'reports' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-orange-600" />
                        Reports ({projectAssets.reports.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}>
                          View All
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedAssetType(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {projectAssets.reports.length > 0 ? (
                      <div className="border rounded-lg divide-y">
                        {projectAssets.reports.map((report) => (
                          <div 
                            key={report.id} 
                            className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => navigate(`/report-view/${report.id}`)}
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
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p>No reports in this project yet.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/reports')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Create Report
                        </Button>
                      </div>
                    )}
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
