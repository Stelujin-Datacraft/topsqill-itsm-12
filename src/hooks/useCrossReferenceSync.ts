import { useCallback } from 'react';
import { FormField, Form } from '@/types/form';
import { useFormsData } from './useFormsData';
import { supabase } from '@/integrations/supabase/client';

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
    
    // Fetch fresh data from database instead of relying on potentially stale local state
    const { data: existingChildFields, error: checkError } = await supabase
      .from('form_fields')
      .select('id, custom_config')
      .eq('form_id', targetFormId)
      .eq('field_type', 'child-cross-reference');
    
    if (checkError) {
      return;
    }

    // Check if child field already exists in database
    const existingChildField = existingChildFields?.find(field => {
      const config = typeof field.custom_config === 'string' 
        ? JSON.parse(field.custom_config) 
        : field.custom_config;
      return config?.parentFormId === parentFormId && config?.parentFieldId === parentFieldId;
    });

    if (existingChildField) {
      return;
    }
    
    const targetForm = forms.find(f => f.id === targetFormId);
    const parentForm = forms.find(f => f.id === parentFormId);
    
    if (!targetForm || !parentForm) {
      return;
    }

    // Get the first page or create default page structure
    const targetPageId = targetForm.pages?.[0]?.id || 'default';

    // Get all columns from parent form for displayColumns, excluding cross-reference fields
    const parentFormColumns = parentForm.fields
      .filter(field => !['header', 'description', 'section-break', 'horizontal-line', 'cross-reference', 'child-cross-reference'].includes(field.type))
      .map(field => field.id);

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
        targetFormId: parentFormId, // Child field points to parent form for data
        targetFormName: parentFormName,
        displayColumns: parentFormColumns, // All parent form columns initially
        filters: [], // No filters by default
        enableSorting: true,
        enableSearch: true,
        pageSize: 10,
        isParentReference: false
      }
    };

    try {
      const newField = await addField(targetFormId, childFieldData);
      
      if (newField) {
        // Update target form's pages to include the new field at the end of the first page
        if (targetForm.pages && targetForm.pages.length > 0) {
          const updatedPages = targetForm.pages.map(page => 
            page.id === targetPageId 
              ? { ...page, fields: [...(page.fields || []), newField.id] }
              : page
          );
          
          try {
            await updateForm(targetFormId, { pages: updatedPages });
          } catch {
            // Field was created even if pages couldn't be updated
          }
        }
        
        return newField;
      }
    } catch (error) {
      throw error;
    }
  }, [forms, addField, updateForm]);

  const removeChildCrossReferenceField = useCallback(async (options: { parentFormId: string; parentFieldId: string; targetFormId: string }) => {
    const { parentFormId, parentFieldId, targetFormId } = options;
    
    // Fetch directly from database to get fresh data instead of relying on cached forms
    const { data: childFields, error: fetchError } = await supabase
      .from('form_fields')
      .select('id, custom_config')
      .eq('form_id', targetFormId)
      .eq('field_type', 'child-cross-reference');
    
    if (fetchError) {
      return;
    }

    // Find the child field that matches our parent
    const existingChildField = childFields?.find(field => {
      const config = typeof field.custom_config === 'string' 
        ? JSON.parse(field.custom_config) 
        : field.custom_config;
      return config?.parentFormId === parentFormId && config?.parentFieldId === parentFieldId;
    });

    if (existingChildField) {
      try {
        await deleteField(existingChildField.id);
        
        // Fetch target form's pages and update them
        const { data: targetFormData } = await supabase
          .from('forms')
          .select('pages')
          .eq('id', targetFormId)
          .single();
        
        if (targetFormData?.pages) {
          const pages = typeof targetFormData.pages === 'string' 
            ? JSON.parse(targetFormData.pages) 
            : targetFormData.pages;
          
          if (Array.isArray(pages) && pages.length > 0) {
            const updatedPages = pages.map((page: any) => ({
              ...page,
              fields: (page.fields || []).filter((fieldId: string) => fieldId !== existingChildField.id)
            }));
            
            try {
              await updateForm(targetFormId, { pages: updatedPages });
            } catch {
              // Field was removed even if pages couldn't be updated
            }
          }
        }
      } catch (error) {
        throw error;
      }
    }
  }, [deleteField, updateForm]);

  const syncCrossReferenceField = useCallback(async (options: CrossReferenceSyncOptions) => {
    const { targetFormId, previousTargetFormId } = options;

    try {
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
    } catch (error) {
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
