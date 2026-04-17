import React, { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
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

  const canCreateProject = userProfile?.role === 'admin';

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
  };

  const handleManageAccess = (project: Project) => {
    navigate(`/projects/${project.id}/access`);
  };

  const handleManageSettings = (_project: Project) => {
    // Navigate to settings page when implemented
  };

  const handleProjectCreated = (_projectId: string) => {};

  const handleInvitationAccepted = (_projectId: string) => {};

  const filteredProjects = projects.filter((project) => {
    const term = searchTerm.toLowerCase();
    return (
      project.name.toLowerCase().includes(term) ||
      project.description?.toLowerCase().includes(term)
    );
  });

  return (
    <DashboardLayout title="Projects" description="Manage your projects and collaborate with team members">
      <div className="space-y-6">
        {/* Project Invitations */}
        <ProjectInvitationsCard onInvitationAccepted={handleInvitationAccepted} />

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
          <Input
            placeholder="Search projects by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 h-11 bg-background border-border/60 focus-visible:ring-primary/30"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Projects Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Projects</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
                {searchTerm && ` matching "${searchTerm}"`}
              </p>
            </div>
            {canCreateProject && <CreateProjectDialog onProjectCreated={handleProjectCreated} />}
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
