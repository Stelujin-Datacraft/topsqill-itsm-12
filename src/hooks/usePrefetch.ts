import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook for prefetching route data on hover
 * Improves perceived navigation speed by loading data before user clicks
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  /**
   * Prefetch data for a specific query key
   * Call this on mouseEnter/focus events for navigation elements
   */
  const prefetchQuery = useCallback(
    async <T>(
      queryKey: string[],
      queryFn: () => Promise<T>,
      staleTime = 2 * 60 * 1000 // 2 minutes default
    ) => {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime,
      });
    },
    [queryClient]
  );

  /**
   * Invalidate and refetch a query (useful when data might be stale)
   */
  const invalidateAndRefetch = useCallback(
    async (queryKey: string[]) => {
      await queryClient.invalidateQueries({ queryKey });
    },
    [queryClient]
  );

  return {
    prefetchQuery,
    invalidateAndRefetch,
    queryClient,
  };
}
