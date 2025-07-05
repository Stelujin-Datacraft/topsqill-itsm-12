import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useFormWithFields } from '@/hooks/useFormWithFields';
import { useFormsData } from '@/hooks/useFormsData';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Form } from '@/types/form';
import { FormBuilderHeader } from './FormBuilder/FormBuilderHeader';
import { FormDetailsPanel } from './FormBuilder/FormDetailsPanel';
import { FieldLayoutRenderer } from './FormBuilder/FieldLayoutRenderer';
import { FieldTypesPanel } from './FormBuilder/FieldTypesPanel';
import { FieldPropertiesDialog } from './FormBuilder/FieldPropertiesDialog';
import { FormPreview } from './FormPreview';
import { useFormBuilderState } from './FormBuilder/hooks/useFormBuilderState';
import { useOptimizedFieldOperations } from './FormBuilder/hooks/useOptimizedFieldOperations';
import { FormSnapshotProvider } from './FormBuilder/contexts/FormSnapshotContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Settings } from 'lucide-react';

interface FormBuilderProps {
  formId?: string;
}

function FormBuilderContent({ formId }: FormBuilderProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const { form: currentForm, loading, error } = useFormWithFields(formId);
  const { createForm, updateForm } = useFormsData();
  const [activeTab, setActiveTab] = useState('builder');

  const state = useFormBuilderState(currentForm, formId);
  const {
    formName,
    setFormName,
    formDescription,
    setFormDescription,
    formStatus,
    setFormStatus,
    selectedField,
    setSelectedField,
    isCreating,
    setIsCreating,
    isSaving,
    setIsSaving,
    isPublishing,
    setIsPublishing,
    currentPageId,
    setCurrentPageId,
    columnLayout,
    setColumnLayout,
    highlightedFieldId,
    setHighlightedFieldId,
    showNavigation,
    setShowNavigation,
    showFieldProperties,
    setShowFieldProperties,
    fieldTypeSearch,
    setFieldTypeSearch,
    savingFieldConfig,
    setSavingFieldConfig,
    showFormDetails,
    setShowFormDetails,
  } = state;

  // Create a working form object for operations
  const workingForm: Form = currentForm || {
    id: '',
    name: formName,
    description: formDescription,
    organizationId: userProfile?.organization_id || '',
    projectId: currentProject?.id || '',
    status: formStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userProfile?.email || '',
    isPublic: false,
    permissions: { view: ['*'], submit: ['*'], edit: ['admin'] },
    shareSettings: { allowPublicAccess: false, sharedUsers: [] },
    fieldRules: [],
    formRules: [],
    layout: { columns: columnLayout },
    pages: [{ id: 'default', name: 'Page 1', order: 0, fields: [] }],
    fields: [],
  };

  const pages = Array.isArray(workingForm.pages) && workingForm.pages.length > 0 
    ? workingForm.pages 
    : [{ id: 'default', name: 'Page 1', order: 0, fields: [] }];

  const currentPage = pages.find(p => p.id === currentPageId) || pages[0];
  const pageFields = Array.isArray(workingForm.fields) 
    ? workingForm.fields.filter(field => {
        const fieldPageId = field.pageId || 'default';
        return fieldPageId === currentPageId;
      })
    : [];

  // Add the requested console logs
  console.log(state);
  console.log(workingForm);
  console.log('Current page fields from snapshot:', {
    pageId: currentPageId,
    page: currentPage,
    allFields: workingForm.fields.length,
    pageFields: pageFields.length,
    fieldIds: pageFields.map(f => f.id)
  });

  const handleCreateForm = async (formData: any) => {
    setIsSaving(true);
    try {
      const newForm = await createForm(formData);
      if (newForm) {
        navigate(`/form-builder/${newForm.id}`, { replace: true });
        return newForm;
      }
    } catch (error) {
      console.error('Error creating form:', error);
      toast({
        title: "Error creating form",
        description: "Failed to create form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fieldOperations = useOptimizedFieldOperations(
    currentPageId,
    pages,
    formName,
    formDescription,
    columnLayout,
    setIsCreating,
    setSelectedField,
    setShowFieldProperties,
    setHighlightedFieldId,
    handleCreateForm
  );

  // Initialize current page
  useEffect(() => {
    if (pages.length > 0 && !currentPageId) {
      setCurrentPageId(pages[0].id);
    }
  }, [pages, currentPageId, setCurrentPageId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate('/forms')}>
              Back to Forms
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <FormBuilderHeader
        onSave={async (shouldPublish?: boolean) => {
          // Handle save logic here
        }}
        isSaving={isSaving}
        isPublishing={isPublishing}
        isCreating={isCreating}
        currentForm={currentForm}
        formStatus={formStatus}
        onStatusChange={setFormStatus}
        onUpdateForm={async (updates: any) => {
          // Handle form update logic here
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="builder" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="builder" className="flex-1 flex mt-0">
          <div className="flex-1 flex">
            {/* Left Panel - Form Details */}
            <div className="w-80 border-r bg-muted/30 flex flex-col">
              <FormDetailsPanel
                formName={formName}
                setFormName={setFormName}
                formDescription={formDescription}
                setFormDescription={setFormDescription}
                columnLayout={columnLayout}
                setColumnLayout={setColumnLayout}
                pages={pages}
                currentPageId={currentPageId}
                setCurrentPageId={setCurrentPageId}
                currentForm={currentForm}
                currentPageFieldsCount={pageFields.length}
                onAddPage={() => {
                  // Handle add page logic
                }}
                onPageRename={(pageId: string, newName: string) => {
                  // Handle page rename logic
                }}
                onPageDelete={(pageId: string) => {
                  // Handle page delete logic
                }}
                currentPageFields={pageFields}
                selectedFieldId={selectedField?.id}
                highlightedFieldId={highlightedFieldId}
                onFieldClick={fieldOperations.handleFieldClick}
                onFieldDelete={fieldOperations.handleFieldDelete}
                onDragEnd={fieldOperations.handleDragEnd}
                showFormDetails={showFormDetails}
                setShowFormDetails={setShowFormDetails}
              />
            </div>

            {/* Center Panel - Form Canvas */}
            <div className="flex-1 flex flex-col">
              <div className="flex-1 p-6 overflow-auto">
                <Card className="h-full">
                  <CardContent className="p-6 h-full">
                    <FieldLayoutRenderer
                      fields={pageFields}
                      columnLayout={columnLayout}
                      selectedFieldId={selectedField?.id}
                      highlightedFieldId={highlightedFieldId}
                      onFieldClick={fieldOperations.handleFieldClick}
                      onFieldDelete={fieldOperations.handleFieldDelete}
                      onDragEnd={fieldOperations.handleDragEnd}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right Panel - Field Types */}
            <div className="w-80 border-l bg-muted/30">
              <FieldTypesPanel
                onAddField={fieldOperations.handleAddField}
                fieldTypeSearch={fieldTypeSearch}
                setFieldTypeSearch={setFieldTypeSearch}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="flex-1 mt-0">
          <div className="h-full p-6">
            <FormPreview 
              form={workingForm} 
              showNavigation={showNavigation}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Field Properties Dialog */}
      {showFieldProperties && selectedField && (
        <FieldPropertiesDialog
          selectedField={selectedField}
          open={showFieldProperties}
          onClose={() => {
            setShowFieldProperties(false);
            setSelectedField(null);
          }}
          onSave={async (fieldId: string, updates: any) => {
            return fieldOperations.handleFieldUpdate(fieldId, updates);
          }}
        />
      )}
    </div>
  );
}

export function FormBuilder({ formId }: FormBuilderProps) {
  const { form: currentForm } = useFormWithFields(formId);
  
  return (
    <FormSnapshotProvider initialForm={currentForm}>
      <FormBuilderContent formId={formId} />
    </FormSnapshotProvider>
  );
}
