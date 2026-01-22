
import React from 'react';
import { PageContent } from '@/components/layouts/PageContent';
import { FormsList } from '@/components/FormsList';
import { CreateFormDialog } from '@/components/CreateFormDialog';
import { AssignedFormsDialog } from '@/components/AssignedFormsDialog';
import { FormSubmissionsDialog } from '@/components/FormSubmissionsDialog';
import { Button } from '@/components/ui/button';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { BarChart3 } from 'lucide-react';
import NoProjectSelected from '@/components/NoProjectSelected';

const Forms = () => {
  const { hasPermission, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();

  if (!currentProject) {
    return (
      <PageContent title="Forms">
        <NoProjectSelected />
      </PageContent>
    );
  }

  // Check if user can even see the forms page
  const canReadForms = hasPermission('forms', 'read');
  
  if (!permissionLoading && !canReadForms) {
    return (
      <PageContent title="Forms">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view forms in this project.
          </p>
        </div>
      </PageContent>
    );
  }

  const canCreateForm = hasPermission('forms', 'create');

  const actions = (
    <div className="flex space-x-2">
      {canReadForms && (
        <FormSubmissionsDialog>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Data Tables
          </Button>
        </FormSubmissionsDialog>
      )}
      {canReadForms && <AssignedFormsDialog />}
      {canCreateForm && !permissionLoading && <CreateFormDialog />}
    </div>
  );

  return (
    <PageContent title="Forms" actions={actions}>
      <FormsList />
    </PageContent>
  );
};

export default Forms;
