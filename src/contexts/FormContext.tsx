import React, { createContext, useState, useContext, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Form } from '@/types/form';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from './ProjectContext';

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

// Helper function to transform database form to app form
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

// Helper function to transform app form to database form
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

      // Get current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('FormContext: No authenticated user');
        setForms([]);
        return;
      }

      console.log('FormContext: Current user ID:', user.id);

      // First, get the user's role in the project
      const { data: projectUser, error: projectUserError } = await supabase
        .from('project_users')
        .select('role')
        .eq('project_id', currentProject.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (projectUserError) {
        console.log('FormContext: Error getting project user role:', projectUserError);
        // Continue without role - user might still have access to some forms
      }

      console.log('FormContext: User project role:', projectUser?.role || 'no role');

      // Start with base query
      let formsQuery = supabase
        .from('forms')
        .select('*')
        .eq('project_id', currentProject.id);

      // If user is project admin, they can see all forms
      if (projectUser && projectUser.role === 'admin') {
        console.log('FormContext: User is project admin, loading all forms');
      } else {
        console.log('FormContext: User is not project admin, applying filters');
        
        // Get forms where user has explicit asset permissions
        const { data: accessibleFormIds, error: permissionsError } = await supabase
          .from('asset_permissions')
          .select('asset_id')
          .eq('project_id', currentProject.id)
          .eq('user_id', user.id)
          .eq('asset_type', 'form');

        if (permissionsError) {
          console.log('FormContext: Error getting asset permissions:', permissionsError);
        }

        const formIdsWithAssetAccess = accessibleFormIds?.map(p => p.asset_id) || [];
        console.log('FormContext: Forms with explicit asset access:', formIdsWithAssetAccess);
        
        // Get forms where user has direct form access through form_user_access
        const { data: formUserAccess, error: formAccessError } = await supabase
          .from('form_user_access')
          .select('form_id')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (formAccessError) {
          console.log('FormContext: Error getting form user access:', formAccessError);
        }

        const formIdsWithDirectAccess = formUserAccess?.map(f => f.form_id) || [];
        console.log('FormContext: Forms with direct user access:', formIdsWithDirectAccess);
        
        // Get public forms
        const { data: publicForms, error: publicFormsError } = await supabase
          .from('forms')
          .select('id')
          .eq('project_id', currentProject.id)
          .eq('is_public', true);

        if (publicFormsError) {
          console.log('FormContext: Error getting public forms:', publicFormsError);
        }

        const publicFormIds = publicForms?.map(f => f.id) || [];
        console.log('FormContext: Public forms:', publicFormIds);

        // Combine all accessible form IDs
        const allAccessibleFormIds = [
          ...formIdsWithAssetAccess,
          ...formIdsWithDirectAccess,
          ...publicFormIds
        ];

        console.log('FormContext: All accessible form IDs:', allAccessibleFormIds);

        // Build the final query - forms created by user OR forms with access OR public forms
        if (allAccessibleFormIds.length > 0) {
          // User created forms OR forms with explicit access OR public forms
          formsQuery = formsQuery.or(`created_by.eq.${user.id},id.in.(${allAccessibleFormIds.join(',')})`);
        } else {
          // Only forms created by the user
          formsQuery = formsQuery.eq('created_by', user.id);
        }
      }

      const { data, error } = await formsQuery.order('created_at', { ascending: false });

      if (error) {
        console.error('FormContext: Error loading forms:', error);
        setError(error.message);
      } else {
        const transformedForms = (data || []).map(transformDatabaseFormToAppForm);
        console.log('FormContext: Loaded forms successfully:', transformedForms.length, 'forms');
        console.log('FormContext: Loaded forms:', transformedForms.map(f => ({ 
          id: f.id, 
          name: f.name, 
          createdBy: f.createdBy,
          isPublic: f.isPublic 
        })));
        setForms(transformedForms);
      }
    } catch (err: any) {
      console.error('FormContext: Unexpected error:', err);
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

      // Get current user's ID for created_by field
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
        created_by: user.id, // Use user.id instead of email
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

      console.log('FormContext: Creating form with data:', newFormData);

      const { data, error } = await supabase
        .from('forms')
        .insert([newFormData])
        .select()
        .single();

      if (error) {
        console.error('FormContext: Error creating form:', error);
        setError(error.message);
        return null;
      }

      const createdForm = transformDatabaseFormToAppForm(data);
      setForms([...forms, createdForm]);
      setCurrentForm(createdForm);
      return createdForm;
    } catch (err: any) {
      console.error('FormContext: Unexpected error creating form:', err);
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
        // Optimistically update the form in the local state
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
        // Optimistically update the form in the local state
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

      // Get current user's ID for created_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const duplicateData = {
        ...transformAppFormToDatabaseForm(originalForm),
        name: `${originalForm.name} Copy`,
        created_by: user.id, // Use user.id instead of email
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
