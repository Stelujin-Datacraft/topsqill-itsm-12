
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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


  const quickActions = [
    {
      title: 'Forms',
      description: 'Build a new form for data collection',
      icon: FileText,
      onClick: () => navigate('/forms'),
      disabled: !currentProject,
    },
    {
      title: 'Workflow',
      description: 'Design automated processes',
      icon: Workflow,
      onClick: () => navigate('/workflows'),
      disabled: !currentProject,
    },
    {
      title: 'Reports',
      description: 'Analyze your data and metrics',
      icon: BarChart3,
      onClick: () => navigate('/reports'),
      disabled: !currentProject,
    },
    {
      title: 'Users',
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
        description={currentProject ? `Currently working on: ${currentProject.name}` : 'Select a project to get started or create a new one'}
        actions={
          userProfile?.role === 'admin' ? (
            <CreateProjectDialog onProjectCreated={handleProjectCreated} />
          ) : undefined
        }
      >
        <div className="space-y-6">

          {/* Project Invitations - removed, available in Project section */}

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Quick Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {quickActions.map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="gap-2 cursor-pointer"
                  >
                    <action.icon className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">{action.title}</div>
                      <div className="text-xs text-muted-foreground">{action.description}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {!currentProject && (
              <p className="text-sm text-muted-foreground">
                💡 Select a project to get started
              </p>
            )}
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-primary-light border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                <Settings className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projects.length}</div>
                <p className="text-xs text-muted-foreground">
                  {projects.length === 1 ? 'project' : 'projects'} available
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary-light border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Role</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{userProfile?.role || 'User'}</div>
                <p className="text-xs text-muted-foreground">
                  Organization member
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary-light border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Project</CardTitle>
                <FileText className="h-4 w-4 text-primary" />
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
              <CardTitle className="text-destructive">Dashboard Error</CardTitle>
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
