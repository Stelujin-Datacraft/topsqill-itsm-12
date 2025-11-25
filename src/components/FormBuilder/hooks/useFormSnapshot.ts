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

const LOCAL_STORAGE_PREFIX = 'form-draft-';

export function useFormSnapshot(initialForm: Form | null) {
  const [snapshot, setSnapshot] = useState<FormSnapshot>({
    form: initialForm,
    isInitialized: !!initialForm,
    isDirty: false,
    lastSaved: initialForm ? new Date() : null,
    initializedFormId: initialForm?.id || null,
  });

  const originalFormRef = useRef<Form | null>(initialForm);

  // Local storage utilities
  const saveToLocalStorage = useCallback((formData: Form) => {
    if (!formData.id) return;
    
    try {
      const storageKey = `${LOCAL_STORAGE_PREFIX}${formData.id}`;
      const dataToStore = {
        form: formData,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToStore));
      console.log('💾 Form draft saved to local storage:', storageKey);
    } catch (error) {
      console.error('❌ Failed to save form to local storage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((formId: string): Form | null => {
    try {
      const storageKey = `${LOCAL_STORAGE_PREFIX}${formId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const { form, timestamp } = JSON.parse(stored);
        console.log('📂 Loaded form draft from local storage:', storageKey, 'saved at:', timestamp);
        return form;
      }
    } catch (error) {
      console.error('❌ Failed to load form from local storage:', error);
    }
    return null;
  }, []);

  const clearLocalStorage = useCallback((formId: string) => {
    try {
      const storageKey = `${LOCAL_STORAGE_PREFIX}${formId}`;
      localStorage.removeItem(storageKey);
      console.log('🗑️ Cleared form draft from local storage:', storageKey);
    } catch (error) {
      console.error('❌ Failed to clear form from local storage:', error);
    }
  }, []);

  // Initialize snapshot from form
  const initializeSnapshot = useCallback((form: Form | null) => {
    // Try to load from local storage first if form has an ID
    let formToUse = form;
    if (form?.id) {
      const draftForm = loadFromLocalStorage(form.id);
      if (draftForm) {
        formToUse = draftForm;
        console.log('✅ Initialized form from local storage draft');
      }
    }
    
    originalFormRef.current = form; // Keep original for reset
    setSnapshot({
      form: formToUse ? { ...formToUse } : null,
      isInitialized: true,
      isDirty: formToUse !== form, // Mark dirty if we loaded from localStorage
      lastSaved: form ? new Date() : null,
      initializedFormId: form?.id || null,
    });
  }, [loadFromLocalStorage]);

  // Update form details
  const updateFormDetails = useCallback((updates: Partial<Form>) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const updatedForm = { ...prev.form, ...updates };
      saveToLocalStorage(updatedForm);
      
      return {
        ...prev,
        form: updatedForm,
        isDirty: true,
      };
    });
  }, [saveToLocalStorage]);

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

      const updatedForm = {
        ...prev.form,
        fields: [...prev.form.fields, newField],
        pages: updatedPages,
      };

      saveToLocalStorage(updatedForm);

      return {
        ...prev,
        form: updatedForm,
        isDirty: true,
      };
    });

    return newField;
  }, [saveToLocalStorage]);

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

      const updatedForm = {
        ...prev.form,
        fields: updatedFields,
      };

      saveToLocalStorage(updatedForm);

      return {
        ...prev,
        form: updatedForm,
        isDirty: true,
      };
    });
  }, [saveToLocalStorage]);

  // Delete field from snapshot
  const deleteFieldFromSnapshot = useCallback((fieldId: string) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const updatedFields = prev.form.fields.filter(f => f.id !== fieldId);
      const updatedPages = prev.form.pages.map(page => ({
        ...page,
        fields: page.fields.filter(fId => fId !== fieldId)
      }));

      const updatedForm = {
        ...prev.form,
        fields: updatedFields,
        pages: updatedPages,
      };

      saveToLocalStorage(updatedForm);

      return {
        ...prev,
        form: updatedForm,
        isDirty: true,
      };
    });
  }, [saveToLocalStorage]);

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

      const updatedForm = {
        ...prev.form,
        fields: updatedFields,
      };

      saveToLocalStorage(updatedForm);

      return {
        ...prev,
        form: updatedForm,
        isDirty: true,
      };
    });
  }, [saveToLocalStorage]);

  // Add page to snapshot
  const addPageToSnapshot = useCallback((page: FormPage) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const updatedForm = {
        ...prev.form,
        pages: [...prev.form.pages, page],
      };

      saveToLocalStorage(updatedForm);

      return {
        ...prev,
        form: updatedForm,
        isDirty: true,
      };
    });
  }, [saveToLocalStorage]);

  // Update page in snapshot
  const updatePageInSnapshot = useCallback((pageId: string, updates: Partial<FormPage>) => {
    setSnapshot(prev => {
      if (!prev.form) return prev;
      
      const updatedPages = prev.form.pages.map(page =>
        page.id === pageId ? { ...page, ...updates } : page
      );

      const updatedForm = {
        ...prev.form,
        pages: updatedPages,
      };

      saveToLocalStorage(updatedForm);

      return {
        ...prev,
        form: updatedForm,
        isDirty: true,
      };
    });
  }, [saveToLocalStorage]);

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

      const updatedForm = {
        ...prev.form,
        pages: updatedPages,
        fields: updatedFields,
      };

      saveToLocalStorage(updatedForm);

      return {
        ...prev,
        form: updatedForm,
        isDirty: true,
      };
    });
  }, [saveToLocalStorage]);

  // Mark as saved (after successful save to DB)
  const markAsSaved = useCallback(() => {
    setSnapshot(prev => {
      // Clear local storage when successfully saved to database
      if (prev.form?.id) {
        clearLocalStorage(prev.form.id);
      }
      
      return {
        ...prev,
        isDirty: false,
        lastSaved: new Date(),
      };
    });
    originalFormRef.current = snapshot.form;
  }, [snapshot.form, clearLocalStorage]);

  // Reset to original (discard changes)
  const resetSnapshot = useCallback(() => {
    // Clear local storage when resetting
    if (originalFormRef.current?.id) {
      clearLocalStorage(originalFormRef.current.id);
    }
    
    setSnapshot({
      form: originalFormRef.current ? { ...originalFormRef.current } : null,
      isInitialized: !!originalFormRef.current,
      isDirty: false,
      lastSaved: originalFormRef.current ? new Date() : null,
      initializedFormId: originalFormRef.current?.id || null,
    });
  }, [clearLocalStorage]);

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
    clearLocalStorage,
  };
}
