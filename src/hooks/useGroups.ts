
import { useState, useEffect } from 'react';
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();

  const fetchGroups = async () => {
    if (!currentOrganization?.id) {
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
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

      // Get member counts for each group
      const enrichedGroups = await Promise.all(
        (groupsData || []).map(async (group) => {
          try {
            const { count } = await supabase
              .from('group_memberships')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);

            return {
              ...group,
              role_name: group.roles?.name,
              member_count: count || 0
            };
          } catch (memberError) {
            console.error('Error fetching member count for group:', group.id, memberError);
            return {
              ...group,
              role_name: group.roles?.name,
              member_count: 0
            };
          }
        })
      );

      setGroups(enrichedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setError('Failed to load groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (data: CreateGroupData) => {
    if (!currentOrganization?.id) throw new Error('No organization selected');

    try {
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

      await fetchGroups();
      return groupData;
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  };

  const updateGroup = async (groupId: string, data: CreateGroupData) => {
    try {
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

      await fetchGroups();
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      await fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
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

  useEffect(() => {
    fetchGroups();
  }, [currentOrganization?.id]);

  return {
    groups,
    loading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupMembers,
    refetch: fetchGroups
  };
}
