
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';

interface AccessibleForm {
  id: string;
  name: string;
  description: string;
  status: string;
  created_by: string;
}

export function useFormAccess() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const [accessibleForms, setAccessibleForms] = useState<AccessibleForm[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentProject && userProfile) {
      loadAccessibleForms();
    }
  }, [currentProject?.id, userProfile?.id]);

  const loadAccessibleForms = async () => {
    if (!currentProject || !userProfile) return;

    setLoading(true);
    try {
      // Query forms that the user has access to
      const { data: forms, error } = await supabase
        .from('forms')
        .select('id, name, description, status, created_by')
        .eq('project_id', currentProject.id)
        .eq('status', 'active'); // Only show active forms

      if (error) throw error;

      // Filter forms based on user permissions
      const filteredForms = forms?.filter(form => {
        // User can access if they're the creator, project admin, or have explicit access
        return (
          form.created_by === userProfile.email ||
          userProfile.role === 'admin' ||
          // Additional permission checks can be added here
          true // For now, allow access to all forms in the project
        );
      }) || [];

      setAccessibleForms(filteredForms);
    } catch (error) {
      console.error('Error loading accessible forms:', error);
      setAccessibleForms([]);
    } finally {
      setLoading(false);
    }
  };

  const canAccessForm = useMemo(() => {
    return (formId: string) => {
      return accessibleForms.some(form => form.id === formId);
    };
  }, [accessibleForms]);

  const getFormOptions = useMemo(() => {
    return accessibleForms.map(form => ({
      value: form.id,
      label: form.name,
      description: form.description,
    }));
  }, [accessibleForms]);

  return {
    accessibleForms,
    loading,
    canAccessForm,
    getFormOptions,
    refetch: loadAccessibleForms,
  };
}
