
import { useState, useEffect } from 'react';
import { Form, FormField } from '@/types/form';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useFormsLoader } from './useFormsLoader';
import { useFormMutations } from './useFormMutations';
import { useFieldMutations } from './useFieldMutations';

export function useFormsData() {
  const { userProfile, session } = useAuth();
  const { currentProject } = useProject();
  const { forms, setForms, loading, loadForms } = useFormsLoader();
  const { createForm: createFormMutation, updateForm: updateFormMutation, deleteForm: deleteFormMutation } = useFormMutations();
  const { 
    addField: addFieldMutation, 
    updateField: updateFieldMutation, 
    deleteField: deleteFieldMutation, 
    reorderFields: reorderFieldsMutation,
    batchUpdateFields: batchUpdateFieldsMutation,
    batchDeleteFields: batchDeleteFieldsMutation
  } = useFieldMutations();

  const createForm = async (formData: Omit<Form, 'id' | 'createdAt' | 'updatedAt' | 'fields'>) => {
    if (!currentProject) {
      console.error('No current project selected');
      return null;
    }

    const newForm = await createFormMutation({
      ...formData,
      projectId: currentProject.id
    }, userProfile);
    
    if (newForm) {
      setForms(prev => [newForm, ...prev]);
    }
    return newForm;
  };

  const updateForm = async (id: string, updates: Partial<Form>) => {
    await updateFormMutation(id, updates);
    setForms(prev =>
      prev.map(form =>
        form.id === id
          ? { ...form, ...updates, updatedAt: new Date().toISOString() }
          : form
      )
    );
  };

  const deleteForm = async (id: string) => {
    await deleteFormMutation(id);
    setForms(prev => prev.filter(form => form.id !== id));
  };

  const addField = async (formId: string, fieldData: Omit<FormField, 'id'> & { id?: string }) => {
    const newField = await addFieldMutation(formId, fieldData, userProfile);
    if (newField) {
      setForms(prev =>
        prev.map(form =>
          form.id === formId
            ? { ...form, fields: [...form.fields, newField] }
            : form
        )
      );
    }
    return newField;
  };

  const updateField = async (fieldId: string, updates: Partial<FormField>) => {
    await updateFieldMutation(fieldId, updates);
    setForms(prev =>
      prev.map(form => ({
        ...form,
        fields: form.fields.map(field =>
          field.id === fieldId ? { ...field, ...updates } : field
        )
      }))
    );
  };

  const deleteField = async (fieldId: string) => {
    await deleteFieldMutation(fieldId);
    setForms(prev =>
      prev.map(form => ({
        ...form,
        fields: form.fields.filter(field => field.id !== fieldId)
      }))
    );
  };

  const reorderFields = async (formId: string, startIndex: number, endIndex: number) => {
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    const reorderedFields = await reorderFieldsMutation(formId, startIndex, endIndex, form.fields);
    setForms(prev =>
      prev.map(f =>
        f.id === formId ? { ...f, fields: reorderedFields } : f
      )
    );
  };

  // Batch save all fields at once (for optimized save)
  const batchSaveFields = async (formId: string, fields: FormField[], existingFieldIds: string[]) => {
    await batchUpdateFieldsMutation(formId, fields, new Set(existingFieldIds));
    setForms(prev =>
      prev.map(form =>
        form.id === formId
          ? { ...form, fields }
          : form
      )
    );
  };

  // Batch delete multiple fields at once
  const batchDeleteFields = async (fieldIds: string[]) => {
    await batchDeleteFieldsMutation(fieldIds);
    setForms(prev =>
      prev.map(form => ({
        ...form,
        fields: form.fields.filter(field => !fieldIds.includes(field.id))
      }))
    );
  };

  // Load forms when project changes
  useEffect(() => {
    if (currentProject?.id && userProfile?.organization_id && session) {
      loadForms(userProfile.organization_id, currentProject.id);
    } else {
      setForms([]);
    }
  }, [currentProject?.id, userProfile?.organization_id, session]);

  return {
    forms,
    loading,
    createForm,
    updateForm,
    deleteForm,
    addField,
    updateField,
    deleteField,
    reorderFields,
    batchSaveFields,
    batchDeleteFields,
    loadForms: () => currentProject?.id && userProfile?.organization_id && loadForms(userProfile.organization_id, currentProject.id),
  };
}
