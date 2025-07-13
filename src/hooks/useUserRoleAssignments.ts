
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserRoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by: string;
  roles: {
    name: string;
    description: string;
    role_permissions: Array<{
      resource_type: string;
      resource_id: string;
      permission_type: string;
    }>;
  };
}

export function useUserRoleAssignments(userId?: string) {
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const targetUserId = userId || userProfile?.id;

  const loadAssignments = async () => {
    try {
      let query = supabase
        .from('user_role_assignments')
        .select(`
          *,
          roles!inner(
            name,
            description,
            role_permissions(
              resource_type,
              resource_id,
              permission_type
            )
          )
        `);

      // If a specific userId is provided, filter by it
      // Otherwise, load all assignments (for admin views)
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading user role assignments:', error);
        return;
      }

      setAssignments(data || []);
    } catch (error) {
      console.error('Error in loadAssignments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [targetUserId]);

  return {
    assignments,
    loading,
    refetch: loadAssignments
  };
}
