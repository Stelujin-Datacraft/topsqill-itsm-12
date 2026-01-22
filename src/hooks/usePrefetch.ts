import { useCallback } from 'react';

// Map routes to their lazy-loaded components for prefetching
const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/forms': () => import('@/pages/Forms'),
  '/projects': () => import('@/pages/Projects'),
  '/workflows': () => import('@/pages/Workflows'),
  '/reports': () => import('@/pages/Reports'),
  '/users': () => import('@/pages/Users'),
  '/my-submissions': () => import('@/pages/MySubmissions'),
  '/organizations': () => import('@/pages/Organizations'),
  '/query': () => import('@/pages/QueryPage'),
  '/settings': () => import('@/pages/Settings'),
  '/data-feeds': () => import('@/pages/DataFeeds'),
  '/roles-and-access': () => import('@/pages/RolesAndAccess'),
  '/audit-logs': () => import('@/pages/AuditLogs'),
  '/form-audit-logs': () => import('@/pages/FormAuditLogs'),
  '/analytics-dashboard': () => import('@/pages/AnalyticsDashboard'),
  '/investigate-access': () => import('@/pages/InvestigateAccess'),
  '/manage-sessions': () => import('@/pages/ManageSessions'),
  '/ldap-settings': () => import('@/pages/LdapSettings'),
  '/profile': () => import('@/pages/UserProfile'),
  '/change-password': () => import('@/pages/ChangePassword'),
};

// Track which routes have been prefetched to avoid duplicate loads
const prefetchedRoutes = new Set<string>();

/**
 * Hook to prefetch route components on hover for faster navigation
 * Prefetches immediately on hover for instant navigation
 */
export function usePrefetch() {
  const prefetch = useCallback((url: string) => {
    // Normalize the URL to match route patterns
    const normalizedUrl = getNormalizedRoute(url);
    
    // Skip if already prefetched or no matching route
    if (prefetchedRoutes.has(normalizedUrl) || !routePrefetchMap[normalizedUrl]) {
      return;
    }

    // Prefetch immediately for fastest navigation
    const loader = routePrefetchMap[normalizedUrl];
    if (loader) {
      loader()
        .then(() => {
          prefetchedRoutes.add(normalizedUrl);
        })
        .catch(() => {
          // Silently fail - prefetch is just an optimization
        });
    }
  }, []);

  // No-op cancel since we prefetch immediately
  const cancelPrefetch = useCallback(() => {}, []);

  return { prefetch, cancelPrefetch };
}

/**
 * Normalize dynamic URLs to their base route pattern
 */
function getNormalizedRoute(url: string): string {
  // Handle project-specific routes
  if (url.startsWith('/projects/') && url.includes('/overview')) {
    return '/projects';
  }
  
  // Handle form builder routes with IDs
  if (url.startsWith('/forms/') || url.startsWith('/form-builder/')) {
    return '/forms';
  }

  // Handle workflow routes with IDs
  if (url.startsWith('/workflows/') || url.startsWith('/workflow-builder/')) {
    return '/workflows';
  }

  // Handle report routes with IDs
  if (url.startsWith('/reports/') || url.startsWith('/report-builder/')) {
    return '/reports';
  }

  return url;
}

/**
 * Props to spread on navigation links for prefetching
 */
export function getPrefetchProps(prefetch: (url: string) => void, cancelPrefetch: () => void, url: string) {
  return {
    onMouseEnter: () => prefetch(url),
    onMouseLeave: cancelPrefetch,
    onFocus: () => prefetch(url),
    onBlur: cancelPrefetch,
  };
}
