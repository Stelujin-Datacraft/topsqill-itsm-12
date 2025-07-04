
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  role: string;
  invited_by: string;
  invited_at: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;
  accepted_at?: string;
  message?: string;
}

export function useProjectInvitations(projectId: string) {
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvitations = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('project_invitations')
        .select('*')
        .eq('project_id', projectId)
        .order('invited_at', { ascending: false });

      if (error) {
        console.error('Error loading invitations:', error);
        return;
      }

      // Transform the data to ensure proper typing
      const transformedInvitations: ProjectInvitation[] = (data || []).map((invitation: any) => ({
        id: invitation.id,
        project_id: invitation.project_id,
        email: invitation.email,
        role: invitation.role,
        invited_by: invitation.invited_by,
        invited_at: invitation.invited_at,
        status: invitation.status as 'pending' | 'accepted' | 'rejected' | 'expired',
        expires_at: invitation.expires_at,
        accepted_at: invitation.accepted_at,
        message: invitation.message,
      }));

      setInvitations(transformedInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const inviteUser = async (email: string, role: string, message?: string) => {
    try {
      const { data, error } = await supabase.rpc('invite_user_to_project', {
        project_id_param: projectId,
        email_param: email,
        role_param: role,
        message_param: message
      });

      if (error) {
        console.error('Error inviting user:', error);
        throw error;
      }

      await loadInvitations();
      toast({
        title: "Invitation sent",
        description: `Invitation sent to ${email}`,
      });

      return data;
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
      throw error;
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      // Delete the invitation instead of updating status to 'expired'
      const { error } = await supabase
        .from('project_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) {
        console.error('Error canceling invitation:', error);
        throw error;
      }

      await loadInvitations();
      toast({
        title: "Invitation canceled",
        description: "The invitation has been canceled",
      });
    } catch (error) {
      console.error('Error canceling invitation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadInvitations();
  }, [projectId]);

  return {
    invitations,
    loading,
    inviteUser,
    cancelInvitation,
    loadInvitations,
  };
}
