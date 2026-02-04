/**
 * Critical Route Preloader
 * Aggressively preloads high-traffic routes after app mount to ensure instant navigation
 */

// Define critical routes that should be preloaded
// These are the most commonly accessed routes in the application
const CRITICAL_ROUTES = [
  '/dashboard',
  '/forms',
  '/workflows',
  '/reports',
  '/projects',
  '/users',
  '/data-feeds',
  '/my-submissions',
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

  // Preload routes with staggered timing to avoid overwhelming the browser
  CRITICAL_ROUTES.forEach((route, index) => {
    setTimeout(() => {
      preloadRoute(route);
    }, index * 50); // 50ms delay between each route
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
  return CRITICAL_ROUTES;
}
