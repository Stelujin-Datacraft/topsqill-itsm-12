/**
 * React Query-based groups hook with automatic caching
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { queryKeys, cacheManager } from '@/lib/cacheManager';

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

async function fetchGroups(organizationId: string): Promise<Group[]> {
  // Fetch groups with role information
  const { data: groupsData, error } = await supabase
    .from('groups')
    .select('id, name, organization_id, role_id, created_by, created_at, updated_at, roles!left(name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Get member counts in a single batch query
  const groupIds = (groupsData || []).map(g => g.id);
  
  if (groupIds.length === 0) return [];

  // Batch fetch member counts
  const { data: memberCounts } = await supabase
    .from('group_memberships')
    .select('group_id')
    .in('group_id', groupIds);

  // Count members per group
  const countMap = new Map<string, number>();
  (memberCounts || []).forEach(m => {
    countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1);
  });

  return (groupsData || []).map(group => ({
    ...group,
    role_name: (group.roles as any)?.name,
    member_count: countMap.get(group.id) || 0
  }));
}

export function useGroupsQuery() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  // Main query with caching
  const { data: groups = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.groups(orgId),
    queryFn: () => fetchGroups(orgId!),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateGroupData) => {
      if (!orgId) throw new Error('No organization selected');

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;
      if (!currentUserId) throw new Error('User not authenticated');

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: data.name,
          organization_id: orgId,
          role_id: data.roleId || null,
          created_by: currentUserId
        })
        .select()
        .single();

      if (groupError) throw groupError;

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
      cacheManager.invalidateGroups(orgId);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ groupId, data }: { groupId: string; data: CreateGroupData }) => {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;
      if (!currentUserId) throw new Error('User not authenticated');

      const { error: groupError } = await supabase
        .from('groups')
        .update({
          name: data.name,
          role_id: data.roleId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId);

      if (groupError) throw groupError;

      // Replace memberships
      await supabase.from('group_memberships').delete().eq('group_id', groupId);

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
      cacheManager.invalidateGroups(orgId);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      cacheManager.invalidateGroups(orgId);
    },
  });

  // Get group members
  const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
    try {
      const { data, error } = await supabase.rpc('get_group_members', { _group_id: groupId });
      if (error) throw error;

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
    error: error?.message || null,
    createGroup: (data: CreateGroupData) => createMutation.mutateAsync(data),
    updateGroup: (groupId: string, data: CreateGroupData) => updateMutation.mutateAsync({ groupId, data }),
    deleteGroup: (id: string) => deleteMutation.mutateAsync(id),
    getGroupMembers,
    refetch,
  };
}
