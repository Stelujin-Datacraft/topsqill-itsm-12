import { Loader2 } from "lucide-react";

/**
 * Lightweight loading component for Suspense fallback during route lazy loading.
 * Minimal design to avoid jarring transitions.
 */
export function RouteLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
