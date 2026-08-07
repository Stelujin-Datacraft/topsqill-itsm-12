import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { backend as supabase } from '@/services/api';

/**
 * New-user gate: until the organization has at least one form,
 * the app shell (sidebar/nav) is hidden and the user stays in the AI builder.
 */
export function useOnboardingGate() {
  const { user, userProfile } = useAuth();
  const organizationId = userProfile?.organization_id;

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-has-forms', organizationId],
    enabled: !!user && !!organizationId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data === false ? 8000 : false),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(1);
      if (error) return true; // fail open — never lock a user out on a fetch error
      return (data?.length ?? 0) > 0;
    },
  });

  const hasForms = data !== false;

  return {
    checking: !!organizationId && isLoading && data === undefined,
    hasForms,
    isNewUser: !!organizationId && data === false,
  };
}
