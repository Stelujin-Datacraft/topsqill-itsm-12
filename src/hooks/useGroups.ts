import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface Group {
  id: string;
  name: string;
  organization_id: string;
  role_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role_name?: string;
  member_count?: number;
}

export interface GroupMember {
  member_id: string;
  member_type: 'user' | 'group';
  member_name: string;
  member_email?: string;
}

export interface CreateGroupData {
  name: string;
  roleId?: string;
  members: { id: string; type: 'user' | 'group' }[];
}

export function useGroups() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Use React Query for caching
  const { data: groups = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['groups', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      // Fetch groups with role information
      const { data: groupsData, error } = await supabase
        .from('groups')
        .select(`
          *,
          roles!left(name)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Batch fetch all member counts in a single query (N+1 optimization)
      const groupIds = (groupsData || []).map(g => g.id);
      let memberCountMap = new Map<string, number>();
      
      if (groupIds.length > 0) {
        const { data: memberships } = await supabase
          .from('group_memberships')
          .select('group_id')
          .in('group_id', groupIds);
        
        // Count memberships per group
        for (const membership of memberships || []) {
          const count = memberCountMap.get(membership.group_id) || 0;
          memberCountMap.set(membership.group_id, count + 1);
        }
      }

      // Enrich groups with pre-fetched member counts
      return (groupsData || []).map((group) => ({
        ...group,
        role_name: group.roles?.name,
        member_count: memberCountMap.get(group.id) || 0
      })) as Group[];
    },
    enabled: !!currentOrganization?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const error = queryError ? 'Failed to load groups' : null;

  const createGroupMutation = useMutation({
    mutationFn: async (data: CreateGroupData) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;
      
      if (!currentUserId) throw new Error('User not authenticated');

      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: data.name,
          organization_id: currentOrganization.id,
          role_id: data.roleId || null,
          created_by: currentUserId
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add members to the group
      if (data.members.length > 0) {
        const memberships = data.members.map(member => ({
          group_id: groupData.id,
          member_id: member.id,
          member_type: member.type,
          added_by: currentUserId
        }));

        const { error: membershipError } = await supabase
          .from('group_memberships')
          .insert(memberships);

        if (membershipError) throw membershipError;
      }

      return groupData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', currentOrganization?.id] });
    },
  });

  const createGroup = async (data: CreateGroupData) => {
    return createGroupMutation.mutateAsync(data);
  };

  const updateGroupMutation = useMutation({
    mutationFn: async ({ groupId, data }: { groupId: string; data: CreateGroupData }) => {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;
      
      if (!currentUserId) throw new Error('User not authenticated');

      // Update the group
      const { error: groupError } = await supabase
        .from('groups')
        .update({
          name: data.name,
          role_id: data.roleId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId);

      if (groupError) throw groupError;

      // Delete existing memberships
      const { error: deleteError } = await supabase
        .from('group_memberships')
        .delete()
        .eq('group_id', groupId);

      if (deleteError) throw deleteError;

      // Add new memberships
      if (data.members.length > 0) {
        const memberships = data.members.map(member => ({
          group_id: groupId,
          member_id: member.id,
          member_type: member.type,
          added_by: currentUserId
        }));

        const { error: membershipError } = await supabase
          .from('group_memberships')
          .insert(memberships);

        if (membershipError) throw membershipError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', currentOrganization?.id] });
    },
  });

  const updateGroup = async (groupId: string, data: CreateGroupData) => {
    return updateGroupMutation.mutateAsync({ groupId, data });
  };

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', currentOrganization?.id] });
    },
  });

  const deleteGroup = async (groupId: string) => {
    return deleteGroupMutation.mutateAsync(groupId);
  };

  const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
    try {
      const { data, error } = await supabase.rpc('get_group_members', {
        _group_id: groupId
      });

      if (error) throw error;

      // Type the response correctly
      return (data || []).map((member: any) => ({
        member_id: member.member_id,
        member_type: member.member_type as 'user' | 'group',
        member_name: member.member_name,
        member_email: member.member_email
      }));
    } catch (error) {
      console.error('Error fetching group members:', error);
      return [];
    }
  };

  return {
    groups,
    loading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupMembers,
    refetch: () => refetch()
  };
}
