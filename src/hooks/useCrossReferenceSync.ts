
import { useCallback } from 'react';
import { FormField, Form } from '@/types/form';
import { useFormsData } from './useFormsData';
import { v4 as uuidv4 } from 'uuid';

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
    
    console.log('Creating child cross-reference field with options:', options);
    
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

    // Get the first page ID, or create a default one
    const firstPageId = targetForm.pages && targetForm.pages.length > 0 
      ? targetForm.pages[0].id 
      : 'default';

    // Create the child cross-reference field
    const childField: Omit<FormField, 'id'> = {
      type: 'child-cross-reference',
      label: `References from ${parentFormName}`,
      required: false,
      pageId: firstPageId,
      isFullWidth: true,
      customConfig: {
        isChildField: true,
        parentFormId: parentFormId,
        parentFieldId: parentFieldId,
        parentFormName: parentFormName,
        targetFormId: parentFormId, // Child field points back to parent
        targetFormName: parentFormName,
        displayColumns: [], // Default to all columns
        filters: [], // No filters by default
        enableSorting: true,
        enableSearch: true,
        pageSize: 10,
        isParentReference: false
      },
      placeholder: '',
      isVisible: true,
      isEnabled: true,
      currentValue: '',
      tooltip: `Auto-generated cross-reference from ${parentFormName}`,
      errorMessage: '',
      fieldCategory: 'advanced',
      permissions: {
        read: ['*'],
        write: ['*']
      },
      triggers: []
    };

    try {
      console.log('Adding child field to target form:', targetFormId);
      const newField = await addField(targetFormId, childField);
      
      if (newField) {
        console.log('Successfully created child cross-reference field:', newField.id);
        
        // Update the target form's pages to include the new field if needed
        if (targetForm.pages && targetForm.pages.length > 0) {
          const updatedPages = targetForm.pages.map(page => 
            page.id === firstPageId 
              ? { ...page, fields: [...page.fields, newField.id] }
              : page
          );
          
          await updateForm(targetFormId, { pages: updatedPages });
          console.log('Updated target form pages with new field');
        } else {
          // Create a default page structure if none exists
          const defaultPage = {
            id: 'default',
            name: 'Page 1',
            order: 0,
            fields: [newField.id]
          };
          
          await updateForm(targetFormId, { pages: [defaultPage] });
          console.log('Created default page structure for target form');
        }
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
        await deleteField(existingChildField.id);
        console.log('Removed child cross-reference field:', existingChildField.id);
      } catch (error) {
        console.error('Error removing child cross-reference field:', error);
        throw error;
      }
    }
  }, [forms, deleteField]);

  const syncCrossReferenceField = useCallback(async (options: CrossReferenceSyncOptions) => {
    console.log('Syncing cross-reference field:', options);
    
    const { targetFormId, previousTargetFormId } = options;

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
    } catch (error) {
      console.error('Error syncing cross-reference field:', error);
      throw error;
    }
  }, [createChildCrossReferenceField, removeChildCrossReferenceField]);

  const cleanupChildFieldsForForm = useCallback(async (formId: string) => {
    console.log('Cleaning up child fields for form:', formId);
    
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
          await deleteField(childField.id);
          console.log('Cleaned up child cross-reference field:', childField.id);
        } catch (error) {
          console.error('Error cleaning up child cross-reference field:', error);
        }
      }
    }
  }, [forms, deleteField]);

  return {
    syncCrossReferenceField,
    createChildCrossReferenceField,
    removeChildCrossReferenceField,
    cleanupChildFieldsForForm
  };
}
