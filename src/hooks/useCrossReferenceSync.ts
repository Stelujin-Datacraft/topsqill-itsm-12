
import { useCallback } from 'react';
import { FormField, Form } from '@/types/form';
import { useFormsData } from './useFormsData';

export interface CrossReferenceSyncOptions {
  parentFormId: string;
  parentFieldId: string;
  parentFormName: string;
  targetFormId: string;
  previousTargetFormId?: string;
}

export function useCrossReferenceSync() {
  const { forms, addField, deleteField, updateForm } = useFormsData();

  const createChildCrossReferenceField = useCallback(async (options: CrossReferenceSyncOptions) => {
    const { parentFormId, parentFieldId, parentFormName, targetFormId } = options;
    
    console.log('Creating child cross-reference field:', options);
    
    const targetForm = forms.find(f => f.id === targetFormId);
    if (!targetForm) {
      console.error('Target form not found:', targetFormId);
      return;
    }

    // Check if child field already exists
    const existingChildField = targetForm.fields.find(
      field => field.type === 'child-cross-reference' && 
               field.customConfig?.parentFormId === parentFormId &&
               field.customConfig?.parentFieldId === parentFieldId
    );

    if (existingChildField) {
      console.log('Child cross-reference field already exists');
      return;
    }

    // Get the first page or create default page structure
    const targetPageId = targetForm.pages?.[0]?.id || 'default';

    // Create the child cross-reference field with proper structure
    const childFieldData: Omit<FormField, 'id'> = {
      type: 'child-cross-reference',
      label: `References from ${parentFormName}`,
      required: false,
      defaultValue: '',
      permissions: { read: ['*'], write: ['*'] },
      triggers: [],
      placeholder: '',
      isVisible: true,
      isEnabled: true,
      currentValue: '',
      tooltip: `Shows records from ${parentFormName} that reference this record`,
      errorMessage: '',
      pageId: targetPageId,
      isFullWidth: true,
      fieldCategory: 'advanced',
      customConfig: {
        isChildField: true,
        parentFormId: parentFormId,
        parentFieldId: parentFieldId,
        parentFormName: parentFormName,
        targetFormId: parentFormId, // Child field points back to parent
        targetFormName: parentFormName,
        displayColumns: [], // Will be configured later
        filters: [], // No filters by default
        enableSorting: true,
        enableSearch: true,
        pageSize: 10,
        isParentReference: false
      }
    };

    try {
      console.log('Adding child field to target form:', targetFormId, childFieldData);
      const newField = await addField(targetFormId, childFieldData);
      
      if (newField) {
        console.log('Successfully created child cross-reference field:', newField.id);
        
        // Update target form's pages to include the new field if pages exist
        if (targetForm.pages && targetForm.pages.length > 0) {
          const updatedPages = targetForm.pages.map(page => 
            page.id === targetPageId 
              ? { ...page, fields: [...(page.fields || []), newField.id] }
              : page
          );
          
          try {
            await updateForm(targetFormId, { pages: updatedPages });
            console.log('Updated target form pages with new field');
          } catch (pageUpdateError) {
            console.warn('Could not update pages, but field was created:', pageUpdateError);
          }
        }
        
        return newField;
      }
    } catch (error) {
      console.error('Error creating child cross-reference field:', error);
      throw error;
    }
  }, [forms, addField, updateForm]);

  const removeChildCrossReferenceField = useCallback(async (options: { parentFormId: string; parentFieldId: string; targetFormId: string }) => {
    const { parentFormId, parentFieldId, targetFormId } = options;
    
    console.log('Removing child cross-reference field:', options);
    
    const targetForm = forms.find(f => f.id === targetFormId);
    if (!targetForm) {
      console.error('Target form not found:', targetFormId);
      return;
    }

    // Find existing child field
    const existingChildField = targetForm.fields.find(
      field => field.type === 'child-cross-reference' && 
               field.customConfig?.parentFormId === parentFormId &&
               field.customConfig?.parentFieldId === parentFieldId
    );

    if (existingChildField) {
      try {
        console.log('Deleting child cross-reference field:', existingChildField.id);
        await deleteField(existingChildField.id);
        
        // Update target form's pages to remove the field
        if (targetForm.pages && targetForm.pages.length > 0) {
          const updatedPages = targetForm.pages.map(page => ({
            ...page,
            fields: (page.fields || []).filter(fieldId => fieldId !== existingChildField.id)
          }));
          
          try {
            await updateForm(targetFormId, { pages: updatedPages });
            console.log('Updated target form pages after field removal');
          } catch (pageUpdateError) {
            console.warn('Could not update pages, but field was removed:', pageUpdateError);
          }
        }
        
        console.log('Successfully removed child cross-reference field');
      } catch (error) {
        console.error('Error removing child cross-reference field:', error);
        throw error;
      }
    } else {
      console.log('Child cross-reference field not found for removal');
    }
  }, [forms, deleteField, updateForm]);

  const syncCrossReferenceField = useCallback(async (options: CrossReferenceSyncOptions) => {
    const { targetFormId, previousTargetFormId } = options;

    console.log('Syncing cross-reference field:', options);

    try {
      // Remove child field from previous target form if target changed
      if (previousTargetFormId && previousTargetFormId !== targetFormId) {
        console.log('Removing child field from previous target form:', previousTargetFormId);
        await removeChildCrossReferenceField({
          parentFormId: options.parentFormId,
          parentFieldId: options.parentFieldId,
          targetFormId: previousTargetFormId
        });
      }

      // Create child field in new target form
      if (targetFormId) {
        console.log('Creating child field in new target form:', targetFormId);
        await createChildCrossReferenceField(options);
      }
      
      console.log('Cross-reference field sync completed successfully');
    } catch (error) {
      console.error('Error syncing cross-reference field:', error);
      throw error;
    }
  }, [createChildCrossReferenceField, removeChildCrossReferenceField]);

  const cleanupChildFieldsForForm = useCallback(async (formId: string) => {
    console.log('Cleaning up child fields for deleted form:', formId);
    
    // When a form is deleted, clean up all child fields that reference it
    const formsWithChildFields = forms.filter(form => 
      form.fields.some(field => 
        field.type === 'child-cross-reference' && 
        field.customConfig?.parentFormId === formId
      )
    );

    for (const form of formsWithChildFields) {
      const childFields = form.fields.filter(field => 
        field.type === 'child-cross-reference' && 
        field.customConfig?.parentFormId === formId
      );

      for (const childField of childFields) {
        try {
          console.log('Cleaning up orphaned child field:', childField.id);
          await deleteField(childField.id);
        } catch (error) {
          console.error('Error cleaning up child cross-reference field:', error);
        }
      }
    }
    
    console.log('Cleanup completed for form:', formId);
  }, [forms, deleteField]);

  return {
    syncCrossReferenceField,
    createChildCrossReferenceField,
    removeChildCrossReferenceField,
    cleanupChildFieldsForForm
  };
}
