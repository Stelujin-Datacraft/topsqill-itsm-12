
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';

import { RecentActivityList } from '@/components/RecentActivityList';
import { Plus, BarChart3, Users, FileText, Settings, Workflow } from 'lucide-react';

const Dashboard = () => {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const { currentProject, projects } = useProject();
  const navigate = useNavigate();

  console.log('Dashboard rendering - userProfile:', userProfile?.email, 'currentProject:', currentProject?.name, 'projects count:', projects.length);

  const handleProjectCreated = (projectId: string) => {
    console.log('New project created on dashboard:', projectId);
  };


  const quickActions = [
    {
      title: t('dashboard.forms'),
      description: t('dashboard.formsDesc'),
      icon: FileText,
      onClick: () => navigate('/forms'),
      disabled: !currentProject,
    },
    {
      title: t('dashboard.workflow'),
      description: t('dashboard.workflowDesc'),
      icon: Workflow,
      onClick: () => navigate('/workflows'),
      disabled: !currentProject,
    },
    {
      title: t('dashboard.reports'),
      description: t('dashboard.reportsDesc'),
      icon: BarChart3,
      onClick: () => navigate('/reports'),
      disabled: !currentProject,
    },
    {
      title: t('dashboard.users'),
      description: t('dashboard.usersDesc'),
      icon: Users,
      onClick: () => navigate('/users'),
      disabled: false,
    },
  ];

  // Add error boundary-like behavior
  try {
    return (
      <DashboardLayout 
        title={t('dashboard.title')}
        description={currentProject ? t('dashboard.workingOn', { project: currentProject.name }) : t('dashboard.selectProject')}
        actions={
          userProfile?.role === 'admin' ? (
            <CreateProjectDialog onProjectCreated={handleProjectCreated} />
          ) : undefined
        }
      >
        <div className="space-y-6">

          {/* Project Invitations - removed, available in Project section */}

          {/* Quick Actions */}
          <Card className="enterprise-card">
            <CardHeader>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start space-y-2 bg-primary-light border-primary/20 hover:bg-primary/10"
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    <action.icon className="h-6 w-6 text-module-access" />
                    <div className="text-left">
                      <div className="text-xl">{action.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            { /* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action, index) => (
                  
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start space-y-2 bg-blue-50 border-blue-200"
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    <action.icon className="h-6 w-6" />
                    <div className="text-left">
                      <div className="text-xl">{action.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>*/}
              {!currentProject && (
                <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-lg">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('dashboard.projectTip')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="enterprise-card bg-primary/5 border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.totalProjects')}</CardTitle>
                <Settings className="h-4 w-4 text-module-forms" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{projects.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('dashboard.projectsAvailable', {
                    count: projects.length,
                    label: t(projects.length === 1 ? 'dashboard.project_one' : 'dashboard.project_other'),
                  })}
                </p>
              </CardContent>
            </Card>

            <Card className="enterprise-card bg-primary/5 border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.currentRole')}</CardTitle>
                <Users className="h-4 w-4 text-module-forms" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold capitalize">{userProfile?.role || t('common.user')}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('dashboard.orgMember')}
                </p>
              </CardContent>
            </Card>

            <Card className="enterprise-card bg-primary/5 border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.activeProject')}</CardTitle>
                <FileText className="h-4 w-4 text-module-forms" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {currentProject ? '1' : '0'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentProject ? currentProject.name : t('dashboard.noProjectSelected')}
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
      <DashboardLayout title={t('dashboard.title')}>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Card className="enterprise-card p-6 text-center max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">{t('dashboard.errorTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                {t('dashboard.errorDescription')}
              </p>
              <Button onClick={() => window.location.reload()}>
                {t('dashboard.refreshPage')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }
};

export default Dashboard;
