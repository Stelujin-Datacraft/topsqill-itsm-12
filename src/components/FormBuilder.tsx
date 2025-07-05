import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useFormsData } from '@/hooks/useFormsData';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { FormField, FormPage, Form } from '@/types/form';
import { FormPreview } from './FormPreview';
import { FormSharing } from './FormSharing';
import { FormSubmissions } from './FormSubmissions';
import { FormUserAccess } from './FormUserAccess';
import { FieldRuleBuilder } from './rules/FieldRuleBuilder';
import { FormRuleBuilder } from './rules/FormRuleBuilder';
import { FormNavigationPanel } from './FormNavigationPanel';
import { 
  Zap,
  Users,
  Database,
  Settings,
  Save,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Import optimized components
import { FormBuilderHeader } from './FormBuilder/FormBuilderHeader';
import { FormDetailsPanel } from './FormBuilder/FormDetailsPanel';
import { FieldTypesPanel } from './FormBuilder/FieldTypesPanel';
import { FieldPropertiesDialog } from './FormBuilder/FieldPropertiesDialog';
import { useFormBuilderState } from './FormBuilder/hooks/useFormBuilderState';
import { useOptimizedFieldOperations } from './FormBuilder/hooks/useOptimizedFieldOperations';
import { FormBuilderProps } from './FormBuilder/types/formBuilder';
import { FormSnapshotProvider, useFormSnapshotContext } from './FormBuilder/contexts/FormSnapshotContext';
import { Button } from '@/components/ui/button';

function FormBuilderContent({ formId }: FormBuilderProps) {
  const navigate = useNavigate();
  const { forms, createForm, updateForm, addField, deleteField, updateField, reorderFields, loading, loadForms } = useFormsData();
  const { userProfile } = useAuth();
  const { currentProject } = useProject();

  // Find current form
  const currentForm = formId ? forms.find(f => f.id === formId) : null;
  
  // Use snapshot context
  const {
    snapshot,
    initializeSnapshot,
    updateFormDetails,
    updateFieldInSnapshot,
    addPageToSnapshot,
    updatePageInSnapshot,
    deletePageFromSnapshot,
    markAsSaved,
    resetSnapshot
  } = useFormSnapshotContext();

  // State management
  const state = useFormBuilderState(currentForm, formId);

  // Use snapshot data or fallback to current form
  const workingForm = snapshot.form || currentForm;
  const pages: FormPage[] = workingForm?.pages || [
    { id: 'default', name: 'Page 1', order: 0, fields: workingForm?.fields.map(f => f.id) || [] }
  ];

  // Initialize snapshot when form loads
  useEffect(() => {
    if (currentForm && !snapshot.isInitialized) {
      console.log('Initializing form snapshot:', currentForm);
      initializeSnapshot(currentForm);
    }
  }, [currentForm, snapshot.isInitialized, initializeSnapshot]);

  // Initialize current page and ensure Page 1 exists for new forms
  useEffect(() => {
    if (state.isCreating && pages.length === 0) {
      // For new forms, create a default page
      state.setCurrentPageId('default');
    } else if (pages.length > 0 && !state.currentPageId) {
      console.log('Setting initial page:', pages[0].id);
      state.setCurrentPageId(pages[0].id);
    } else if (!state.isCreating && workingForm && pages.length === 0) {
      // If form exists but has no pages, create Page 1 automatically
      handleAddPage();
    }
  }, [pages, state.currentPageId, state.isCreating, workingForm]);

  // Update selected field when snapshot changes
  useEffect(() => {
    if (state.selectedField && workingForm) {
      const updatedField = workingForm.fields.find(f => f.id === state.selectedField.id);
      if (updatedField) {
        console.log("Field updated in snapshot:", updatedField);
        state.setSelectedField(updatedField);
      }
    }
  }, [workingForm?.fields, state.selectedField?.id]);

  // Get current page fields safely from snapshot
  const getCurrentPageFields = () => {
    if (!state.currentPageId || !workingForm) {
      console.log('No current page or form:', { currentPageId: state.currentPageId, hasForm: !!workingForm });
      return [];
    }
    
    const currentPage = pages.find(p => p.id === state.currentPageId);
    if (!currentPage) {
      console.log('Current page not found:', state.currentPageId, 'Available pages:', pages.map(p => p.id));
      return [];
    }
    
    const pageFields = workingForm.fields.filter(field => {
      // Check if field is explicitly assigned to this page
      if (field.pageId === state.currentPageId) return true;
      // Check if field is in the page's field list
      if (currentPage.fields.includes(field.id)) return true;
      // For default page, include fields without pageId
      if (state.currentPageId === 'default' && !field.pageId) return true;
      return false;
    });
    console.log(state)
    console.log(workingForm)
    console.log(pageFields)
    console.log('Current page fields from snapshot:', {
      pageId: state.currentPageId,
      page: currentPage,
      allFields: workingForm.fields.length,
      pageFields: pageFields.length,
      fieldIds: pageFields.map(f => f.id)
    });
    
    return pageFields;
  };

  const currentPageFields = getCurrentPageFields();

  // Handle form creation for optimized operations
  const handleCreateForm = async (formData: any) => {
    const newForm = await createForm(formData);
    if (newForm) {
      initializeSnapshot(newForm);
      navigate(`/form-builder/${newForm.id}`, { replace: true });
    }
    return newForm;
  };

  // Field operations with optimized snapshot handling
  const fieldOperations = useOptimizedFieldOperations(
    state.currentPageId,
    pages,
    state.formName,
    state.formDescription,
    state.columnLayout,
    state.setIsCreating,
    state.setSelectedField,
    state.setShowFieldProperties,
    state.setHighlightedFieldId,
    handleCreateForm
  );

  // Optimized save handler - saves snapshot to database
  const handleSave = async (shouldPublish = false) => {
    if (!snapshot.form) {
      toast({
        title: "No form to save",
        description: "Please create a form first.",
        variant: "destructive",
      });
      return;
    }

    if (!snapshot.form.name.trim()) {
      toast({
        title: "Form name required",
        description: "Please enter a name for your form.",
        variant: "destructive",
      });
      return;
    }

    try {
      shouldPublish ? state.setIsPublishing(true) : state.setIsSaving(true);

      const formUpdates = {
        name: snapshot.form.name,
        description: snapshot.form.description,
        layout: snapshot.form.layout,
        pages: snapshot.form.pages,
        status: shouldPublish ? 'active' as const : snapshot.form.status,
      };

      if (currentForm) {
        // Update existing form with all snapshot data
        await updateForm(currentForm.id, formUpdates);
        
        // Save all field changes
        for (const field of snapshot.form.fields) {
          if (currentForm.fields.find(f => f.id === field.id)) {
            await updateField(field.id, field);
          } else {
            await addField(currentForm.id, field);
          }
        }

        // Delete removed fields
        for (const oldField of currentForm.fields) {
          if (!snapshot.form.fields.find(f => f.id === oldField.id)) {
            await deleteField(oldField.id);
          }
        }

        markAsSaved();
        
        toast({
          title: shouldPublish ? "Form published" : "Form saved",
          description: shouldPublish 
            ? "Your form has been published successfully and is now live." 
            : "All changes have been saved to the database.",
        });
      }
    } catch (error) {
      console.error('Error saving form:', error);
      toast({
        title: "Error saving form",
        description: "There was an error saving your form. Please try again.",
        variant: "destructive",
      });
    } finally {
      state.setIsSaving(false);
      state.setIsPublishing(false);
    }
  };

  // Status change handler for snapshot
  const handleStatusChange = async (newStatus: Form['status']) => {
    if (!snapshot.form) return;
    
    state.setFormStatus(newStatus);
    updateFormDetails({ status: newStatus });
  };

  // Optimized field configuration save (instant update)
  const handleSaveFieldConfiguration = async (fieldId: string, updates: Partial<FormField>) => {
    if (!snapshot.form) return;
    
    // Update in snapshot immediately
    updateFieldInSnapshot(fieldId, updates);
    
    if (state.selectedField && state.selectedField.id === fieldId) {
      state.setSelectedField({ ...state.selectedField, ...updates });
    }
    
    toast({
      title: "Configuration updated",
      description: "Field configuration updated. Save form to persist changes.",
    });
  };

  // Optimized add page handler
  const handleAddPage = async () => {
    const newPageId = `page-${Date.now()}`;
    const newPage: FormPage = {
      id: newPageId,
      name: `Page ${pages.length + 1}`,
      order: pages.length,
      fields: []
    };

    addPageToSnapshot(newPage);
    state.setCurrentPageId(newPageId);
    
    toast({
      title: "Page added",
      description: "New page has been added. Save form to persist changes.",
    });
  };

  // Optimized page rename handler
  const handlePageRename = async (pageId: string, newName: string) => {
    updatePageInSnapshot(pageId, { name: newName });
    
    toast({
      title: "Page renamed",
      description: "Page has been renamed. Save form to persist changes.",
    });
  };

  // Optimized page delete handler
  const handlePageDelete = async (pageId: string) => {
    if (pages.length <= 1) return;

    const pageToDelete = pages.find(p => p.id === pageId);
    if (!pageToDelete) return;

    const firstPage = pages.find(p => p.id !== pageId);
    if (!firstPage) return;

    deletePageFromSnapshot(pageId);

    if (state.currentPageId === pageId) {
      state.setCurrentPageId(firstPage.id);
    }

    toast({
      title: "Page deleted",
      description: `Page "${pageToDelete.name}" has been deleted. Save form to persist changes.`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading forms...</div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="mb-2">
            <h1 className="text-2xl font-bold">
              {state.isCreating ? 'Create New Form' : `Edit: ${workingForm?.name || 'Loading...'}`}
            </h1>
            {snapshot.isDirty && (
              <p className="text-sm text-orange-600 mt-1">
                Unsaved changes - Click save to persist to database
              </p>
            )}
          </div>
          <FormBuilderHeader
            onSave={handleSave}
            isSaving={state.isSaving}
            isPublishing={state.isPublishing}
            isCreating={state.isCreating}
            currentForm={workingForm}
            formStatus={workingForm?.status || state.formStatus}
            onStatusChange={handleStatusChange}
            onUpdateForm={(updates) => {
              if (currentForm) {
                updateForm(currentForm.id, updates);
              }
            }}
          />
          {snapshot.isDirty && (
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                onClick={resetSnapshot}
                disabled={state.isSaving || state.isPublishing}
              >
                Discard Changes
              </Button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <Tabs defaultValue="builder" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="builder" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Form Builder
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Rules Engine
              </TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="submissions" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Submissions
              </TabsTrigger>
              <TabsTrigger value="access" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                User Access
              </TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="space-y-0">
              <div className="grid grid-cols-12 gap-6 h-[calc(100vh-16rem)]">
                {/* Navigation Panel */}
                <div className={`${state.showNavigation ? "col-span-3" : "col-span-1"} bg-white rounded-lg shadow-sm border border-gray-200`}>
                  <FormNavigationPanel
                    pages={pages}
                    fields={workingForm?.fields || []}
                    currentPageId={state.currentPageId}
                    selectedField={state.selectedField}
                    onPageChange={state.setCurrentPageId}
                    onFieldSelect={fieldOperations.handleFieldClick}
                    onFieldHighlight={fieldOperations.handleFieldHighlight}
                    onToggleNavigation={() => state.setShowNavigation(!state.showNavigation)}
                    isCollapsed={!state.showNavigation}
                  />
                </div>

                {/* Form Details Panel */}
                <div className={`${state.showNavigation ? "col-span-6" : "col-span-8"} bg-white rounded-lg shadow-sm border border-gray-200`}>
                  <FormDetailsPanel
                    formName={workingForm?.name || state.formName}
                    setFormName={(name) => {
                      state.setFormName(name);
                      updateFormDetails({ name });
                    }}
                    formDescription={workingForm?.description || state.formDescription}
                    setFormDescription={(description) => {
                      state.setFormDescription(description);
                      updateFormDetails({ description });
                    }}
                    columnLayout={workingForm?.layout?.columns as (1 | 2 | 3) || state.columnLayout}
                    setColumnLayout={(layout) => {
                      state.setColumnLayout(layout);
                      updateFormDetails({ layout: { columns: layout } });
                    }}
                    pages={pages}
                    currentPageId={state.currentPageId}
                    setCurrentPageId={state.setCurrentPageId}
                    currentForm={workingForm}
                    currentPageFieldsCount={currentPageFields.length}
                    onAddPage={handleAddPage}
                    onPageRename={handlePageRename}
                    onPageDelete={handlePageDelete}
                    currentPageFields={currentPageFields}
                    selectedFieldId={state.selectedField?.id}
                    highlightedFieldId={state.highlightedFieldId}
                    onFieldClick={fieldOperations.handleFieldClick}
                    onFieldDelete={fieldOperations.handleFieldDelete}
                    onDragEnd={fieldOperations.handleDragEnd}
                    showFormDetails={state.showFormDetails}
                    setShowFormDetails={state.setShowFormDetails}
                  />
                </div>

                {/* Field Types Panel */}
                <div className="col-span-3 bg-white rounded-lg shadow-sm border border-gray-200">
                  <FieldTypesPanel
                    fieldTypeSearch={state.fieldTypeSearch}
                    setFieldTypeSearch={state.setFieldTypeSearch}
                    onAddField={fieldOperations.handleAddField}
                    disabled={state.isSaving}
                  />
                </div>
              </div>

              {/* Field Properties Dialog */}
              <FieldPropertiesDialog
                selectedField={state.selectedField}
                open={state.showFieldProperties}
                onClose={() => state.setShowFieldProperties(false)}
                onSave={handleSaveFieldConfiguration}
              />
            </TabsContent>

            <TabsContent value="rules">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {workingForm ? (
                  <>
                    <Card className="bg-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="h-5 w-5" />
                          Field Rules
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FieldRuleBuilder
                          fields={workingForm.fields}
                          rules={workingForm.fieldRules || []}
                          onRulesChange={(fieldRules) => updateFormDetails({ fieldRules })}
                        />
                      </CardContent>
                    </Card>

                    <Card className="bg-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Form Rules
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FormRuleBuilder
                          fields={workingForm.fields}
                          rules={workingForm.formRules || []}
                          onRulesChange={(formRules) => updateFormDetails({ formRules })}
                        />
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="col-span-2 bg-white shadow-sm">
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Save your form first to configure rules</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="preview">
              {workingForm ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <FormPreview form={workingForm} showNavigation={true} />
                </div>
              ) : (
                <Card className="bg-white shadow-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Create a form first to see the preview</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="submissions">
              {currentForm ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <FormSubmissions form={currentForm} />
                </div>
              ) : (
                <Card className="bg-white shadow-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Save your form first to view submissions</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="access">
              {currentForm ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <FormUserAccess form={currentForm} onUpdateForm={(updates) => updateForm(currentForm.id, updates)} />
                </div>
              ) : (
                <Card className="bg-white shadow-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Save your form first to manage user access</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function FormBuilder({ formId }: FormBuilderProps) {
  const { forms, loading } = useFormsData();
  const currentForm = formId ? forms.find(f => f.id === formId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading forms...</div>
      </div>
    );
  }

  return (
    <FormSnapshotProvider initialForm={currentForm}>
      <FormBuilderContent formId={formId} />
    </FormSnapshotProvider>
  );
}

export default FormBuilder;

