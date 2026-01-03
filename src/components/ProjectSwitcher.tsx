
import React from 'react';
import { Check, ChevronDown, Briefcase, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useProject } from '@/contexts/ProjectContext';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { useAuth } from '@/contexts/AuthContext';

export function ProjectSwitcher() {
  const { projects, currentProject, setCurrentProject } = useProject();
  const { userProfile } = useAuth();

  const handleProjectSelect = (project: any) => {
    setCurrentProject(project);
  };

  const handleProjectCreated = (projectId: string) => {
    console.log('New project created from switcher:', projectId);
  };

  const canCreateProject = userProfile?.role === 'admin';

  return (
    <div className="flex items-center justify-between w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between h-auto p-3 font-normal"
          >
            <div className="flex items-center space-x-2">
              <Briefcase className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">
                  {currentProject?.name || 'No Project Selected'}
                </div>
                {/*<div className="text-xs text-muted-foreground">
                  {currentProject?.description || 'Select a project to continue'}
                </div>*/}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80" align="start">
          <DropdownMenuLabel>Switch Project</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {projects.length === 0 ? (
            <DropdownMenuItem disabled>
              <div className="text-sm text-muted-foreground">
                No projects available
              </div>
            </DropdownMenuItem>
          ) : (
            projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => handleProjectSelect(project)}
                className="flex items-center justify-between p-3 cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <Briefcase className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {project.description || 'No description'}
                    </div>
                  </div>
                </div>
                {currentProject?.id === project.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))
          )}
          
          {canCreateProject && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <CreateProjectDialog 
                  onProjectCreated={handleProjectCreated}
                  trigger={
                    <Button variant="ghost" className="w-full justify-start p-3 h-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Project
                    </Button>
                  }
                />
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
