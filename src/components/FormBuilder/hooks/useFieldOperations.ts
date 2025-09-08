import { useNavigate } from 'react-router-dom';
import { useFormsData } from '@/hooks/useFormsData';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { FormField, Form, FormPage } from '@/types/form';
import { fieldTypes } from '@/data/fieldTypes';
import { toast } from '@/hooks/use-toast';

export function useFieldOperations(
  currentForm: Form | null,
  currentPageId: string,
  pages: FormPage[],
  formName: string,
  formDescription: string,
  columnLayout: 1 | 2 | 3,
  setIsCreating: (creating: boolean) => void,
  setIsSaving: (saving: boolean) => void,
  setSelectedField: (field: any) => void,
  setShowFieldProperties: (show: boolean) => void,
  setHighlightedFieldId: (fieldId: string | null) => void,
  updateForm: (id: string, updates: Partial<Form>) => Promise<void>,
  refreshFormData?: () => Promise<void>
) {
  const navigate = useNavigate();
  const { createForm, addField, deleteField, updateField, reorderFields } = useFormsData();
  const { userProfile } = useAuth();
  const { currentProject } = useProject();

  const handleAddField = async (type: string) => {
    console.log('Adding field of type:', type, 'to form:', currentForm?.id, 'page:', currentPageId);
    
    if (!currentForm) {
      if (!formName.trim()) {
        toast({
          title: "Form name required",
          description: "Please enter a form name before adding fields.",
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

      setIsSaving(true);
      const newForm = await createForm({
        name: formName,
        description: formDescription,
        organizationId: userProfile.organization_id,
        projectId: currentProject.id,
        status: 'draft',
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
        layout: { columns: columnLayout },
        pages: pages,
      });

      if (newForm) {
        setIsCreating(false);
        navigate(`/form-builder/${newForm.id}`, { replace: true });
      }
      setIsSaving(false);

      if (!newForm) return;
    }

    // Ensure we have a valid current page ID
    const targetPageId = currentPageId || 'default';
    
    const fieldConfig = fieldTypes.find(ft => ft.type === type);
    const newField: Omit<FormField, 'id'> = {
      type: type as FormField['type'],
      label: fieldConfig?.label || `New ${type} field`,
      required: false,
      defaultValue: '',
      permissions: { read: ['*'], write: ['*'] },
      triggers: [],
      placeholder: '',
      isVisible: true,
      isEnabled: true,
      currentValue: '',
      tooltip: '',
      errorMessage: '',
      pageId: targetPageId,
      isFullWidth: fieldConfig?.isFullWidth || false,
      fieldCategory: fieldConfig?.category || 'standard',
    };

    console.log('Creating field with pageId:', targetPageId);
    const addedField = await addField(currentForm!.id, newField);

    if (addedField && currentForm) {
      console.log('Field added successfully:', addedField);
      
      // Update the pages to include the new field in the current page
      const updatedPages = pages.map(page => 
        page.id === targetPageId 
          ? { ...page, fields: [...page.fields, addedField.id] }
          : page
      );
      
      console.log('Updating form pages:', updatedPages);
      await updateForm(currentForm.id, { pages: updatedPages });
      
      // Refresh form data to show the new field immediately
      if (refreshFormData) {
        await refreshFormData();
      }
        
      toast({
        title: "Field added",
        description: `${fieldConfig?.label || 'Field'} has been added successfully to the current page.`,
      });
    }
  };

  const handleFieldClick = (field: FormField) => {
    console.log('Field clicked:', field);
    setSelectedField(field);
    setShowFieldProperties(true);
  };

  const handleFieldUpdate = (fieldId: string, updates: Partial<FormField>) => {
    if (!currentForm) return;
    console.log('Updating field:', fieldId, 'with updates:', updates);
    updateField(fieldId, updates);
  };

  const handleFieldDelete = async (fieldId: string) => {
    if (!currentForm) return;
    
    console.log('Deleting field:', fieldId);
    
    try {
      await deleteField(fieldId);
      
      // Remove field from pages
      const updatedPages = pages.map(page => ({
        ...page,
        fields: page.fields.filter(fId => fId !== fieldId)
      }));
      
      await updateForm(currentForm.id, { pages: updatedPages });
      
      // Refresh form data to update the UI immediately
      if (refreshFormData) {
        await refreshFormData();
      }
      
      toast({
        title: "Field deleted",
        description: "Field has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting field:', error);
      toast({
        title: "Error deleting field",
        description: "Failed to delete field. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFieldHighlight = (fieldId: string) => {
    setHighlightedFieldId(fieldId);
    setTimeout(() => {
      setHighlightedFieldId(null);
    }, 5000);
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination || !currentForm) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    console.log('Reordering fields from', sourceIndex, 'to', destinationIndex);
    
    // Reorder fields with the current page fields
    await reorderFields(currentForm.id, sourceIndex, destinationIndex);
    
    // Refresh form data to ensure UI is updated
    if (refreshFormData) {
      await refreshFormData();
    }
  };

  return {
    handleAddField,
    handleFieldClick,
    handleFieldUpdate,
    handleFieldDelete,
    handleFieldHighlight,
    handleDragEnd,
  };
}
