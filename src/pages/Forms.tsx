import React from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      tooltip?: string;
      options?: Array<{ label: string; value: string }>;
      validation?: any;
      isFullWidth?: boolean;
    }>;
    pages?: Array<{ name: string; description?: string; fieldIndexes: number[] }>;
    suggestedLayout?: 1 | 2 | 3;
  }) => {
    if (!currentProject?.id || !userProfile?.id || !userProfile?.organization_id) return;
    if (!Array.isArray(generatedForm.fields) || generatedForm.fields.length === 0) {
      console.error('AI form generator returned no fields');
      return;
    }
    
    try {
      // Build pages from AI suggestion or default to single page
      const aiPages = generatedForm.pages && generatedForm.pages.length > 0
        ? generatedForm.pages
        : null;

      // Determine which field indexes are actually referenced by a page.
      // Any field not referenced is considered orphaned/non-used and skipped
      // so we don't create DB rows for fields the user never sees.
      const referencedIndexes = new Set<number>();
      if (aiPages) {
        aiPages.forEach((p) => {
          (p.fieldIndexes || []).forEach((idx) => {
            if (
              typeof idx === 'number' &&
              idx >= 0 &&
              idx < generatedForm.fields.length
            ) {
              referencedIndexes.add(idx);
            }
          });
        });
      }

      const formPages = aiPages
        ? aiPages.map((p, idx) => ({
            id: `page-${idx + 1}`,
            name: p.name || `Page ${idx + 1}`,
            order: idx,
            fields: [] as string[],
          }))
        : [{ id: 'default', name: 'Page 1', order: 0, fields: [] as string[] }];

      // Build a mapping: fieldIndex -> pageId
      const fieldPageMap: Record<number, string> = {};
      if (aiPages) {
        aiPages.forEach((page, pageIdx) => {
          (page.fieldIndexes || []).forEach((fieldIdx) => {
            fieldPageMap[fieldIdx] = `page-${pageIdx + 1}`;
          });
        });
      }

      const newForm = await createForm({
        name: generatedForm.name,
        description: generatedForm.description,
        projectId: currentProject.id,
        organizationId: userProfile.organization_id,
        createdBy: userProfile.id,
        status: 'draft',
        isPublic: false,
        layout: { columns: generatedForm.suggestedLayout || 1 },
        pages: formPages,
        fieldRules: [],
        formRules: [],
        permissions: { view: [], submit: [], edit: [] },
        shareSettings: { allowPublicAccess: false, sharedUsers: [] }
      });

      if (newForm) {
        // Track created field IDs per page
        const pageFieldIds: Record<string, string[]> = {};
        formPages.forEach(p => { pageFieldIds[p.id] = []; });

        for (let i = 0; i < generatedForm.fields.length; i++) {
          // Skip fields that aren't referenced by any page when pages are provided.
          if (aiPages && !referencedIndexes.has(i)) {
            console.warn(`Skipping orphaned AI field at index ${i}: "${generatedForm.fields[i]?.label}"`);
            continue;
          }
          const field = generatedForm.fields[i];
          const mappedOptions = field.options?.map((opt, idx) => ({
            id: `opt-${idx}-${Date.now()}`,
            value: opt.value,
            label: opt.label
          }));
          
          const sanitizedType = sanitizeFieldType(field.type);
          const pageId = fieldPageMap[i] || formPages[0]?.id || 'default';
          
          const newField = await addField(newForm.id, {
            label: field.label,
            type: sanitizedType as any,
            required: field.required,
            placeholder: field.placeholder,
            options: mappedOptions,
            validation: field.validation,
            tooltip: field.tooltip,
            pageId
          });

          // Track the field ID for its page
          if (newField?.id && pageFieldIds[pageId]) {
            pageFieldIds[pageId].push(newField.id);
          }
        }

        // Update the form's pages with the created field IDs
        const updatedPages = formPages.map(p => ({
          ...p,
          fields: pageFieldIds[p.id] || []
        }));

        await supabase
          .from('forms')
          .update({ pages: updatedPages as any })
          .eq('id', newForm.id);
        
        navigate(`/form-builder/${newForm.id}`);
      }
    } catch (error) {
      console.error('Error creating AI-generated form:', error);
    }
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canCreateForm && !permissionLoading && (
            <ExcelFormImporter onImport={handleAIFormApply}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <FileSpreadsheet className="h-4 w-4 mr-2 text-module-forms" />
                Import from Excel
              </DropdownMenuItem>
            </ExcelFormImporter>
          )}
          <DropdownMenuItem onClick={() => navigate('/form-audit-logs')}>
            <History className="h-4 w-4 mr-2 text-module-forms" />
            Form History
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/sla-management')} disabled={!currentProject}>
            <Timer className="h-4 w-4 mr-2 text-module-forms" />
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
