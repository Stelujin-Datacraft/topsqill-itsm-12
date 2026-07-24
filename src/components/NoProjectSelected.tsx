
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { FolderOpen } from 'lucide-react';

const NoProjectSelected = () => {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const canCreateProject = userProfile?.role === 'admin';

  const handleProjectCreated = (projectId: string) => {
    console.log('Project created from NoProjectSelected:', projectId);
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-6">
      <div className="max-w-2xl w-full space-y-6">
        <Card className="enterprise-card text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <FolderOpen className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight">{t('project.noProjectTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {t('project.noProjectDesc')}{' '}
              {canCreateProject ? t('project.adminHint') : t('project.userHint')}
            </p>
            
            {canCreateProject && (
              <div className="flex justify-center">
                <CreateProjectDialog onProjectCreated={handleProjectCreated} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NoProjectSelected;
