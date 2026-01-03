
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { ProjectInvitationsCard } from '@/components/projects/ProjectInvitationsCard';
import { RecentActivityList } from '@/components/RecentActivityList';
import { Plus, BarChart3, Users, FileText, Settings, Workflow } from 'lucide-react';

const Dashboard = () => {
  const { userProfile } = useAuth();
  const { currentProject, projects } = useProject();
  const navigate = useNavigate();

  console.log('Dashboard rendering - userProfile:', userProfile?.email, 'currentProject:', currentProject?.name, 'projects count:', projects.length);

  const handleProjectCreated = (projectId: string) => {
    console.log('New project created on dashboard:', projectId);
  };

  const handleInvitationAccepted = (projectId: string) => {
    console.log('Invitation accepted on dashboard:', projectId);
  };

  const quickActions = [
    {
      title: 'Create Form',
      description: 'Build a new form for data collection',
      icon: FileText,
      onClick: () => navigate('/forms'),
      disabled: !currentProject,
    },
    {
      title: 'Create Workflow',
      description: 'Design automated processes',
      icon: Workflow,
      onClick: () => navigate('/workflows'),
      disabled: !currentProject,
    },
    {
      title: 'View Reports',
      description: 'Analyze your data and metrics',
      icon: BarChart3,
      onClick: () => navigate('/reports'),
      disabled: !currentProject,
    },
    {
      title: 'Manage Users',
      description: 'Invite and manage team members',
      icon: Users,
      onClick: () => navigate('/users'),
      disabled: false,
    },
  ];

  // Add error boundary-like behavior
  try {
    return (
      <DashboardLayout 
        title="Dashboard"
        actions={
          <div className="flex gap-2">
            {userProfile?.role === 'admin' && (
              <CreateProjectDialog onProjectCreated={handleProjectCreated} />
            )}
          </div>
        }
      >
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              Welcome back, {userProfile?.first_name || userProfile?.email || 'User'}!
            </h1>
            <p className="text-muted-foreground">
              {currentProject 
                ? `Currently working on: ${currentProject.name}`
                : 'Select a project to get started or create a new one.'
              }
            </p>
          </div>

          {/* Project Invitations */}
          <ProjectInvitationsCard 
            maxItems={3} 
            onInvitationAccepted={handleInvitationAccepted}
          />

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start space-y-2 hover:bg-blue-900 hover:text-white hover:border-blue-900 transition-colors"
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    <action.icon className="h-6 w-6" />
                    <div className="text-left">
                      <div className="font-medium">{action.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
              {!currentProject && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    💡 Tip: Select a project from the sidebar or create a new one to access forms, workflows, and reports.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projects.length}</div>
                <p className="text-xs text-muted-foreground">
                  {projects.length === 1 ? 'project' : 'projects'} available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Role</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{userProfile?.role || 'User'}</div>
                <p className="text-xs text-muted-foreground">
                  Organization member
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Project</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentProject ? '1' : '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentProject ? currentProject.name : 'No project selected'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <RecentActivityList />
        </div>
      </DashboardLayout>
    );
  } catch (error) {
    console.error('Dashboard render error:', error);
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Card className="p-6 text-center">
            <CardHeader>
              <CardTitle className="text-red-600">Dashboard Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                There was an error loading the dashboard. Please try refreshing the page.
              </p>
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }
};

export default Dashboard;
