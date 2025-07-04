
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface FormUserAccess {
  id: string;
  form_id: string;
  user_id: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'active' | 'pending' | 'blocked';
  granted_by?: string;
  granted_at?: string;
  user_profile?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface FormAccessRequest {
  id: string;
  form_id: string;
  user_id: string;
  message?: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  user_profile?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export function useFormAccess(formId: string) {
  const [users, setUsers] = useState<FormUserAccess[]>([]);
  const [accessRequests, setAccessRequests] = useState<FormAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const loadFormAccess = async () => {
    if (!formId) return;

    try {
      setLoading(true);

      // Load form user access with manual join
      const { data: accessData, error: accessError } = await supabase
        .from('form_user_access')
        .select('*')
        .eq('form_id', formId);

      if (accessError) {
        console.error('Error loading form access:', accessError);
      } else {
        // Get user profiles for the access data
        const userIds = accessData?.map(item => item.user_id) || [];
        
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('user_profiles')
            .select('id, email, first_name, last_name')
            .in('id', userIds);

          // Combine access data with profiles
          const transformedUsers = (accessData || []).map(item => ({
            ...item,
            role: item.role as 'viewer' | 'editor' | 'admin',
            status: item.status as 'active' | 'pending' | 'blocked',
            user_profile: profilesData?.find(p => p.id === item.user_id)
          }));
          setUsers(transformedUsers);
        } else {
          setUsers([]);
        }
      }

      // Load access requests with manual join
      const { data: requestsData, error: requestsError } = await supabase
        .from('form_access_requests')
        .select('*')
        .eq('form_id', formId);

      if (requestsError) {
        console.error('Error loading access requests:', requestsError);
      } else {
        // Get user profiles for the requests data
        const requestUserIds = requestsData?.map(item => item.user_id) || [];
        
        if (requestUserIds.length > 0) {
          const { data: requestProfilesData } = await supabase
            .from('user_profiles')
            .select('id, email, first_name, last_name')
            .in('id', requestUserIds);

          // Combine request data with profiles
          const transformedRequests = (requestsData || []).map(item => ({
            ...item,
            status: item.status as 'pending' | 'approved' | 'denied',
            user_profile: requestProfilesData?.find(p => p.id === item.user_id)
          }));
          setAccessRequests(transformedRequests);
        } else {
          setAccessRequests([]);
        }
      }
    } catch (error) {
      console.error('Error loading form access data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addUserAccess = async (userId: string, role: 'viewer' | 'editor' | 'admin') => {
    try {
      const { error } = await supabase
        .from('form_user_access')
        .insert({
          form_id: formId,
          user_id: userId,
          role,
          status: 'active',
          granted_by: userProfile?.id
        });

      if (error) throw error;

      toast({
        title: "User access granted",
        description: "User has been given access to the form.",
      });

      loadFormAccess();
    } catch (error) {
      console.error('Error adding user access:', error);
      toast({
        title: "Error",
        description: "Failed to grant user access.",
        variant: "destructive",
      });
    }
  };

  const updateUserAccess = async (accessId: string, updates: Partial<FormUserAccess>) => {
    try {
      const { error } = await supabase
        .from('form_user_access')
        .update(updates)
        .eq('id', accessId);

      if (error) throw error;

      toast({
        title: "Access updated",
        description: "User access has been updated.",
      });

      loadFormAccess();
    } catch (error) {
      console.error('Error updating user access:', error);
      toast({
        title: "Error",
        description: "Failed to update user access.",
        variant: "destructive",
      });
    }
  };

  const removeUserAccess = async (accessId: string) => {
    try {
      const { error } = await supabase
        .from('form_user_access')
        .delete()
        .eq('id', accessId);

      if (error) throw error;

      toast({
        title: "Access removed",
        description: "User access has been removed.",
      });

      loadFormAccess();
    } catch (error) {
      console.error('Error removing user access:', error);
      toast({
        title: "Error",
        description: "Failed to remove user access.",
        variant: "destructive",
      });
    }
  };

  const requestAccess = async (message?: string) => {
    if (!userProfile?.id) return;

    try {
      const { error } = await supabase
        .from('form_access_requests')
        .insert({
          form_id: formId,
          user_id: userProfile.id,
          message
        });

      if (error) throw error;

      toast({
        title: "Access requested",
        description: "Your access request has been submitted.",
      });

      return true;
    } catch (error) {
      console.error('Error requesting access:', error);
      toast({
        title: "Error",
        description: "Failed to submit access request.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleAccessRequest = async (requestId: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('form_access_requests')
        .update({
          status: approve ? 'approved' : 'denied',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userProfile?.id
        })
        .eq('id', requestId);

      if (error) throw error;

      // If approved, add user access
      if (approve) {
        const request = accessRequests.find(r => r.id === requestId);
        if (request) {
          await addUserAccess(request.user_id, 'viewer');
        }
      }

      toast({
        title: approve ? "Request approved" : "Request denied",
        description: `Access request has been ${approve ? 'approved' : 'denied'}.`,
      });

      loadFormAccess();
    } catch (error) {
      console.error('Error handling access request:', error);
      toast({
        title: "Error",
        description: "Failed to handle access request.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadFormAccess();
  }, [formId]);

  return {
    users,
    accessRequests,
    loading,
    addUserAccess,
    updateUserAccess,
    removeUserAccess,
    requestAccess,
    handleAccessRequest,
    loadFormAccess
  };
}
