import { useState, useCallback, useRef } from 'react';
import { Form, FormField, FormPage } from '@/types/form';
import { v4 as uuidv4 } from 'uuid';

export interface FormSnapshot {
  form: Form | null;
  isInitialized: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
  initializedFormId: string | null;
}

export function useFormSnapshot(initialForm: Form | null) {
  const [snapshot, setSnapshot] = useState<FormSnapshot>({
    form: initialForm,
    isInitialized: !!initialForm,
    isDirty: false,
    lastSaved: initialForm ? new Date() : null,
    initializedFormId: initialForm?.id || null,
  });

  const originalFormRef = useRef<Form | null>(initialForm);

  // Initialize snapshot from form
  const initializeSnapshot = useCallback((form: Form | null) => {
    originalFormRef.current = form;
    setSnapshot({
      form: form ? { ...form } : null,
      isInitialized: true,
      isDirty: false,
      lastSaved: form ? new Date() : null,
      initializedFormId: form?.id || null,
    });
  }, []);

  // Update form details
  const updateFormDetails = useCallback((updates: Partial<Form>) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      return {
        ...prev,
        form: { ...prev.form, ...updates },
        isDirty: true,
      };
    });
  }, []);

  // Add field to snapshot
  const addFieldToSnapshot = useCallback((field: Omit<FormField, 'id'>, pageId: string) => {
    const newField: FormField = {
      ...field,
      id: uuidv4(),
      pageId,
    };

    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const updatedPages = prev.form.pages.map(page => 
        page.id === pageId 
          ? { ...page, fields: [...page.fields, newField.id] }
          : page
      );

      return {
        ...prev,
        form: {
          ...prev.form,
          fields: [...prev.form.fields, newField],
          pages: updatedPages,
        },
        isDirty: true,
      };
    });

    return newField;
  }, []);

  // Update field in snapshot
  const updateFieldInSnapshot = useCallback((fieldId: string, updates: Partial<FormField>) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const updatedFields = prev.form.fields.map(field => {
        if (field.id === fieldId) {
          // Deep merge customConfig to preserve existing properties
          const mergedCustomConfig = updates.customConfig
            ? { ...field.customConfig, ...updates.customConfig }
            : field.customConfig;
          
          return { 
            ...field, 
            ...updates,
            customConfig: mergedCustomConfig
          };
        }
        return field;
      });

      return {
        ...prev,
        form: {
          ...prev.form,
          fields: updatedFields,
        },
        isDirty: true,
      };
    });
  }, []);

  // Delete field from snapshot
  const deleteFieldFromSnapshot = useCallback((fieldId: string) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const updatedFields = prev.form.fields.filter(f => f.id !== fieldId);
      const updatedPages = prev.form.pages.map(page => ({
        ...page,
        fields: page.fields.filter(fId => fId !== fieldId)
      }));

      return {
        ...prev,
        form: {
          ...prev.form,
          fields: updatedFields,
          pages: updatedPages,
        },
        isDirty: true,
      };
    });
  }, []);

  // Reorder fields in snapshot
  const reorderFieldsInSnapshot = useCallback((pageId: string, sourceIndex: number, destinationIndex: number) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const page = prev.form.pages.find(p => p.id === pageId);
      if (!page) return prev;

      // Get all fields for this page, maintaining the current order
      const pageFields = prev.form.fields
        .filter(field => field.pageId === pageId || page.fields.includes(field.id))
        .sort((a, b) => {
          // Get current index from the fields array to maintain order
          const aIndex = prev.form!.fields.findIndex(f => f.id === a.id);
          const bIndex = prev.form!.fields.findIndex(f => f.id === b.id);
          return aIndex - bIndex;
        });

      if (sourceIndex >= pageFields.length || destinationIndex >= pageFields.length) {
        return prev; // Invalid indices
      }

      // Perform the reordering
      const reorderedPageFields = [...pageFields];
      const [movedField] = reorderedPageFields.splice(sourceIndex, 1);
      reorderedPageFields.splice(destinationIndex, 0, movedField);

      // Update the main fields array with new order
      const otherFields = prev.form.fields.filter(field => 
        field.pageId !== pageId && !page.fields.includes(field.id)
      );

      // Combine other fields with reordered page fields, maintaining positions
      const updatedFields = [...otherFields];
      
      // Find where to insert the reordered fields (preserve original position block)
      const firstPageFieldIndex = prev.form.fields.findIndex(field => 
        field.pageId === pageId || page.fields.includes(field.id)
      );
      
      if (firstPageFieldIndex >= 0) {
        updatedFields.splice(firstPageFieldIndex, 0, ...reorderedPageFields);
      } else {
        updatedFields.push(...reorderedPageFields);
      }

      return {
        ...prev,
        form: {
          ...prev.form,
          fields: updatedFields,
        },
        isDirty: true,
      };
    });
  }, []);

  // Add page to snapshot
  const addPageToSnapshot = useCallback((page: FormPage) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      return {
        ...prev,
        form: {
          ...prev.form,
          pages: [...prev.form.pages, page],
        },
        isDirty: true,
      };
    });
  }, []);

  // Update page in snapshot
  const updatePageInSnapshot = useCallback((pageId: string, updates: Partial<FormPage>) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const updatedPages = prev.form.pages.map(page =>
        page.id === pageId ? { ...page, ...updates } : page
      );

      return {
        ...prev,
        form: {
          ...prev.form,
          pages: updatedPages,
        },
        isDirty: true,
      };
    });
  }, []);

  // Delete page from snapshot
  const deletePageFromSnapshot = useCallback((pageId: string) => {
    setSnapshot(prev => {
      if (!prev.form || prev.form.pages.length <= 1) return prev;
      
      const pageToDelete = prev.form.pages.find(p => p.id === pageId);
      if (!pageToDelete) return prev;

      const firstPage = prev.form.pages.find(p => p.id !== pageId);
      if (!firstPage) return prev;

      const updatedPages = prev.form.pages
        .filter(p => p.id !== pageId)
        .map(page => {
          if (page.id === firstPage.id) {
            return { ...page, fields: [...page.fields, ...pageToDelete.fields] };
          }
          return page;
        });

      const updatedFields = prev.form.fields.map(field =>
        pageToDelete.fields.includes(field.id)
          ? { ...field, pageId: firstPage.id }
          : field
      );

      return {
        ...prev,
        form: {
          ...prev.form,
          pages: updatedPages,
          fields: updatedFields,
        },
        isDirty: true,
      };
    });
  }, []);

  // Mark as saved (after successful save to DB)
  const markAsSaved = useCallback(() => {
    setSnapshot(prev => ({
      ...prev,
      isDirty: false,
      lastSaved: new Date(),
    }));
    originalFormRef.current = snapshot.form;
  }, [snapshot.form]);

  // Reset to original (discard changes)
  const resetSnapshot = useCallback(() => {
    setSnapshot({
      form: originalFormRef.current ? { ...originalFormRef.current } : null,
      isInitialized: !!originalFormRef.current,
      isDirty: false,
      lastSaved: originalFormRef.current ? new Date() : null,
      initializedFormId: originalFormRef.current?.id || null,
    });
  }, []);

  return {
    snapshot,
    initializeSnapshot,
    updateFormDetails,
    addFieldToSnapshot,
    updateFieldInSnapshot,
    deleteFieldFromSnapshot,
    reorderFieldsInSnapshot,
    addPageToSnapshot,
    updatePageInSnapshot,
    deletePageFromSnapshot,
    markAsSaved,
    resetSnapshot,
  };
}