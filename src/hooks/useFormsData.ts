
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
    // Find the current form to get its name for audit logging
    const currentForm = forms.find(f => f.id === id);
    await updateFormMutation(id, updates, userProfile, currentForm?.name);
    setForms(prev =>
      prev.map(form =>
        form.id === id
          ? { ...form, ...updates, updatedAt: new Date().toISOString() }
          : form
      )
    );
  };

  const deleteForm = async (id: string) => {
    // Find the current form to get its name for audit logging
    const currentForm = forms.find(f => f.id === id);
    await deleteFormMutation(id, userProfile, currentForm?.name);
    setForms(prev => prev.filter(form => form.id !== id));
  };

  const addField = async (formId: string, fieldData: Omit<FormField, 'id'> & { id?: string }) => {
    // Find the form to get its name for audit logging
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
  };

  const updateField = async (fieldId: string, updates: Partial<FormField>) => {
    // Find the form that contains this field for audit logging
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
  };

  const deleteField = async (fieldId: string) => {
    // Find the form and field for audit logging
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
  };

  const reorderFields = async (formId: string, startIndex: number, endIndex: number) => {
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    // Pass audit info for reorder logging
    const auditInfo = userProfile ? { userId: userProfile.id, formName: form.name } : undefined;
    const reorderedFields = await reorderFieldsMutation(formId, startIndex, endIndex, form.fields, auditInfo);
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
