
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface OrganizationUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export function useOrganizationUsers() {
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentOrganization } = useOrganization();

  const loadUsers = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_organization_users', { org_id: currentOrganization.id });

      if (error) {
        console.error('Error loading organization users:', error);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error loading organization users:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = (query: string) => {
    if (!query.trim()) return users;
    
    const lowercaseQuery = query.toLowerCase();
    return users.filter(user => 
      user.email.toLowerCase().includes(lowercaseQuery) ||
      user.first_name?.toLowerCase().includes(lowercaseQuery) ||
      user.last_name?.toLowerCase().includes(lowercaseQuery)
    );
  };

  useEffect(() => {
    loadUsers();
  }, [currentOrganization?.id]);

  return {
    users,
    loading,
    searchUsers,
    loadUsers
  };
}
