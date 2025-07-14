
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FormUserAccess {
  id: string;
  form_id: string;
  user_id: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'active' | 'pending' | 'blocked';
  granted_by?: string;
  granted_at?: string;
}

export function useFormUserAccess(formId: string) {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [accessRole, setAccessRole] = useState<string | null>(null);
  const { userProfile } = useAuth();

  useEffect(() => {
    const checkFormAccess = async () => {
      if (!formId || !userProfile?.id) {
        setLoading(false);
        setHasAccess(false);
        return;
      }

      try {
        console.log('🔍 [FORM ACCESS] Checking form access for user:', userProfile.id, 'form:', formId);

        // Check if user has direct access to this form
        const { data: accessData, error } = await supabase
          .from('form_user_access')
          .select('*')
          .eq('form_id', formId)
          .eq('user_id', userProfile.id)
          .eq('status', 'active')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('❌ [FORM ACCESS] Error checking form access:', error);
          setHasAccess(false);
          setAccessRole(null);
        } else if (accessData) {
          console.log('✅ [FORM ACCESS] User has direct access:', accessData);
          setHasAccess(true);
          setAccessRole(accessData.role);
        } else {
          console.log('❌ [FORM ACCESS] No direct access found for user');
          setHasAccess(false);
          setAccessRole(null);
        }
      } catch (error) {
        console.error('❌ [FORM ACCESS] Unexpected error:', error);
        setHasAccess(false);
        setAccessRole(null);
      } finally {
        setLoading(false);
      }
    };

    checkFormAccess();
  }, [formId, userProfile?.id]);

  return { hasAccess, loading, accessRole };
}
