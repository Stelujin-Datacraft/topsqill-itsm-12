import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
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
  const { currentOrganization } = useOrganization();

  // Use React Query for caching organization users
  const { data: users = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['organization-users', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .rpc('get_organization_users', { org_id: currentOrganization.id });

      if (error) throw error;
      return (data || []) as OrganizationUser[];
    },
    enabled: !!currentOrganization?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Memoized search function
  const searchUsers = useMemo(() => {
    return (query: string) => {
      if (!query.trim()) return users;
      
      const lowercaseQuery = query.toLowerCase();
      return users.filter(user => 
        user.email.toLowerCase().includes(lowercaseQuery) ||
        user.first_name?.toLowerCase().includes(lowercaseQuery) ||
        user.last_name?.toLowerCase().includes(lowercaseQuery)
      );
    };
  }, [users]);

  return {
    users,
    loading,
    searchUsers,
    loadUsers: () => refetch()
  };
}
