
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { ProjectUsersTable } from './ProjectUsersTable';
import { UserInvitationSection } from './UserInvitationSection';
import { useEnhancedProjectUsers } from '@/hooks/useEnhancedProjectUsers';
import { TopLevelPermissions } from './TopLevelPermissions';

export default function ProjectAccessPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects } = useProject();
  const { userProfile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUserForSettings, setSelectedUserForSettings] = useState<string | null>(null);

  const { users, loading: usersLoading, removeUser, refetch } = useEnhancedProjectUsers(projectId || '');

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const foundProject = projects.find(p => p.id === projectId);
      setProject(foundProject || null);
    }
    setLoading(false);
  }, [projectId, projects]);

  const isProjectAdmin = () => {
    return project && (project.created_by === userProfile?.id || userProfile?.role === 'admin');
  };

  const handleManagePermissions = (user: any) => {
    setSelectedUserForSettings(user.user_id);
  };

  const handleRemoveUser = async (userId: string) => {
    await removeUser(userId);
  };

  const handleInvitationSent = () => {
    refetch();
  };

  if (loading) {
    return (
      <DashboardLayout title="Project Access Management">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
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

  if (!isProjectAdmin()) {
    return (
      <DashboardLayout title="Access Denied">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground mb-4">
              You don't have permission to manage access for this project. Only project admins can access this page.
            </p>
            <Button onClick={() => navigate(`/projects/${project.id}/overview`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project Overview
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title={`Access Management - ${project.name}`}
      actions={
        <Button variant="outline" onClick={() => navigate(`/projects/${project.id}/overview`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Overview
        </Button>
      }
    >
      <div className="space-y-6">
        {/* User Settings Panel - Show when a user is selected */}
        {selectedUserForSettings && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Settings & Permissions</CardTitle>
                <Button
                  variant="outline"
                  onClick={() => setSelectedUserForSettings(null)}
                >
                  Back to Team Management
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <TopLevelPermissions
                projectId={project.id}
                userId={selectedUserForSettings}
                isCurrentUserAdmin={isProjectAdmin()}
              />
            </CardContent>
          </Card>
        )}

        {/* Main Team Management - Show when no user is selected */}
        {!selectedUserForSettings && (
          <>
            {/* Invitation Section */}
            <UserInvitationSection
              projectId={project.id}
              onInvitationSent={handleInvitationSent}
            />

            {/* Users Table */}
            <ProjectUsersTable
              users={users}
              loading={usersLoading}
              onManagePermissions={handleManagePermissions}
              onRemoveUser={handleRemoveUser}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
