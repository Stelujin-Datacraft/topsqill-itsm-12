
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

    // Create the child cross-reference field
    const childField: FormField = {
      id: uuidv4(),
      type: 'child-cross-reference',
      label: `References from ${parentFormName}`,
      required: false,
      pageId: targetForm.pages?.[0]?.id || 'default', // Add to first page
      isFullWidth: false,
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
      }
    };

    try {
      await addField(targetFormId, childField);
      console.log('Created child cross-reference field:', childField.id);
    } catch (error) {
      console.error('Error creating child cross-reference field:', error);
    }
  }, [forms, addField]);

  const removeChildCrossReferenceField = useCallback(async (options: { parentFormId: string; parentFieldId: string; targetFormId: string }) => {
    const { parentFormId, parentFieldId, targetFormId } = options;
    
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
      }
    }
  }, [forms, deleteField]);

  const syncCrossReferenceField = useCallback(async (options: CrossReferenceSyncOptions) => {
    const { targetFormId, previousTargetFormId } = options;

    // Remove child field from previous target form if target changed
    if (previousTargetFormId && previousTargetFormId !== targetFormId) {
      await removeChildCrossReferenceField({
        parentFormId: options.parentFormId,
        parentFieldId: options.parentFieldId,
        targetFormId: previousTargetFormId
      });
    }

    // Create child field in new target form
    if (targetFormId) {
      await createChildCrossReferenceField(options);
    }
  }, [createChildCrossReferenceField, removeChildCrossReferenceField]);

  const cleanupChildFieldsForForm = useCallback(async (formId: string) => {
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
