
import React, { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { ProjectsTable } from '@/components/projects/ProjectsTable';
import { Project } from '@/types/project';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ProjectInvitationsCard } from '@/components/projects/ProjectInvitationsCard';

const Projects = () => {
  const { projects, loading, setCurrentProject, currentProject } = useProject();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const canCreateProject = userProfile?.role === 'admin';

  const handleSelectProject = (project: Project) => {
    console.log('Setting current project:', project.id);
    setCurrentProject(project);
  };

  const handleManageAccess = (project: Project) => {
    console.log('Navigating to access management for project:', project.id);
    navigate(`/projects/${project.id}/access`);
  };

  const handleManageSettings = (project: Project) => {
    console.log('Manage settings for project:', project.id);
    // Navigate to settings page when implemented
    // navigate(`/projects/${project.id}/settings`);
  };

  const handleProjectCreated = (projectId: string) => {
    console.log('New project created:', projectId);
  };

  const handleInvitationAccepted = (projectId: string) => {
    console.log('Invitation accepted for project:', projectId);
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout title="Projects">
      <div className="space-y-6">
        {/* Project Invitations */}
        <ProjectInvitationsCard onInvitationAccepted={handleInvitationAccepted} />

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Projects Table */}
        <Card>
<CardHeader className="flex flex-row items-center justify-between">
  <CardTitle>Your Projects</CardTitle>

  {canCreateProject && (
    <CreateProjectDialog onProjectCreated={handleProjectCreated} />
  )}
</CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Loading projects...</div>
              </div>
            ) : (
              <>
                <ProjectsTable 
                  projects={filteredProjects}
                  currentProject={currentProject}
                  onSelectProject={handleSelectProject}
                  onManageAccess={handleManageAccess}
                  onManageSettings={handleManageSettings}
                />
                
                {/* Create Project Button */}
                {canCreateProject && (
                  <div className="flex justify-center mt-6 pt-4 border-t">
                    <CreateProjectDialog onProjectCreated={handleProjectCreated} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Projects;
