/**
  * Module Preloader
  * Preloads critical React lazy components by triggering their imports
  * This ensures chunks are downloaded, parsed, and ready for instant mounting
 */

// Map of route paths to their lazy import functions
// These are the actual dynamic imports that React.lazy uses
const CRITICAL_MODULE_IMPORTS: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/forms': () => import('@/pages/Forms'),
  '/form-builder': () => import('@/pages/FormBuilder'),
  '/form-edit': () => import('@/pages/FormEdit'),
  '/form-view': () => import('@/pages/FormView'),
  '/workflows': () => import('@/pages/Workflows'),
  '/reports': () => import('@/pages/Reports'),
  '/projects': () => import('@/pages/Projects'),
  '/users': () => import('@/pages/Users'),
  '/data-feeds': () => import('@/pages/DataFeeds'),
  '/my-submissions': () => import('@/pages/MySubmissions'),
  '/form-submissions': () => import('@/pages/FormSubmissionsTable'),
  '/settings': () => import('@/pages/SettingsPage'),
};

// Track which modules have been preloaded to avoid duplicate imports
const preloadedRoutes = new Set<string>();

/**
 * Preload a specific route by triggering its actual import()
 * This downloads, parses, and caches the JS module for instant React mounting
 */
async function preloadModule(path: string): Promise<void> {
  if (preloadedRoutes.has(path)) return;
  
  const importFn = CRITICAL_MODULE_IMPORTS[path];
  if (!importFn) return;

  preloadedRoutes.add(path);

  try {
    // Actually trigger the dynamic import - this loads and caches the module
    await importFn();
  } catch (error) {
    // Silent fail - module will load on navigation instead
    preloadedRoutes.delete(path);
  }
}

/**
 * Preload all critical route modules
 * Uses requestIdleCallback for non-blocking background loading
 */
export function preloadCriticalRoutes(): void {
  // Don't preload if user is on slow connection
  const connection = (navigator as any).connection;
  if (connection?.saveData || connection?.effectiveType === 'slow-2g') {
    console.log('Skipping route preload due to slow connection');
    return;
  }

  const routes = Object.keys(CRITICAL_MODULE_IMPORTS);
  
  // Use requestIdleCallback for non-blocking preloading
  const preloadNext = (index: number) => {
    if (index >= routes.length) return;
    
    const scheduleNext = () => {
      // Stagger with 100ms to avoid overwhelming the browser
      setTimeout(() => preloadNext(index + 1), 100);
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        preloadModule(routes[index]).then(scheduleNext);
      }, { timeout: 2000 });
    } else {
      // Fallback for Safari
      setTimeout(() => {
        preloadModule(routes[index]).then(scheduleNext);
      }, 50);
    }
  };

  preloadNext(0);
}

/**
 * Preload a specific route module on demand (e.g., on hover)
 */
export function prefetchRoute(path: string): void {
  // Check if we have a known import for this route
  if (CRITICAL_MODULE_IMPORTS[path]) {
    preloadModule(path);
  }
}

/**
 * Preload additional routes not in the critical list
 * Call with the import function directly
 */
export function prefetchModule(importFn: () => Promise<unknown>, key: string): void {
  if (preloadedRoutes.has(key)) return;
  preloadedRoutes.add(key);
  importFn().catch(() => {
    preloadedRoutes.delete(key);
  });
}

/**
 * Check if a route has been preloaded
 */
export function isRoutePreloaded(path: string): boolean {
  return preloadedRoutes.has(path);
}

/** Get list of critical routes */
export function getCriticalRoutes(): readonly string[] {
  return Object.keys(CRITICAL_MODULE_IMPORTS);
}
