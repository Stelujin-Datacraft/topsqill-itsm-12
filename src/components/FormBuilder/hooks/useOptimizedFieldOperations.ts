import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { FormField, FormPage } from '@/types/form';
import { fieldTypes } from '@/data/fieldTypes';
import { toast } from '@/hooks/use-toast';
import { useFormSnapshotContext } from '../contexts/FormSnapshotContext';
import { useCrossReferenceSync } from '@/hooks/useCrossReferenceSync';

export function useOptimizedFieldOperations(
  currentPageId: string,
  pages: FormPage[],
  formName: string,
  formDescription: string,
  columnLayout: 1 | 2 | 3,
  setIsCreating: (creating: boolean) => void,
  setSelectedField: (field: any) => void,
  setShowFieldProperties: (show: boolean) => void,
  setHighlightedFieldId: (fieldId: string | null) => void,
  onCreateForm: (formData: any) => Promise<any>
) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const {
    snapshot,
    addFieldToSnapshot,
    updateFieldInSnapshot,
    deleteFieldFromSnapshot,
    reorderFieldsInSnapshot
  } = useFormSnapshotContext();
  
  const { removeChildCrossReferenceField } = useCrossReferenceSync();

  const handleAddField = async (type: string) => {
    console.log('Adding field of type:', type, 'to snapshot, page:', currentPageId);
    
    if (!snapshot.form) {
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

      // Create form first, then add field
      await onCreateForm({
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

      setIsCreating(false);
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

    console.log('Creating field in snapshot with pageId:', targetPageId);
    const addedField = addFieldToSnapshot(newField, targetPageId);

    console.log('Field added to snapshot successfully:', addedField);
    
    toast({
      title: "Field added",
      description: `${fieldConfig?.label || 'Field'} has been added successfully to the current page.`,
    });
  };

  const handleFieldClick = (field: FormField) => {
    console.log('Field clicked:', field);
    setSelectedField(field);
    setShowFieldProperties(true);
  };

  const handleFieldUpdate = (fieldId: string, updates: Partial<FormField>) => {
    console.log('Updating field in snapshot:', fieldId, 'with updates:', updates);
    updateFieldInSnapshot(fieldId, updates);
  };

  const handleFieldDelete = async (fieldId: string) => {
    console.log('Deleting field from snapshot:', fieldId);
    
    const fieldToDelete = snapshot.form?.fields.find(f => f.id === fieldId);
    
    // Check if the field is a child-cross-reference - warn user but allow deletion
    if (fieldToDelete?.type === 'child-cross-reference') {
      const parentFormName = fieldToDelete.customConfig?.parentFormName || 'the parent form';
      const confirmed = window.confirm(
        `This field is automatically managed by a cross-reference field in "${parentFormName}".\n\n` +
        `Deleting it here will remove it, but it may be recreated if the parent cross-reference field still exists.\n\n` +
        `To permanently remove this field, delete the parent cross-reference field in "${parentFormName}".\n\n` +
        `Do you want to delete it anyway?`
      );
      if (!confirmed) {
        return;
      }
    }
    
    try {
      // If it's a cross-reference field, clean up child fields immediately in the target form
      if (fieldToDelete?.type === 'cross-reference' && snapshot.form) {
        const targetFormId = fieldToDelete.customConfig?.targetFormId;
        if (targetFormId) {
          console.log('Deleting cross-reference field, cleaning up child field in target form:', targetFormId);
          try {
            await removeChildCrossReferenceField({
              parentFormId: snapshot.form.id,
              parentFieldId: fieldId,
              targetFormId: targetFormId
            });
          } catch {
            // Continue with deletion even if cleanup fails
          }
        }
      }
      
      deleteFieldFromSnapshot(fieldId);
      
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
    if (!result.destination || !snapshot.form) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    console.log('Reordering fields in snapshot from', sourceIndex, 'to', destinationIndex);
    
    // Reorder fields in snapshot - instant update
    reorderFieldsInSnapshot(currentPageId, sourceIndex, destinationIndex);
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