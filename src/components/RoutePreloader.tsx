import { useEffect } from 'react';
import { preloadCriticalRoutes } from '@/utils/routePreloader';

/**
 * Component that preloads critical routes after app mount
 * Place this component near the root of the app (inside BrowserRouter)
 */
export function RoutePreloader() {
  useEffect(() => {
    // Delay preloading to not interfere with initial page load
    // 500ms gives time for the initial render to complete
    const timeoutId = setTimeout(() => {
      preloadCriticalRoutes();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  // This component doesn't render anything
  return null;
}
