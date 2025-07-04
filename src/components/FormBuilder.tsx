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
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Import optimized components
import { FormBuilderHeader } from './FormBuilder/FormBuilderHeader';
import { FormDetailsPanel } from './FormBuilder/FormDetailsPanel';
import { FieldTypesPanel } from './FormBuilder/FieldTypesPanel';
import { FieldPropertiesDialog } from './FormBuilder/FieldPropertiesDialog';
import { useFormBuilderState } from './FormBuilder/hooks/useFormBuilderState';
import { useFieldOperations } from './FormBuilder/hooks/useFieldOperations';
import { FormBuilderProps } from './FormBuilder/types/formBuilder';

export function FormBuilder({ formId }: FormBuilderProps) {
  const navigate = useNavigate();
  const { forms, createForm, updateForm, addField, deleteField, updateField, reorderFields, loading, loadForms } = useFormsData();
  const { userProfile } = useAuth();
  const { currentProject } = useProject();

  // Find current form
  const currentForm = formId ? forms.find(f => f.id === formId) : null;

  // State management
  const state = useFormBuilderState(currentForm, formId);

  const pages: FormPage[] = currentForm?.pages || [
    { id: 'default', name: 'Page 1', order: 0, fields: currentForm?.fields.map(f => f.id) || [] }
  ];

  // Initialize current page and ensure Page 1 exists for new forms
  useEffect(() => {
    if (state.isCreating && pages.length === 0) {
      // For new forms, create a default page
      state.setCurrentPageId('default');
    } else if (pages.length > 0 && !state.currentPageId) {
      console.log('Setting initial page:', pages[0].id);
      state.setCurrentPageId(pages[0].id);
    }
  }, [pages, state.currentPageId, state.isCreating]);

  // Update selected field when form changes
  useEffect(() => {
    if (state.selectedField && currentForm) {
      const updatedField = currentForm.fields.find(f => f.id === state.selectedField.id);
      if (updatedField) {
        console.log("-------------------------------------------------------------------------------------------------");
        console.log("----------------",updatedField);
        state.setSelectedField(updatedField);
      }
    }
  }, [currentForm?.fields, state.selectedField?.id]);

  // Get current page fields safely
  const getCurrentPageFields = () => {
    if (!state.currentPageId || !currentForm) {
      console.log('No current page or form:', { currentPageId: state.currentPageId, hasForm: !!currentForm });
      return [];
    }
    
    const currentPage = pages.find(p => p.id === state.currentPageId);
    if (!currentPage) {
      console.log('Current page not found:', state.currentPageId, 'Available pages:', pages.map(p => p.id));
      return [];
    }
    
    const pageFields = currentForm.fields.filter(field => {
      // Check if field is explicitly assigned to this page
      if (field.pageId === state.currentPageId) return true;
      // Check if field is in the page's field list
      if (currentPage.fields.includes(field.id)) return true;
      // For default page, include fields without pageId
      if (state.currentPageId === 'default' && !field.pageId) return true;
      return false;
    });
    
    console.log('Current page fields:', {
      pageId: state.currentPageId,
      page: currentPage,
      allFields: currentForm.fields.length,
      pageFields: pageFields.length,
      fieldIds: pageFields.map(f => f.id)
    });
    
    return pageFields;
  };

  const currentPageFields = getCurrentPageFields();

  // Refresh form data function
  const refreshFormData = async () => {
    console.log('Refreshing form data...');
    if (loadForms) {
      await loadForms();
    }
  };

  // Field operations with proper error handling and refresh capability
  const fieldOperations = useFieldOperations(
    currentForm,
    state.currentPageId,
    pages,
    state.formName,
    state.formDescription,
    state.columnLayout,
    state.setIsCreating,
    state.setIsSaving,
    state.setSelectedField,
    state.setShowFieldProperties,
    state.setHighlightedFieldId,
    updateForm,
    refreshFormData
  );

  // Safe save handler
  const handleSave = async (shouldPublish = false) => {
    if (!state.formName.trim()) {
      toast({
        title: "Form name required",
        description: "Please enter a name for your form.",
        variant: "destructive",
      });
      return;
    }

    if (!userProfile?.organization_id) {
      toast({
        title: "Organization required",
        description: "You must be part of an organization to create forms.",
        variant: "destructive",
      });
      return;
    }

    if (!currentProject) {
      toast({
        title: "Project required",
        description: "Please select a project before creating forms.",
        variant: "destructive",
      });
      return;
    }

    try {
      shouldPublish ? state.setIsPublishing(true) : state.setIsSaving(true);

      const formUpdates = {
        name: state.formName,
        description: state.formDescription,
        layout: { columns: state.columnLayout },
        pages: pages,
        status: shouldPublish ? 'active' as const : state.formStatus,
        projectId: currentProject.id,
      };

      if (currentForm) {
        await updateForm(currentForm.id, formUpdates);
        toast({
          title: shouldPublish ? "Form published" : "Form updated",
          description: shouldPublish 
            ? "Your form has been published successfully and is now live." 
            : "Your form changes have been saved successfully.",
        });
      } else {
        const newForm = await createForm({
          ...formUpdates,
          organizationId: userProfile.organization_id,
          projectId: currentProject.id,
          status: shouldPublish ? 'active' : 'draft',
          createdBy: userProfile.email,
          isPublic: false,
          permissions: {
            view: ['*'],
            submit: ['*'],
            edit: ['admin']
          },
          shareSettings: { allowPublicAccess: false, sharedUsers: [] },
          fieldRules: [],
          formRules: [],
          // Ensure default page exists for new forms
          pages: pages.length === 0 ? [{ id: 'default', name: 'Page 1', order: 0, fields: [] }] : pages,
        });

        if (newForm) {
          state.setIsCreating(false);
          navigate(`/form-builder/${newForm.id}`, { replace: true });
          toast({
            title: shouldPublish ? "Form created and published" : "Form created",
            description: shouldPublish 
              ? "Your new form has been created and published successfully."
              : "Your new form has been created successfully.",
          });
        }
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

  // Safe status change handler
  const handleStatusChange = async (newStatus: Form['status']) => {
    if (!currentForm) return;
    
    state.setFormStatus(newStatus);
    try {
      await updateForm(currentForm.id, { status: newStatus });
      toast({
        title: "Status updated",
        description: `Form status has been changed to ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error updating status",
        description: "Failed to update form status. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Safe field configuration save
  const handleSaveFieldConfiguration = async (fieldId: string, updates: Partial<FormField>) => {
    if (!currentForm) return;
    
    state.setSavingFieldConfig(fieldId);
    
    try {
      await updateField(fieldId, updates);
      
      if (state.selectedField && state.selectedField.id === fieldId) {
        const updatedField = currentForm.fields.find(f => f.id === fieldId);
        if (updatedField) {
          state.setSelectedField({ ...updatedField, ...updates });
        }
      }
      
      toast({
        title: "Configuration saved",
        description: "Field configuration has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving field configuration:', error);
      toast({
        title: "Error saving configuration",
        description: "Failed to save field configuration. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      state.setSavingFieldConfig(null);
    }
  };

  // Add page handler
  const handleAddPage = async () => {
    if (!currentForm) {
      toast({
        title: "Save form first",
        description: "Please save your form before adding pages.",
        variant: "destructive",
      });
      return;
    }

    const newPageId = `page-${Date.now()}`;
    const newPage: FormPage = {
      id: newPageId,
      name: `Page ${pages.length + 1}`,
      order: pages.length,
      fields: []
    };

    const updatedPages = [...pages, newPage];
    
    try {
      await updateForm(currentForm.id, { pages: updatedPages });
      state.setCurrentPageId(newPageId);
      toast({
        title: "Page added",
        description: "New page has been added successfully.",
      });
    } catch (error) {
      console.error('Error adding page:', error);
      toast({
        title: "Error adding page",
        description: "Failed to add new page. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle page rename
  const handlePageRename = async (pageId: string, newName: string) => {
    if (!currentForm) return;

    const updatedPages = pages.map(page => 
      page.id === pageId ? { ...page, name: newName } : page
    );

    try {
      await updateForm(currentForm.id, { pages: updatedPages });
      await refreshFormData();
      toast({
        title: "Page renamed",
        description: "Page has been renamed successfully.",
      });
    } catch (error) {
      console.error('Error renaming page:', error);
      toast({
        title: "Error renaming page",
        description: "Failed to rename page. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle page delete
  const handlePageDelete = async (pageId: string) => {
    if (!currentForm || pages.length <= 1) return;

    const pageToDelete = pages.find(p => p.id === pageId);
    if (!pageToDelete) return;

    const firstPage = pages.find(p => p.id !== pageId);
    if (!firstPage) return;

    const updatedPages = pages
      .filter(p => p.id !== pageId)
      .map(page => {
        if (page.id === firstPage.id) {
          return { ...page, fields: [...page.fields, ...pageToDelete.fields] };
        }
        return page;
      });

    const fieldsToUpdate = currentForm.fields.filter(field => 
      pageToDelete.fields.includes(field.id)
    );

    try {
      await updateForm(currentForm.id, { pages: updatedPages });

      for (const field of fieldsToUpdate) {
        await updateField(field.id, { pageId: firstPage.id });
      }

      if (state.currentPageId === pageId) {
        state.setCurrentPageId(firstPage.id);
      }

      await refreshFormData();

      toast({
        title: "Page deleted",
        description: `Page "${pageToDelete.name}" has been deleted and its fields moved to "${firstPage.name}".`,
      });
    } catch (error) {
      console.error('Error deleting page:', error);
      toast({
        title: "Error deleting page",
        description: "Failed to delete page. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
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
          <FormBuilderHeader
            onSave={handleSave}
            isSaving={state.isSaving}
            isPublishing={state.isPublishing}
            isCreating={state.isCreating}
            currentForm={currentForm}
            formStatus={state.formStatus}
            onStatusChange={handleStatusChange}
            onUpdateForm={(updates) => currentForm && updateForm(currentForm.id, updates)}
          />
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
                    fields={currentForm?.fields || []}
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
                    formName={state.formName}
                    setFormName={state.setFormName}
                    formDescription={state.formDescription}
                    setFormDescription={state.setFormDescription}
                    columnLayout={state.columnLayout}
                    setColumnLayout={state.setColumnLayout}
                    pages={pages}
                    currentPageId={state.currentPageId}
                    setCurrentPageId={state.setCurrentPageId}
                    currentForm={currentForm}
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
                {currentForm ? (
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
                          fields={currentForm.fields}
                          rules={currentForm.fieldRules || []}
                          onRulesChange={(fieldRules) => updateForm(currentForm.id, { fieldRules })}
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
                          fields={currentForm.fields}
                          rules={currentForm.formRules || []}
                          onRulesChange={(formRules) => updateForm(currentForm.id, { formRules })}
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
              {currentForm ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <FormPreview form={currentForm} showNavigation={true} />
                </div>
              ) : (
                <Card className="bg-white shadow-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Save your form first to see the preview</p>
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

export default FormBuilder;
