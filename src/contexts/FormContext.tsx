import React, { createContext, useState, useContext, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Form } from '@/types/form';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from './ProjectContext';
import { logFormAuditEvent } from '@/utils/formAuditLogger';

interface FormContextType {
  forms: Form[];
  currentForm: Form | null;
  setCurrentForm: (form: Form | null) => void;
  createForm: (formData: Partial<Form>) => Promise<Form | null>;
  updateForm: (formId: string, updates: Partial<Form>) => Promise<void>;
  deleteForm: (formId: string) => Promise<void>;
  duplicateForm: (formId: string) => Promise<Form | null>;
  getFormById: (formId: string) => Form | null;
  loading: boolean;
  error: string | null;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

interface FormProviderProps {
  children: React.ReactNode;
}

const transformDatabaseFormToAppForm = (dbForm: any): Form => {
  return {
    id: dbForm.id,
    name: dbForm.name,
    description: dbForm.description || '',
    organizationId: dbForm.organization_id || '',
    projectId: dbForm.project_id,
    status: dbForm.status,
    createdAt: dbForm.created_at,
    updatedAt: dbForm.updated_at,
    createdBy: dbForm.created_by,
    isPublic: dbForm.is_public || false,
    fields: [],
    permissions: typeof dbForm.permissions === 'string' 
      ? JSON.parse(dbForm.permissions || '{"view":[],"submit":[],"edit":[]}')
      : (dbForm.permissions || {
          view: [],
          submit: [],
          edit: [],
        }),
    fieldRules: dbForm.field_rules || [],
    formRules: dbForm.form_rules || [],
    shareSettings: dbForm.share_settings || {
      allowPublicAccess: false,
      sharedUsers: [],
    },
    layout: dbForm.layout || {
      columns: 1,
    },
    pages: dbForm.pages || [],
  };
};

const transformAppFormToDatabaseForm = (appForm: Partial<Form>) => {
  return {
    name: appForm.name,
    description: appForm.description,
    organization_id: appForm.organizationId,
    project_id: appForm.projectId,
    status: appForm.status,
    created_by: appForm.createdBy,
    is_public: appForm.isPublic,
    permissions: JSON.stringify(appForm.permissions),
    field_rules: JSON.stringify(appForm.fieldRules),
    form_rules: JSON.stringify(appForm.formRules),
    share_settings: JSON.stringify(appForm.shareSettings),
    layout: JSON.stringify(appForm.layout),
    pages: JSON.stringify(appForm.pages),
  };
};

export const FormProvider: React.FC<FormProviderProps> = ({ children }) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [currentForm, setCurrentForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { currentProject } = useProject();

  useEffect(() => {
    if (currentProject) {
      fetchForms();
    }
  }, [currentProject]);

  const fetchForms = async () => {
    setLoading(true);
    try {
      if (!currentProject) {
        setForms([]);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setForms([]);
        return;
      }

      const [projectUserResult, userProfileResult] = await Promise.all([
        supabase
          .from('project_users')
          .select('role')
          .eq('project_id', currentProject.id)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
      ]);

      const isProjectAdmin = projectUserResult.data?.role === 'admin';
      const isOrgAdmin = userProfileResult.data?.role === 'admin';

      if (isProjectAdmin || isOrgAdmin) {
        const { data, error } = await supabase
          .from('forms')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('updated_at', { ascending: false });

        if (error) {
          setError(error.message);
        } else {
          setForms((data || []).map(transformDatabaseFormToAppForm));
        }
        return;
      }

      const [assetPermsResult, formAccessResult, formsResult] = await Promise.all([
        supabase
          .from('asset_permissions')
          .select('asset_id')
          .eq('project_id', currentProject.id)
          .eq('user_id', user.id)
          .eq('asset_type', 'form'),
        supabase
          .from('form_user_access')
          .select('form_id')
          .eq('user_id', user.id)
          .eq('status', 'active'),
        supabase
          .from('forms')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('updated_at', { ascending: false })
      ]);

      if (formsResult.error) {
        setError(formsResult.error.message);
        return;
      }

      const accessibleIds = new Set<string>();
      assetPermsResult.data?.forEach(p => accessibleIds.add(p.asset_id));
      formAccessResult.data?.forEach(f => accessibleIds.add(f.form_id));

      const filteredForms = (formsResult.data || []).filter(form => 
        form.created_by === user.id || 
        form.created_by === user.email ||
        form.is_public || 
        accessibleIds.has(form.id)
      );

      setForms(filteredForms.map(transformDatabaseFormToAppForm));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createForm = async (formData: Partial<Form>): Promise<Form | null> => {
    setLoading(true);
    setError(null);
    try {
      if (!currentProject) {
        throw new Error('No project selected');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const newFormData = {
        name: formData.name || 'Untitled Form',
        description: formData.description || '',
        organization_id: currentProject.organization_id || '',
        project_id: currentProject.id,
        status: 'draft' as const,
        created_by: user.id,
        is_public: false,
        permissions: JSON.stringify({
          view: [],
          submit: [],
          edit: [],
        }),
        field_rules: JSON.stringify(formData.fieldRules || []),
        form_rules: JSON.stringify(formData.formRules || []),
        share_settings: JSON.stringify({
          allowPublicAccess: false,
          sharedUsers: [],
        }),
        layout: JSON.stringify({
          columns: 1,
        }),
        pages: JSON.stringify(formData.pages || []),
      };

      const { data, error } = await supabase
        .from('forms')
        .insert([newFormData])
        .select()
        .single();

      if (error) {
        setError(error.message);
        return null;
      }

      const createdForm = transformDatabaseFormToAppForm(data);
      
      // Log audit event for form creation
      console.log('🔵 FormContext: Logging form_created event for:', createdForm.id, createdForm.name);
      await logFormAuditEvent({
        userId: user.id,
        eventType: 'form_created',
        formId: createdForm.id,
        formName: createdForm.name,
        description: `Created form "${createdForm.name}"`,
      });
      
      setForms([...forms, createdForm]);
      setCurrentForm(createdForm);
      return createdForm;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateForm = async (formId: string, updates: Partial<Form>): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const dbUpdates = transformAppFormToDatabaseForm(updates);
      
      const { error } = await supabase
        .from('forms')
        .update(dbUpdates)
        .eq('id', formId);

      if (error) {
        setError(error.message);
      } else {
        setForms(forms.map(form => (form.id === formId ? { ...form, ...updates } : form)));
        setCurrentForm(prevForm => prevForm?.id === formId ? { ...prevForm, ...updates } : prevForm);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteForm = async (formId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', formId);

      if (error) {
        setError(error.message);
      } else {
        setForms(forms.filter(form => form.id !== formId));
        setCurrentForm(prevForm => prevForm?.id === formId ? null : prevForm);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const duplicateForm = async (formId: string): Promise<Form | null> => {
    setLoading(true);
    setError(null);
    try {
      const originalForm = forms.find(form => form.id === formId);
      if (!originalForm) {
        throw new Error('Form not found');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const duplicateData = {
        ...transformAppFormToDatabaseForm(originalForm),
        name: `${originalForm.name} Copy`,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('forms')
        .insert([duplicateData])
        .select()
        .single();

      if (error) {
        setError(error.message);
        return null;
      }

      const duplicatedForm = transformDatabaseFormToAppForm(data);
      setForms([...forms, duplicatedForm]);
      return duplicatedForm;
    } catch (error: any) {
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getFormById = (formId: string): Form | null => {
    return forms.find(form => form.id === formId) || null;
  };

  const value: FormContextType = {
    forms,
    currentForm,
    setCurrentForm,
    createForm,
    updateForm,
    deleteForm,
    duplicateForm,
    getFormById,
    loading,
    error,
  };

  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  );
};

export const useForm = () => {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error('useForm must be used within a FormProvider');
  }
  return context;
};
