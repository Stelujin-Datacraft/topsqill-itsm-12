
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FormAccessRequest {
  id: string;
  form_id: string;
  user_id: string;
  message?: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  user_profile?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export function useFormAccessNotifications(formId: string) {
  const [pendingRequests, setPendingRequests] = useState<FormAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const loadPendingRequests = async () => {
    if (!formId || !userProfile?.id) {
      setLoading(false);
      return;
    }

    try {
      // Check if user is form creator to show notifications
      const { data: formData } = await supabase
        .from('forms')
        .select('created_by')
        .eq('id', formId)
        .single();

      if (!formData || formData.created_by !== userProfile.id) {
        setLoading(false);
        return;
      }

      // Load pending access requests with user profiles
      const { data: requestsData, error: requestsError } = await supabase
        .from('form_access_requests')
        .select('*')
        .eq('form_id', formId)
        .eq('status', 'pending');

      if (requestsError) {
        console.error('Error loading access requests:', requestsError);
        setLoading(false);
        return;
      }

      if (requestsData && requestsData.length > 0) {
        // Get user profiles for requests
        const userIds = requestsData.map(req => req.user_id);
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name')
          .in('id', userIds);

        const requestsWithProfiles = requestsData.map(req => ({
          ...req,
          status: req.status as 'pending' | 'approved' | 'denied',
          user_profile: profilesData?.find(p => p.id === req.user_id)
        }));

        setPendingRequests(requestsWithProfiles);
      } else {
        setPendingRequests([]);
      }
    } catch (error) {
      console.error('Error loading pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingRequests();

    // Set up real-time subscription for form access requests
    const channel = supabase
      .channel(`form-access-requests-${formId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_access_requests',
          filter: `form_id=eq.${formId}`
        },
        () => {
          loadPendingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [formId, userProfile?.id]);

  return { pendingRequests, loading, loadPendingRequests };
}
