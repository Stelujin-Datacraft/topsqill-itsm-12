import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface Group {
  id: string;
  name: string;
}

export function useUsersAndGroups() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch users from user_profiles
        const { data: usersData, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name');

        if (usersError) {
          console.error('Error fetching users:', usersError);
        } else {
          setUsers(usersData || []);
        }

        // Fetch groups
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('id, name');

        if (groupsError) {
          console.error('Error fetching groups:', groupsError);
        } else {
          setGroups(groupsData || []);
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching users and groups:', err);
        setError('Failed to fetch users and groups');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getUserDisplayName = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    if (!user) return `User: ${userId}`;
    
    const name = (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name) ||
                 user.email;
    return `${name} (${user.email})`;
  };

  const getGroupDisplayName = (groupId: string): string => {
    const group = groups.find(g => g.id === groupId);
    return group ? group.name : `Group: ${groupId}`;
  };

  return {
    users,
    groups,
    loading,
    error,
    getUserDisplayName,
    getGroupDisplayName
  };
}