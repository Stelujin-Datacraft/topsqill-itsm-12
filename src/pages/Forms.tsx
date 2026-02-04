
import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { FormsList } from '@/components/FormsList';
import { CreateFormDialog } from '@/components/CreateFormDialog';
import { AssignedFormsDialog } from '@/components/AssignedFormsDialog';
import { FormSubmissionsDialog } from '@/components/FormSubmissionsDialog';
import { Button } from '@/components/ui/button';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3 } from 'lucide-react';
import NoProjectSelected from '@/components/NoProjectSelected';
import { AIFormGenerator } from '@/components/ai/AIFormGenerator';
import { useFormsData } from '@/hooks/useFormsData';

const Forms = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { createForm, addField } = useFormsData();
  const { hasPermission, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();

  if (!currentProject) {
    return (
      <DashboardLayout title="Forms">
        <NoProjectSelected />
      </DashboardLayout>
    );
  }

  // Check if user can even see the forms page
  const canReadForms = hasPermission('forms', 'read');
  
  if (!permissionLoading && !canReadForms) {
    return (
      <DashboardLayout title="Forms">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view forms in this project.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const canCreateForm = hasPermission('forms', 'create');

  // Handle AI-generated form creation
  const handleAIFormApply = async (generatedForm: {
    name: string;
    description: string;
    fields: Array<{
      label: string;
      type: string;
      required: boolean;
      placeholder?: string;
      options?: Array<{ label: string; value: string }>;
      validation?: any;
    }>;
  }) => {
    if (!currentProject?.id || !userProfile?.id || !userProfile?.organization_id) return;
    
    try {
      // Create the form first
      const newForm = await createForm({
        name: generatedForm.name,
        description: generatedForm.description,
        projectId: currentProject.id,
        organizationId: userProfile.organization_id,
        createdBy: userProfile.id,
        status: 'draft',
        isPublic: false,
        layout: { columns: 1 },
        pages: [{ id: 'default', name: 'Page 1', order: 0, fields: [] }],
        fieldRules: [],
        formRules: [],
        permissions: { view: [], submit: [], edit: [] },
        shareSettings: { allowPublicAccess: false, sharedUsers: [] }
      });

      if (newForm) {
        // Add each field to the form - map options to include id
        for (let i = 0; i < generatedForm.fields.length; i++) {
          const field = generatedForm.fields[i];
          const mappedOptions = field.options?.map((opt, idx) => ({
            id: `opt-${idx}-${Date.now()}`,
            value: opt.value,
            label: opt.label
          }));
          
          await addField(newForm.id, {
            label: field.label,
            type: field.type as any,
            required: field.required,
            placeholder: field.placeholder,
            options: mappedOptions,
            validation: field.validation,
            pageId: 'default'
          });
        }
        
        // Navigate to the form builder
        navigate(`/form-builder/${newForm.id}`);
      }
    } catch (error) {
      console.error('Error creating AI-generated form:', error);
    }
  };

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
      {canCreateForm && !permissionLoading && (
        <AIFormGenerator
          onApply={handleAIFormApply}
          buttonLabel="Generate with AI"
          buttonVariant="outline"
          buttonSize="default"
        />
      )}
      {canCreateForm && !permissionLoading && <CreateFormDialog />}
    </div>
  );

  return (
    <DashboardLayout title="Forms" description="Create and manage forms for data collection and submissions" actions={actions}>
      <FormsList />
    </DashboardLayout>
  );
};

export default Forms;
