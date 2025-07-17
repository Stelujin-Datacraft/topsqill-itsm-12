import { useMemo } from 'react';
import { useForm } from '@/contexts/FormContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { Form } from '@/types/form';

export function useAccessibleForms() {
  const { forms, loading: formsLoading } = useForm();
  const { userProfile } = useAuth();
  const { hasPermission, loading: unifiedLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();
  
  const loading = formsLoading || unifiedLoading;

  const accessibleForms = useMemo(() => {
    if (!userProfile || !currentProject || loading) {
      return [];
    }

    return forms.filter((form: Form) => {
      // Admin users can see all forms
      if (userProfile.role === 'admin') {
        return true;
      }

      // Form creators can see their own forms
      if (form.createdBy === userProfile.id) {
        return true;
      }

      // Check unified access control permissions
      const canReadForms = hasPermission('forms', 'read');
      const canUpdateForm = hasPermission('forms', 'update', form.id);
      
      if (canReadForms || canUpdateForm) {
        return true;
      }

      // TODO: Check form-specific access matrix permissions
      // This would require querying the form access matrix for each form
      // For now, we'll be restrictive and only show forms where user has explicit permissions
      
      return false;
    });
  }, [forms, userProfile, currentProject, hasPermission, loading]);

  return {
    accessibleForms,
    loading
  };
}