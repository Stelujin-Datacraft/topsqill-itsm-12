import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  status: string;
  created_at: string;
  nationality?: string;
  mobile?: string;
  gender?: string;
  timezone?: string;
}

interface OrganizationRequest {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

export const useUserManagement = () => {
  const { currentOrganization } = useOrganization();
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<OrganizationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    if (!currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading users:', error);
        toast({
          title: "Error loading users",
          description: "Failed to load organization users.",
          variant: "destructive",
        });
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadRequests = async () => {
    if (!currentOrganization?.id) return;

    try {
      console.log('Loading requests for organization:', currentOrganization.id);
      
      const { data, error } = await supabase
        .from('organization_requests')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error loading requests:', error);
        return;
      }

      console.log('Loaded pending requests:', data);
      const typedRequests: OrganizationRequest[] = (data || []).map(request => ({
        ...request,
        status: request.status as 'pending' | 'approved' | 'rejected'
      }));

      setRequests(typedRequests);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const createUserWithPassword = async (email: string, firstName: string, lastName: string, role: string = 'user') => {
    try {
      console.log('Creating user account for:', email);
      
      const { data, error } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          email,
          firstName,
          lastName,
          organizationName: currentOrganization?.name || 'Organization',
          organizationId: currentOrganization?.id,
          role: role
        }
      });

      if (error) {
        console.error('Error creating user account:', error);
        toast({
          title: "Error",
          description: "Failed to create user account and send welcome email.",
          variant: "destructive",
        });
        return false;
      }

      console.log('User account created successfully:', data);
      
      // Show appropriate toast based on email status
      if (data.emailSent) {
        toast({
          title: "User created successfully",
          description: `${firstName} ${lastName} has been created and will receive a welcome email with login credentials.`,
        });
      } else {
        toast({
          title: "User created with email issue",
          description: `${firstName} ${lastName} has been created, but there was an issue sending the welcome email.`,
          variant: "destructive",
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error creating user account:', error);
      toast({
        title: "Error",
        description: "Failed to create user account and send welcome email.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleInviteUser = async (inviteData: { email: string; firstName: string; lastName: string; role: string }) => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No organization selected.",
        variant: "destructive",
      });
      return;
    }

    if (!inviteData.email || !inviteData.firstName || !inviteData.lastName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Creating invitation with data:', {
        organization_id: currentOrganization.id,
        email: inviteData.email,
        first_name: inviteData.firstName,
        last_name: inviteData.lastName,
        message: `Invited as ${inviteData.role}`,
        status: 'pending'
      });

      const { error } = await supabase
        .from('organization_requests')
        .insert({
          organization_id: currentOrganization.id,
          email: inviteData.email,
          first_name: inviteData.firstName,
          last_name: inviteData.lastName,
          message: `Invited as ${inviteData.role}`,
          status: 'pending'
        });

      if (error) {
        console.error('Invitation error:', error);
        toast({
          title: "Error",
          description: `Failed to send invitation: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "User invited",
        description: `Invitation sent to ${inviteData.firstName} ${inviteData.lastName} (${inviteData.email})`,
      });
      
      loadRequests();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation.",
        variant: "destructive",
      });
    }
  };

  const handleApproveRequest = async (request: OrganizationRequest) => {
    try {
      console.log('Approving request:', request);
      
      const userCreated = await createUserWithPassword(
        request.email, 
        request.first_name, 
        request.last_name,
        'user'
      );

      if (!userCreated) {
        return;
      }

      const { error: updateError } = await supabase
        .from('organization_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userProfile?.id
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('Error updating request:', updateError);
        toast({
          title: "Warning",
          description: "User account created but failed to update request status.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Request approved",
        description: `${request.first_name} ${request.last_name} has been approved and will receive a welcome email to set up their account.`,
      });

      loadRequests();
      loadUsers();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: "Failed to approve request.",
        variant: "destructive",
      });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('organization_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userProfile?.id
        })
        .eq('id', requestId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to reject request.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Request rejected",
        description: "The join request has been rejected.",
      });

      loadRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update user role.",
          variant: "destructive",
        });
        return;
      }

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      toast({
        title: "Role updated",
        description: "User role has been successfully updated.",
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role.",
        variant: "destructive",
      });
    }
  };

  const handleCreateUser = async (userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    nationality?: string;
    password?: string;
    mobile?: string;
    gender?: string;
    timezone?: string;
  }) => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No organization selected.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Creating user with data:', userData);

      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          organizationName: currentOrganization?.name || 'Organization',
          organizationId: currentOrganization?.id,
          role: userData.role,
          nationality: userData.nationality,
          password: userData.password,
          mobile: userData.mobile,
          gender: userData.gender,
          timezone: userData.timezone,
        }
      });

      if (error) {
        console.error('Error creating user:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to create user account.",
          variant: "destructive",
        });
        return;
      }

      console.log('User created successfully:', data);

      toast({
        title: "User created successfully",
        description: `${userData.firstName} ${userData.lastName} has been added to the organization.`,
      });

      // Reload users list
      await loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: "Failed to create user.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      console.log('Deleting user:', userId);

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) {
        console.error('Error deleting user:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete user.",
          variant: "destructive",
        });
        return;
      }

      console.log('User deleted successfully:', data);

      toast({
        title: "User deleted",
        description: `${userName} has been removed from the organization.`,
      });

      // Reload users list
      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadUsers(), loadRequests()]);
      setLoading(false);
    };

    if (currentOrganization?.id) {
      loadData();
    }
  }, [currentOrganization?.id]);

  const handleBulkImportUsers = async (users: Array<{ 
    email: string; 
    firstName: string; 
    lastName: string; 
    role: string;
    password?: string;
    nationality?: string;
    mobile?: string;
    gender?: string;
    timezone?: string;
  }>) => {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const user of users) {
      try {
        await handleCreateUser(user);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  };

  const handleBulkUpdateUsers = async (
    updates: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      nationality?: string;
      mobile?: string;
      gender?: string;
      timezone?: string;
    }>
  ) => {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const update of updates) {
      try {
        // Find user by email
        const { data: existingUser, error: findError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', update.email)
          .eq('organization_id', currentOrganization.id)
          .maybeSingle();

        if (findError) throw findError;
        
        if (!existingUser) {
          results.failed++;
          results.errors.push(`User not found: ${update.email}`);
          continue;
        }

        // Build update object with only provided fields
        const updateData: any = {};
        if (update.firstName !== undefined) updateData.first_name = update.firstName;
        if (update.lastName !== undefined) updateData.last_name = update.lastName;
        if (update.role !== undefined) updateData.role = update.role;
        if (update.nationality !== undefined) updateData.nationality = update.nationality;
        if (update.mobile !== undefined) updateData.mobile = update.mobile;
        if (update.gender !== undefined) updateData.gender = update.gender;
        if (update.timezone !== undefined) updateData.timezone = update.timezone;

        // Only update if there are fields to update
        if (Object.keys(updateData).length === 0) {
          results.failed++;
          results.errors.push(`No fields to update for: ${update.email}`);
          continue;
        }

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', existingUser.id);

        if (updateError) throw updateError;

        results.successful++;
      } catch (error) {
        console.error('Error updating user:', error);
        results.failed++;
        results.errors.push(
          `Failed to update ${update.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return results;
  };

  return {
    users,
    requests,
    loading,
    handleInviteUser,
    handleApproveRequest,
    handleRejectRequest,
    handleRoleChange,
    handleCreateUser,
    handleDeleteUser,
    handleBulkImportUsers,
    handleBulkUpdateUsers,
    loadUsers,
    loadRequests
  };
};
