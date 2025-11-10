import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useFormsData } from '@/hooks/useFormsData';
import { useFormLoader } from '@/hooks/useFormLoader';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { FormField, FormPage, Form } from '@/types/form';
import { FormPreview } from './FormPreview';
import { FormSharing } from './FormSharing';
import { FormSubmissions } from './FormSubmissions';
import { FormUserAccess } from './FormUserAccess';
import { EnhancedFieldRuleBuilder } from './rules/EnhancedFieldRuleBuilder';
import { EnhancedFormRuleBuilder } from './rules/EnhancedFormRuleBuilder';
import { FormNavigationPanel } from './FormNavigationPanel';
import { Zap, Users, Database, Settings, Save, ArrowLeft, Undo2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Import optimized components
import { FormBuilderHeader } from './FormBuilder/FormBuilderHeader';
import { FormDetailsPanel } from './FormBuilder/FormDetailsPanel';
import { FieldTypesPanel } from './FormBuilder/FieldTypesPanel';
import { FieldPropertiesDialog } from './FormBuilder/FieldPropertiesDialog';
import { FieldLayoutRenderer } from './FormBuilder/FieldLayoutRenderer';
import { useFormBuilderState } from './FormBuilder/hooks/useFormBuilderState';
import { useOptimizedFieldOperations } from './FormBuilder/hooks/useOptimizedFieldOperations';
import { FormBuilderProps } from './FormBuilder/types/formBuilder';
import { FormSnapshotProvider, useFormSnapshotContext } from './FormBuilder/contexts/FormSnapshotContext';
import { useCrossReferenceSync } from '@/hooks/useCrossReferenceSync';
import { Button } from '@/components/ui/button';
function FormBuilderContent({
  formId
}: FormBuilderProps) {
  const navigate = useNavigate();
  const {
    createForm,
    updateForm,
    addField,
    deleteField,
    updateField,
    reorderFields,
    loadForms
  } = useFormsData();
  const {
    userProfile
  } = useAuth();
  const {
    currentProject
  } = useProject();

  // Load the full form with all fields including customConfig
  const { form: currentForm, loading } = useFormLoader(formId);

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
  const pages: FormPage[] = workingForm?.pages || [{
    id: 'default',
    name: 'Page 1',
    order: 0,
    fields: workingForm?.fields.map(f => f.id) || []
  }];

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
      console.log('No current page or form:', {
        currentPageId: state.currentPageId,
        hasForm: !!workingForm
      });
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
    console.log(state);
    console.log(workingForm);
    console.log(pageFields);
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
      navigate(`/form-builder/${newForm.id}`, {
        replace: true
      });
    }
    return newForm;
  };

  // Field operations with optimized snapshot handling
  const fieldOperations = useOptimizedFieldOperations(state.currentPageId, pages, state.formName, state.formDescription, state.columnLayout, state.setIsCreating, state.setSelectedField, state.setShowFieldProperties, state.setHighlightedFieldId, handleCreateForm);

  // Optimized save handler - saves snapshot to database
  const handleSave = async (shouldPublish = false) => {
    if (!snapshot.form) {
      toast({
        title: "No form to save",
        description: "Please create a form first.",
        variant: "destructive"
      });
      return;
    }
    if (!snapshot.form.name.trim()) {
      toast({
        title: "Form name required",
        description: "Please enter a name for your form.",
        variant: "destructive"
      });
      return;
    }
    try {
      shouldPublish ? state.setIsPublishing(true) : state.setIsSaving(true);
      
      // Only create a new form if there's no formId (truly new form)
      if (!formId) {
        const formData = {
          name: snapshot.form.name,
          description: snapshot.form.description,
          organizationId: userProfile?.organization_id!,
          projectId: currentProject?.id!,
          status: shouldPublish ? 'active' as const : 'draft' as const,
          createdBy: userProfile?.id!,
          layout: snapshot.form.layout,
          pages: snapshot.form.pages,
          fieldRules: snapshot.form.fieldRules || [],
          formRules: snapshot.form.formRules || [],
          permissions: { view: [], submit: [], edit: [] },
          shareSettings: { allowPublicAccess: false, sharedUsers: [] }
        };
        
        const newForm = await handleCreateForm(formData);
        if (!newForm) {
          throw new Error('Failed to create form');
        }
        
        // Add all fields to the new form
        for (const field of snapshot.form.fields) {
          await addField(newForm.id, field);
        }
        
        state.setIsCreating(false);
        markAsSaved();
        toast({
          title: shouldPublish ? "Form created and published" : "Form created",
          description: shouldPublish ? "Your form has been created and published successfully." : "Your form has been created successfully."
        });
        return;
      }
      
      // Update existing form with snapshot data
      const formUpdates = {
        name: snapshot.form.name,
        description: snapshot.form.description,
        layout: snapshot.form.layout,
        pages: snapshot.form.pages,
        fieldRules: snapshot.form.fieldRules,
        formRules: snapshot.form.formRules,
        status: shouldPublish ? 'active' as const : snapshot.form.status
      };
      
      await updateForm(formId!, formUpdates);

      // Save all field changes
      const existingFields = currentForm?.fields || [];
      for (const field of snapshot.form.fields) {
        if (existingFields.find(f => f.id === field.id)) {
          await updateField(field.id, field);
        } else {
          await addField(formId!, field);
        }
      }

      // Delete removed fields and handle cross-reference cleanup
      for (const oldField of existingFields) {
        if (!snapshot.form.fields.find(f => f.id === oldField.id)) {
          // If it's a cross-reference field, clean up child fields first
          if (oldField.type === 'cross-reference' && oldField.customConfig?.targetFormId) {
            try {
              await removeChildCrossReferenceField({
                parentFormId: formId!,
                parentFieldId: oldField.id,
                targetFormId: oldField.customConfig.targetFormId
              });
            } catch (error) {
              console.error('Error removing child cross-reference field:', error);
            }
          }
          await deleteField(oldField.id);
        }
      }
      markAsSaved();
      toast({
        title: shouldPublish ? "Form published" : "Form saved",
        description: shouldPublish ? "Your form has been published successfully and is now live." : "All changes have been saved to the database."
      });
    } catch (error) {
      console.error('Error saving form:', error);
      toast({
        title: "Error saving form",
        description: "There was an error saving your form. Please try again.",
        variant: "destructive"
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
    updateFormDetails({
      status: newStatus
    });
  };
  const {
    syncCrossReferenceField,
    removeChildCrossReferenceField
  } = useCrossReferenceSync();

  // Optimized field configuration save (instant update)
  const handleSaveFieldConfiguration = async (fieldId: string, updates: Partial<FormField>) => {
    if (!snapshot.form) return;

    // Get the current field to check if it's a cross-reference field
    const currentField = snapshot.form.fields.find(f => f.id === fieldId);

    // Update in snapshot immediately
    updateFieldInSnapshot(fieldId, updates);
    if (state.selectedField && state.selectedField.id === fieldId) {
      state.setSelectedField({
        ...state.selectedField,
        ...updates
      });
    }

    // Handle cross-reference field sync when targetFormId changes
    if (currentField?.type === 'cross-reference' && updates.customConfig?.targetFormId) {
      try {
        await syncCrossReferenceField({
          parentFormId: snapshot.form.id,
          parentFieldId: fieldId,
          parentFormName: snapshot.form.name,
          targetFormId: updates.customConfig.targetFormId,
          previousTargetFormId: currentField.customConfig?.targetFormId
        });
      } catch (error) {
        console.error('Error syncing cross-reference field:', error);
        toast({
          title: "Warning",
          description: "Field configuration saved but cross-reference sync failed. Please check target form.",
          variant: "destructive"
        });
        return;
      }
    }

    // Handle target form change - remove from old target and add to new target
    if (currentField?.type === 'cross-reference' && currentField.customConfig?.targetFormId && updates.customConfig?.targetFormId && currentField.customConfig.targetFormId !== updates.customConfig.targetFormId) {
      try {
        // Remove from previous target form
        await removeChildCrossReferenceField({
          parentFormId: snapshot.form.id,
          parentFieldId: fieldId,
          targetFormId: currentField.customConfig.targetFormId
        });
      } catch (error) {
        console.error('Error removing child cross-reference field from previous target:', error);
      }
    }
    toast({
      title: "Configuration updated",
      description: "Field configuration updated. Save form to persist changes."
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
      description: "New page has been added. Save form to persist changes."
    });
  };

  // Optimized page rename handler
  const handlePageRename = async (pageId: string, newName: string) => {
    updatePageInSnapshot(pageId, {
      name: newName
    });
    toast({
      title: "Page renamed",
      description: "Page has been renamed. Save form to persist changes."
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
      description: `Page "${pageToDelete.name}" has been deleted. Save form to persist changes.`
    });
  };
  if (loading) {
    return <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading forms...</div>
      </div>;
  }
  return <TooltipProvider>
      <div className="min-h-screen bg-white px-[15px] py-[10px]">
        {/* Top Action Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate('/forms')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Forms
              </Button>
              
              {/* Combined Save/Publish Button */}
              <div className="flex items-center gap-2">
                <Button onClick={() => handleSave(true)} disabled={state.isSaving || state.isPublishing} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {state.isPublishing ? 'Publishing...' : state.isSaving ? 'Saving...' : state.isCreating ? 'Create & Publish' : 'Save & Publish'}
                </Button>
                
                {/* Discard Changes Button */}
                {snapshot.isDirty && <Button variant="outline" size="sm" onClick={resetSnapshot} disabled={state.isSaving || state.isPublishing} className="px-2">
                    <Undo2 className="h-4 w-4" />
                  </Button>}
              </div>
            </div>
            
            {workingForm && <div className="text-sm text-muted-foreground">
                Last updated: {new Date(workingForm.updatedAt || Date.now()).toLocaleDateString()}
              </div>}
          </div>
        </div>

        {/* Main Content with Tabs at Top */}
        <div className="flex-1 bg-white">
          <Tabs defaultValue="builder" className="w-full">
            <div className="bg-white border-b border-gray-200 px-6">
              <TabsList className="grid w-full grid-cols-6 max-w-2xl">
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="builder" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Builder
                </TabsTrigger>
                <TabsTrigger value="rules" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Rules
                </TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="submissions" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Data
                </TabsTrigger>
                <TabsTrigger value="access" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Access
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Form Details Tab */}
            <TabsContent value="details" className="p-0">
              <FormDetailsPanel formName={workingForm?.name || state.formName} setFormName={name => {
              state.setFormName(name);
              updateFormDetails({
                name
              });
            }} formDescription={workingForm?.description || state.formDescription} setFormDescription={description => {
              state.setFormDescription(description);
              updateFormDetails({
                description
              });
            }} columnLayout={state.columnLayout} setColumnLayout={state.setColumnLayout} pages={pages} currentPageId={state.currentPageId} setCurrentPageId={state.setCurrentPageId} currentForm={workingForm} currentPageFieldsCount={currentPageFields.length} onAddPage={handleAddPage} onPageRename={handlePageRename} onPageDelete={handlePageDelete} currentPageFields={currentPageFields} selectedFieldId={state.selectedField?.id} highlightedFieldId={state.highlightedFieldId} onFieldClick={field => {
              state.setSelectedField(field);
              state.setShowFieldProperties(true);
            }} onFieldDelete={fieldOperations.handleFieldDelete} onDragEnd={fieldOperations.handleDragEnd} showFormDetails={true} setShowFormDetails={() => {}} />
            </TabsContent>

            <TabsContent value="builder" className="p-0">
              <div className="grid grid-cols-12 h-[calc(100vh-10rem)] gap-0">
                {/* Left Panel - Navigation (Fixed) */}
                <div className={`${state.isNavigationCollapsed ? 'col-span-1' : 'col-span-3'} border-r bg-muted/30 overflow-hidden flex flex-col transition-all duration-200`}>
                  <div className="flex-shrink-0">
                     <FormNavigationPanel pages={pages} fields={workingForm?.fields || []} currentPageId={state.currentPageId} selectedField={state.selectedField} onPageChange={state.setCurrentPageId} onFieldSelect={field => {
                     // Navigate to field's page and highlight it
                     const fieldPage = pages.find(page => page.fields.includes(field.id) || field.pageId === page.id);
                     if (fieldPage && fieldPage.id !== state.currentPageId) {
                       state.setCurrentPageId(fieldPage.id);
                     }
                     state.setHighlightedFieldId(field.id);
                     // Clear highlight after 5 seconds
                     setTimeout(() => {
                       state.setHighlightedFieldId(null);
                     }, 5000);
                     // Scroll to field after a short delay
                     setTimeout(() => {
                       const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`);
                       if (fieldElement) {
                         fieldElement.scrollIntoView({
                           behavior: 'smooth',
                           block: 'center'
                         });
                       }
                     }, 100);
                   }} onFieldHighlight={(fieldId: string) => {
                     state.setHighlightedFieldId(fieldId);
                     // Clear highlight after 5 seconds
                     setTimeout(() => {
                       state.setHighlightedFieldId(null);
                     }, 5000);
                   }} onToggleNavigation={() => state.setIsNavigationCollapsed(!state.isNavigationCollapsed)} isCollapsed={state.isNavigationCollapsed} />
                  </div>
                </div>

                {/* Center Panel - Form Layout */}
                <div className={`${state.isNavigationCollapsed ? 'col-span-8' : 'col-span-6'} flex flex-col transition-all duration-200`}>
                  {/* Fixed Page Navigation */}
                  <div className="flex-shrink-0 bg-white border-b border-border">
                    <FormDetailsPanel formName={workingForm?.name || state.formName} setFormName={name => {
                    state.setFormName(name);
                    updateFormDetails({
                      name
                    });
                  }} formDescription={workingForm?.description || state.formDescription} setFormDescription={description => {
                    state.setFormDescription(description);
                    updateFormDetails({
                      description
                    });
                  }} columnLayout={workingForm?.layout?.columns as (1 | 2 | 3) || state.columnLayout} setColumnLayout={layout => {
                    state.setColumnLayout(layout);
                    updateFormDetails({
                      layout: {
                        columns: layout
                      }
                    });
                  }} pages={pages} currentPageId={state.currentPageId} setCurrentPageId={state.setCurrentPageId} currentForm={workingForm} currentPageFieldsCount={currentPageFields.length} onAddPage={handleAddPage} onPageRename={handlePageRename} onPageDelete={handlePageDelete} currentPageFields={currentPageFields} selectedFieldId={state.selectedField?.id} highlightedFieldId={state.highlightedFieldId} onFieldClick={field => {
                    state.setSelectedField(field);
                    state.setShowFieldProperties(true);
                  }} onFieldDelete={fieldOperations.handleFieldDelete} onDragEnd={fieldOperations.handleDragEnd} showFormDetails={state.showFormDetails} setShowFormDetails={state.setShowFormDetails} />
                  </div>
                  
                  {/* Scrollable Form Fields */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="min-h-full">
                      {currentPageFields.length > 0 ? <FieldLayoutRenderer fields={currentPageFields} columnLayout={workingForm?.layout?.columns as (1 | 2 | 3) || state.columnLayout} selectedFieldId={state.selectedField?.id} highlightedFieldId={state.highlightedFieldId} onFieldClick={field => {
                      state.setSelectedField(field);
                      state.setShowFieldProperties(true);
                    }} onFieldDelete={fieldOperations.handleFieldDelete} onDragEnd={fieldOperations.handleDragEnd} /> : <div className="text-center py-12 text-muted-foreground">
                          <div className="text-lg font-medium mb-2">No fields on this page yet</div>
                          <div className="text-sm">Add fields from the right panel to get started</div>
                        </div>}
                    </div>
                  </div>
                </div>

                {/* Right Panel - Field Types (Fixed) */}
                <div className="col-span-3 border-l bg-muted/30 flex flex-col">
                  <div className="flex-shrink-0 h-full overflow-y-auto">
                    <div className="p-4 px-0 py-0">
                      <FieldTypesPanel fieldTypeSearch={state.fieldTypeSearch} setFieldTypeSearch={state.setFieldTypeSearch} onAddField={fieldOperations.handleAddField} disabled={state.isSaving} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Field Properties Dialog */}
              <FieldPropertiesDialog selectedField={state.selectedField} open={state.showFieldProperties} onClose={() => state.setShowFieldProperties(false)} onSave={handleSaveFieldConfiguration} />
            </TabsContent>

            <TabsContent value="rules">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {workingForm ? <>
                    <Card className="bg-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="h-5 w-5" />
                          Field Rules
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <EnhancedFieldRuleBuilder fields={workingForm.fields} rules={workingForm.fieldRules || []} onRulesChange={fieldRules => updateFormDetails({
                      fieldRules
                    })} />
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
                        <EnhancedFormRuleBuilder fields={workingForm.fields} rules={workingForm.formRules || []} onRulesChange={formRules => updateFormDetails({
                      formRules
                    })} />
                      </CardContent>
                    </Card>
                  </> : <Card className="col-span-2 bg-white shadow-sm">
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Save your form first to configure rules</p>
                    </CardContent>
                  </Card>}
              </div>
            </TabsContent>

            <TabsContent value="preview">
              {workingForm ? <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <FormPreview form={workingForm} showNavigation={true} />
                </div> : <Card className="bg-white shadow-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Create a form first to see the preview</p>
                  </CardContent>
                </Card>}
            </TabsContent>

            <TabsContent value="submissions">
              {currentForm ? <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <FormSubmissions form={currentForm} />
                </div> : <Card className="bg-white shadow-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Save your form first to view submissions</p>
                  </CardContent>
                </Card>}
            </TabsContent>

            <TabsContent value="access">
              {currentForm ? <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <FormUserAccess form={currentForm} onUpdateForm={updates => updateForm(currentForm.id, updates)} />
                </div> : <Card className="bg-white shadow-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Save your form first to manage user access</p>
                  </CardContent>
                </Card>}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>;
}
export function FormBuilder({
  formId
}: FormBuilderProps) {
  const {
    forms,
    loading
  } = useFormsData();
  const currentForm = formId ? forms.find(f => f.id === formId) : null;
  if (loading) {
    return <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading forms...</div>
      </div>;
  }
  return <FormSnapshotProvider initialForm={currentForm}>
      <FormBuilderContent formId={formId} />
    </FormSnapshotProvider>;
}
export default FormBuilder;