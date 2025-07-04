
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FormAssignment {
  id: string;
  form_id: string;
  assigned_to_user_id: string | null;
  assigned_to_email: string | null;
  assigned_by_user_id: string | null;
  assignment_type: string;
  workflow_execution_id: string | null;
  status: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  forms: {
    id: string;
    name: string;
    description: string | null;
    status: string;
  } | null;
  user_profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export function useFormAssignments() {
  const [assignments, setAssignments] = useState<FormAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const loadAssignments = async () => {
    if (!userProfile?.id && !userProfile?.email) {
      console.log('No user profile available for loading assignments');
      setAssignments([]);
      setLoading(false);
      return;
    }

    try {
      console.log('Loading form assignments for user:', { 
        userId: userProfile.id, 
        email: userProfile.email 
      });

      // Build the query to find assignments either by user ID or email
      let query = supabase
        .from('form_assignments')
        .select(`
          *,
          forms!form_assignments_form_id_fkey(id, name, description, status),
          user_profiles!form_assignments_assigned_by_user_id_fkey(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      // Add filter for user assignments - include assignments by email for external users
      if (userProfile.id && userProfile.email) {
        query = query.or(`assigned_to_user_id.eq.${userProfile.id},assigned_to_email.eq.${userProfile.email}`);
      } else if (userProfile.id) {
        query = query.eq('assigned_to_user_id', userProfile.id);
      } else if (userProfile.email) {
        query = query.eq('assigned_to_email', userProfile.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading form assignments:', error);
        throw error;
      }
      
      console.log('Raw assignment data from database:', data);
      
      // Transform the data to match our interface
      const transformedData = (data || []).map(assignment => ({
        ...assignment,
        form: assignment.forms,
        assigned_by_user: assignment.user_profiles
      }));

      console.log('Transformed assignments for display:', transformedData);
      setAssignments(transformedData);
    } catch (error) {
      console.error('Error loading form assignments:', error);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();

    // Set up real-time subscription for form assignments
    if (userProfile?.id || userProfile?.email) {
      console.log('Setting up real-time subscription for form assignments');
      
      const channel = supabase
        .channel('form-assignments-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'form_assignments',
          },
          (payload) => {
            console.log('Form assignment changed:', payload);
            loadAssignments();
          }
        )
        .subscribe((status) => {
          console.log('Form assignments subscription status:', status);
        });

      return () => {
        console.log('Cleaning up form assignments subscription');
        supabase.removeChannel(channel);
      };
    }
  }, [userProfile?.id, userProfile?.email]);

  const updateAssignmentStatus = async (assignmentId: string, status: string) => {
    try {
      console.log('Updating assignment status:', { assignmentId, status });
      const { error } = await supabase
        .from('form_assignments')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', assignmentId);

      if (error) throw error;
      
      console.log('Assignment status updated successfully');
      await loadAssignments();
    } catch (error) {
      console.error('Error updating assignment status:', error);
      throw error;
    }
  };

  return {
    assignments,
    loading,
    updateAssignmentStatus,
    loadAssignments
  };
}
