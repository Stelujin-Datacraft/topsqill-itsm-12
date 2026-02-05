 import { PageSkeleton } from "@/components/loading/PageSkeleton";

/**
 * Lightweight loading component for Suspense fallback during route lazy loading.
 * Minimal design to avoid jarring transitions.
 */
export function RouteLoader() {
   return <PageSkeleton />;
}
