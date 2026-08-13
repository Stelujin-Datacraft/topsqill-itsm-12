import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { FormsList } from '@/components/FormsList';
import { CreateFormDialog } from '@/components/CreateFormDialog';
import { FormSubmissionsDialog } from '@/components/FormSubmissionsDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, History, Timer, MoreVertical, FileSpreadsheet } from 'lucide-react';
import NoProjectSelected from '@/components/NoProjectSelected';
import { AIFormGenerator } from '@/components/ai/AIFormGenerator';
import { ExcelFormImporter } from '@/components/ExcelFormImporter';
import { createFormFromAiGeneration, type AiGeneratedFormSchema } from '@/lib/createFormFromAiGeneration';

const Forms = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { hasPermission, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();

  if (!currentProject) {
    return (
      <DashboardLayout title={t('forms.title')}>
        <NoProjectSelected />
      </DashboardLayout>
    );
  }

  // Check if user can even see the forms page
  const canReadForms = hasPermission('forms', 'read');
  
  if (!permissionLoading && !canReadForms) {
    return (
      <DashboardLayout title={t('forms.title')}>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">{t('common.accessDenied')}</h3>
          <p className="text-muted-foreground">
            {t('forms.accessDeniedDesc')}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const canCreateForm = hasPermission('forms', 'create');

  const handleAIFormApply = async (generatedForm: AiGeneratedFormSchema) => {
    if (!currentProject?.id || !userProfile?.id || !userProfile?.organization_id) return;

    try {
      const created = await createFormFromAiGeneration(generatedForm, {
        projectId: currentProject.id,
        organizationId: userProfile.organization_id,
        userId: userProfile.id,
      });
      navigate(`/form-builder/${created.formId}?tab=builder`);
    } catch (error) {
      console.error('Error creating AI-generated form:', error);
    }
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {canReadForms && (
        <FormSubmissionsDialog>
          <Button variant="outline" size="sm">
            <BarChart3 className="icon-md me-2 text-module-forms" />
            {t('forms.viewDataTables')}
          </Button>
        </FormSubmissionsDialog>
      )}
      {canCreateForm && !permissionLoading && (
        <AIFormGenerator
          onApply={handleAIFormApply}
          buttonLabel={t('forms.generateWithAi')}
          buttonVariant="outline"
          buttonSize="default"
        />
      )}
      {canCreateForm && !permissionLoading && <CreateFormDialog />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVertical className="icon-md" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canCreateForm && !permissionLoading && (
            <ExcelFormImporter onImport={handleAIFormApply}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <FileSpreadsheet className="icon-md me-2 text-module-reports" />
                {t('forms.importFromExcel')}
              </DropdownMenuItem>
            </ExcelFormImporter>
          )}
          <DropdownMenuItem onClick={() => navigate('/form-audit-logs')}>
            <History className="icon-md me-2 text-module-reports" />
            {t('forms.formHistory')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/sla-management')} disabled={!currentProject}>
            <Timer className="icon-md me-2 text-module-reports" />
            {t('forms.slaManagement')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <DashboardLayout title={t('forms.title')} description={t('forms.description')} actions={actions}>
      <div className="smart-panel rounded-lg border border-border bg-card shadow-sm p-4 sm:p-6">
        <FormsList />
      </div>
    </DashboardLayout>
  );
};

export default Forms;
