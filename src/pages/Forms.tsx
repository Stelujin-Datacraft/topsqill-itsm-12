import React from 'react';
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
import { BarChart3, History, FileText, Timer, MoreVertical } from 'lucide-react';
import NoProjectSelected from '@/components/NoProjectSelected';
import { AIFormGenerator } from '@/components/ai/AIFormGenerator';
import { ExcelFormImporter } from '@/components/ExcelFormImporter';
import { useFormsData } from '@/hooks/useFormsData';

const Forms = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { createForm, addField } = useFormsData();
  const { hasPermission, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();
  const [seeding, setSeeding] = useState(false);

  const handleSeedKPIs = async () => {
    if (!currentProject?.id || !userProfile?.organization_id || !userProfile?.id) return;
    setSeeding(true);
    try {
      const result = await seedProjectKPIsForm(currentProject.id, userProfile.organization_id, userProfile.id);
      toast.success(`Created "Project KPIs Tracker" with ${result.fieldCount} fields and ${result.submissionCount} submissions!`);
      window.location.reload();
    } catch (error: any) {
      console.error('Seed error:', error);
      toast.error('Failed to seed: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

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

  // Valid field types matching database constraint
  const VALID_FIELD_TYPES = new Set([
    'header', 'description', 'section-break', 'horizontal-line', 'full-width-container',
    'rich-text', 'record-table', 'matrix-grid',
    'text', 'textarea', 'number', 'date', 'time', 'datetime',
    'select', 'multi-select', 'radio', 'checkbox', 'toggle-switch',
    'slider', 'rating', 'file', 'image', 'color',
    'country', 'phone', 'address', 'currency', 'email', 'url',
    'ip-address', 'barcode', 'user-picker', 'group-picker',
    'approval', 'signature', 'tags', 'dynamic-dropdown',
    'cross-reference', 'child-cross-reference', 'calculated', 'conditional-section',
    'geo-location', 'workflow-trigger', 'submission-access', 'query-field'
  ]);

  // Map AI-generated field types to valid database types
  const sanitizeFieldType = (type: string): string => {
    const typeMapping: Record<string, string> = {
      'checkbox-group': 'checkbox',
      'toggle': 'toggle-switch',
      'divider': 'horizontal-line',
      'heading': 'header',
      'rich-text-editor': 'rich-text',
      'multiselect': 'multi-select',
      'switch': 'toggle-switch',
      'separator': 'horizontal-line',
      'title': 'header',
      'text-area': 'textarea',
      'dropdown': 'select'
    };
    
    const normalizedType = type.toLowerCase().trim();
    if (VALID_FIELD_TYPES.has(normalizedType)) {
      return normalizedType;
    }
    return typeMapping[normalizedType] || 'text'; // Default to text if unknown
  };

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
          
          // Sanitize the field type to ensure it's valid
          const sanitizedType = sanitizeFieldType(field.type);
          
          await addField(newForm.id, {
            label: field.label,
            type: sanitizedType as any,
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
    <div className="flex flex-wrap items-center gap-2">
      {canCreateForm && !permissionLoading && (
        <Button variant="outline" size="sm" onClick={handleSeedKPIs} disabled={seeding}>
          <Database className="h-4 w-4 mr-2" />
          {seeding ? 'Seeding...' : 'Seed KPI Form'}
        </Button>
      )}
      {canReadForms && (
        <FormSubmissionsDialog>
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Data Tables
          </Button>
        </FormSubmissionsDialog>
      )}
      {canCreateForm && !permissionLoading && (
        <AIFormGenerator
          onApply={handleAIFormApply}
          buttonLabel="Generate with AI"
          buttonVariant="outline"
          buttonSize="default"
        />
      )}
      {canCreateForm && !permissionLoading && <CreateFormDialog />}
      {canCreateForm && !permissionLoading && (
        <ExcelFormImporter onImport={handleAIFormApply} />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate('/my-submissions')}>
            <FileText className="h-4 w-4 mr-2 text-primary" />
            My Submissions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/form-audit-logs')}>
            <History className="h-4 w-4 mr-2 text-primary" />
            Form History
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/sla-management')} disabled={!currentProject}>
            <Timer className="h-4 w-4 mr-2 text-primary" />
            SLA Management
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <DashboardLayout title="Forms" description="Create and manage forms for data collection and submissions" actions={actions}>
      <FormsList />
    </DashboardLayout>
  );
};

export default Forms;
