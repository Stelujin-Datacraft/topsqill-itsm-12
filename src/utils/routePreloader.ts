/**
  * Route Preloader
  * Preloads ALL application routes after login for instant navigation
  * Eliminates lazy-loading delays by warming the browser cache
 */

 // ALL routes that use lazy loading - preloaded for instant navigation
 const ALL_LAZY_ROUTES = [
   // Primary sections
  '/dashboard',
  '/forms',
  '/workflows',
  '/reports',
  '/projects',
  '/users',
  '/data-feeds',
  '/my-submissions',
   // Form routes
   '/form-builder',
   '/form-submissions',
   // Workflow routes
   '/workflow-designer',
   '/workflow-view',
   // Report routes
   '/report-editor',
   '/report-view',
   '/dashboard-view',
   // Admin routes
   '/organizations',
   '/settings',
   '/roles-and-access',
   '/analytics-dashboard',
   '/email-config',
   '/email-templates',
   '/audit-logs',
   '/form-audit-logs',
   '/investigate-access',
   '/ldap-settings',
   '/sla-management',
   '/api-integration',
   '/api-docs',
   '/profile',
   '/manage-sessions',
   // Public routes
   '/docs',
   '/forgot-password',
] as const;

// Track which routes have been preloaded to avoid duplicate work
const preloadedRoutes = new Set<string>();

/**
 * Preload a specific route by triggering a navigation prefetch
 * Uses the browser's native prefetch capabilities
 */
function preloadRoute(path: string): void {
  if (preloadedRoutes.has(path)) return;
  
  // Create a prefetch link for the route
  // This hints to the browser to prefetch resources for this route
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = path;
  link.as = 'document';
  
  // Add to DOM briefly to trigger prefetch, then remove
  document.head.appendChild(link);
  preloadedRoutes.add(path);
  
  // Clean up after a short delay
  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }, 100);
}

/**
 * Preload all critical routes
 * Should be called after app mount with a delay to not block initial render
 */
export function preloadCriticalRoutes(): void {
  // Don't preload if user is on slow connection
  const connection = (navigator as any).connection;
  if (connection?.saveData || connection?.effectiveType === 'slow-2g') {
    console.log('Skipping route preload due to slow connection');
    return;
  }

   // Preload ALL routes with staggered timing to avoid overwhelming the browser
   ALL_LAZY_ROUTES.forEach((route, index) => {
    setTimeout(() => {
      preloadRoute(route);
     }, index * 30); // 30ms delay between each route for faster completion
  });
}

/**
 * Check if a route has been preloaded
 */
export function isRoutePreloaded(path: string): boolean {
  return preloadedRoutes.has(path);
}

/**
 * Manually trigger preload for a specific route
 * Useful for hover-based prefetching on navigation links
 */
export function prefetchRoute(path: string): void {
  preloadRoute(path);
}

/**
 * Get list of critical routes (for testing/debugging)
 */
export function getCriticalRoutes(): readonly string[] {
   return ALL_LAZY_ROUTES;
}
