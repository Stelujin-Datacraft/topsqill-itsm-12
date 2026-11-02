import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { request } from '@/services/api/apiClient';
import { openSnapshot, type EntitlementsSnapshot, type ModuleKey } from '@/lib/entitlements/modules';

export const ENTITLEMENTS_QUERY_KEY = ['entitlements', 'me'] as const;

/**
 * What the signed-in user's organisation has paid for. The server is the real lock;
 * while loading, or if the server cannot answer, the UI stays open and the API decides.
 */
export function useEntitlements() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: [...ENTITLEMENTS_QUERY_KEY, user?.id],
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<EntitlementsSnapshot> => {
      const { data, error } = await request<EntitlementsSnapshot>('/entitlements/me', { method: 'GET' });
      if (error || !data) return openSnapshot();
      return { ...openSnapshot(), ...data };
    },
  });
  const snapshot = query.data ?? openSnapshot();
  return {
    ...snapshot,
    loading: query.isLoading,
    levelOf: (module: ModuleKey) => snapshot.modules[module]?.level ?? 'full',
    refetch: query.refetch,
  };
}
