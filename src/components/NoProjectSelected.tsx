
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { ProjectInvitationsCard } from '@/components/projects/ProjectInvitationsCard';
import { FolderOpen, Plus } from 'lucide-react';

const NoProjectSelected = () => {
  const { userProfile } = useAuth();
  const canCreateProject = userProfile?.role === 'admin';

  const handleProjectCreated = (projectId: string) => {
    console.log('Project created from NoProjectSelected:', projectId);
  };

  const handleInvitationAccepted = (projectId: string) => {
    console.log('Invitation accepted from NoProjectSelected:', projectId);
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-6">
      <div className="max-w-2xl w-full space-y-6">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <FolderOpen className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">No Project Selected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You need to select a project to access forms, workflows, and reports. 
              {canCreateProject 
                ? ' Create a new project or select an existing one from the sidebar.'
                : ' Select an existing project from the sidebar or wait for an invitation.'
              }
            </p>
            
            {canCreateProject && (
              <div className="flex justify-center">
                <CreateProjectDialog onProjectCreated={handleProjectCreated} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Show project invitations if any exist */}
        <ProjectInvitationsCard onInvitationAccepted={handleInvitationAccepted} />
      </div>
    </div>
  );
};

export default NoProjectSelected;
