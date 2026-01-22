
import { useState, useEffect, useCallback, useMemo } from 'react';
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

  const createForm = useCallback(async (formData: Omit<Form, 'id' | 'createdAt' | 'updatedAt' | 'fields'>) => {
    if (!currentProject) {
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
  }, [currentProject, createFormMutation, userProfile, setForms]);

  const updateForm = useCallback(async (id: string, updates: Partial<Form>) => {
    const currentForm = forms.find(f => f.id === id);
    await updateFormMutation(id, updates, userProfile, currentForm?.name);
    setForms(prev =>
      prev.map(form =>
        form.id === id
          ? { ...form, ...updates, updatedAt: new Date().toISOString() }
          : form
      )
    );
  }, [forms, updateFormMutation, userProfile, setForms]);

  const deleteForm = useCallback(async (id: string) => {
    const currentForm = forms.find(f => f.id === id);
    await deleteFormMutation(id, userProfile, currentForm?.name);
    setForms(prev => prev.filter(form => form.id !== id));
  }, [forms, deleteFormMutation, userProfile, setForms]);

  const addField = useCallback(async (formId: string, fieldData: Omit<FormField, 'id'> & { id?: string }) => {
    const form = forms.find(f => f.id === formId);
    const newField = await addFieldMutation(formId, fieldData, userProfile, form?.name);
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
  }, [forms, addFieldMutation, userProfile, setForms]);

  const updateField = useCallback(async (fieldId: string, updates: Partial<FormField>) => {
    const form = forms.find(f => f.fields.some(field => field.id === fieldId));
    const auditInfo = form && userProfile ? { userId: userProfile.id, formId: form.id, formName: form.name } : undefined;
    await updateFieldMutation(fieldId, updates, auditInfo);
    setForms(prev =>
      prev.map(form => ({
        ...form,
        fields: form.fields.map(field =>
          field.id === fieldId ? { ...field, ...updates } : field
        )
      }))
    );
  }, [forms, userProfile, updateFieldMutation, setForms]);

  const deleteField = useCallback(async (fieldId: string) => {
    const form = forms.find(f => f.fields.some(field => field.id === fieldId));
    const field = form?.fields.find(f => f.id === fieldId);
    const auditInfo = form && userProfile ? { userId: userProfile.id, formId: form.id, formName: form.name, fieldLabel: field?.label } : undefined;
    await deleteFieldMutation(fieldId, auditInfo);
    setForms(prev =>
      prev.map(form => ({
        ...form,
        fields: form.fields.filter(field => field.id !== fieldId)
      }))
    );
  }, [forms, userProfile, deleteFieldMutation, setForms]);

  const reorderFields = useCallback(async (formId: string, startIndex: number, endIndex: number) => {
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    const auditInfo = userProfile ? { userId: userProfile.id, formName: form.name } : undefined;
    const reorderedFields = await reorderFieldsMutation(formId, startIndex, endIndex, form.fields, auditInfo);
    setForms(prev =>
      prev.map(f =>
        f.id === formId ? { ...f, fields: reorderedFields } : f
      )
    );
  }, [forms, userProfile, reorderFieldsMutation, setForms]);

  const batchSaveFields = useCallback(async (formId: string, fields: FormField[], existingFieldIds: string[]) => {
    await batchUpdateFieldsMutation(formId, fields, new Set(existingFieldIds));
    setForms(prev =>
      prev.map(form =>
        form.id === formId
          ? { ...form, fields }
          : form
      )
    );
  }, [batchUpdateFieldsMutation, setForms]);

  const batchDeleteFields = useCallback(async (fieldIds: string[]) => {
    await batchDeleteFieldsMutation(fieldIds);
    setForms(prev =>
      prev.map(form => ({
        ...form,
        fields: form.fields.filter(field => !fieldIds.includes(field.id))
      }))
    );
  }, [batchDeleteFieldsMutation, setForms]);

  // Load forms when project changes
  useEffect(() => {
    if (currentProject?.id && userProfile?.organization_id && session) {
      loadForms(userProfile.organization_id, currentProject.id);
    } else {
      setForms([]);
    }
  }, [currentProject?.id, userProfile?.organization_id, session]);

  const refreshForms = useCallback(() => {
    if (currentProject?.id && userProfile?.organization_id) {
      loadForms(userProfile.organization_id, currentProject.id);
    }
  }, [currentProject?.id, userProfile?.organization_id, loadForms]);

  return useMemo(() => ({
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
    loadForms: refreshForms,
  }), [
    forms, loading, createForm, updateForm, deleteForm, 
    addField, updateField, deleteField, reorderFields, 
    batchSaveFields, batchDeleteFields, refreshForms
  ]);
}
