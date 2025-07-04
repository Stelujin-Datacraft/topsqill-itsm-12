
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface UserInvitation {
  id: string;
  project_id: string;
  project_name: string;
  role: string;
  invited_by: string;
  inviter_name: string;
  invited_at: string;
  expires_at: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

interface AcceptInvitationResponse {
  success: boolean;
  projectId?: string;
  role?: string;
  error?: string;
}

export function useUserInvitations() {
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { userProfile } = useAuth();

  const loadInvitations = async () => {
    if (!userProfile?.id) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_project_invitations');

      if (error) {
        console.error('Error loading user invitations:', error);
        toast({
          title: "Error",
          description: "Failed to load invitations",
          variant: "destructive",
        });
        return;
      }

      const transformedInvitations: UserInvitation[] = (data || []).map((invitation: any) => ({
        id: invitation.id,
        project_id: invitation.project_id,
        project_name: invitation.project_name,
        role: invitation.role,
        invited_by: invitation.invited_by,
        inviter_name: invitation.inviter_name,
        invited_at: invitation.invited_at,
        expires_at: invitation.expires_at,
        message: invitation.message,
        status: invitation.status as 'pending' | 'accepted' | 'rejected' | 'expired',
      }));

      setInvitations(transformedInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
      toast({
        title: "Error",
        description: "Failed to load invitations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (invitationId: string): Promise<AcceptInvitationResponse> => {
    if (acceptingId) return { success: false }; // Prevent multiple simultaneous accepts

    setAcceptingId(invitationId);
    
    try {
      const { data, error } = await supabase.rpc('accept_project_invitation', {
        invitation_id_param: invitationId
      });

      if (error) {
        console.error('Error accepting invitation:', error);
        throw new Error(error.message || 'Failed to accept invitation');
      }

      // Type assertion for the RPC response
      const response = data as { success?: boolean; error?: string; project_id?: string; role?: string };

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to accept invitation');
      }

      await loadInvitations();
      
      toast({
        title: "Invitation accepted",
        description: "You have successfully joined the project",
      });

      return {
        success: true,
        projectId: response.project_id,
        role: response.role
      };
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setAcceptingId(null);
    }
  };

  const rejectInvitation = async (invitationId: string): Promise<boolean> => {
    if (rejectingId) return false; // Prevent multiple simultaneous rejects

    setRejectingId(invitationId);
    
    try {
      const { data, error } = await supabase.rpc('reject_project_invitation', {
        invitation_id_param: invitationId
      });

      if (error) {
        console.error('Error rejecting invitation:', error);
        throw new Error(error.message || 'Failed to reject invitation');
      }

      // Type assertion for the RPC response
      const response = data as { success?: boolean; error?: string };

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to reject invitation');
      }

      await loadInvitations();
      
      toast({
        title: "Invitation declined",
        description: "You have declined the project invitation",
      });

      return true;
    } catch (error: any) {
      console.error('Error rejecting invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject invitation",
        variant: "destructive",
      });
      return false;
    } finally {
      setRejectingId(null);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, [userProfile?.id]);

  return {
    invitations,
    loading,
    acceptInvitation,
    rejectInvitation,
    loadInvitations,
    acceptingId,
    rejectingId,
  };
}
