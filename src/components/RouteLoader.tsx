import { Loader2 } from "lucide-react";

/**
 * Small inline loading state for route lazy loading.
 * Keeps the existing page chrome visible instead of flashing a full-page skeleton.
 */
export function RouteLoader() {
  return (
    <div className="flex h-20 items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Loading</span>
      </div>
    </div>
  );
}
