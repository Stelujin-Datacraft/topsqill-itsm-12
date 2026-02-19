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
import { useSidebar } from '@/components/ui/sidebar';

export function ProjectSwitcher() {
  const { projects, currentProject, setCurrentProject } = useProject();
  const { userProfile } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleProjectSelect = (project: any) => {
    setCurrentProject(project);
  };

  const handleProjectCreated = (projectId: string) => {
    // Project created successfully
  };

  const canCreateProject = userProfile?.role === 'admin';

  return (
    <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : ''}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={`justify-between h-auto font-normal transition-all ${
              isCollapsed ? 'w-8 h-8 p-0' : 'w-full p-3'
            }`}
          >
            <div className={`flex items-center ${isCollapsed ? '' : 'space-x-2'}`}>
              <Briefcase className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && (
                <div className="text-left">
                <div className="font-medium truncate max-w-[140px] text-foreground">
                    {currentProject?.name || 'No Project'}
                </div>
                </div>
              )}
            </div>
            {!isCollapsed && <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80" align="start" side="right" sideOffset={8}>
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
