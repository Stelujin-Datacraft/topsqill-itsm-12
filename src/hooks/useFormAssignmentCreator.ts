
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useFormAssignmentCreator() {
  const { userProfile } = useAuth();

  const createFormAssignment = async (
    formId: string,
    assignedToUserId: string | null,
    assignedToEmail: string | null,
    assignmentType: 'manual' | 'workflow' = 'manual',
    projectId?: string,
    dueDate?: string,
    notes?: string
  ) => {
    try {
      const assignmentData = {
        form_id: formId,
        assigned_to_user_id: assignedToUserId,
        assigned_to_email: assignedToEmail,
        assigned_by_user_id: userProfile?.id,
        assignment_type: assignmentType,
        project_id: projectId,
        status: 'pending',
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        notes
      };

      const { data, error } = await supabase
        .from('form_assignments')
        .insert(assignmentData)
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      toast({
        title: "Assignment created",
        description: "Form has been assigned successfully.",
      });

      return data;
    } catch (error) {
      console.error('Error creating form assignment:', error);
      toast({
        title: "Error",
        description: "Failed to create form assignment.",
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    createFormAssignment
  };
}
