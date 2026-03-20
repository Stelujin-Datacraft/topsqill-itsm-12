/**
 * Shared severity color utilities for the Performance module.
 * Eliminates duplicated severity-to-color mapping across components.
 */

/** Returns Tailwind classes for severity badge styling (bg + text + border) */
export function getSeverityColorClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'low': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    default: return '';
  }
}

/** Returns shadcn Badge variant for severity */
export function getSeverityBadgeVariant(severity: string): 'destructive' | 'secondary' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/** Returns Tailwind classes for health status styling */
export function getHealthColorClass(status?: string): string {
  switch (status) {
    case 'green': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'yellow': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'orange': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'red': return 'bg-red-500/10 text-red-600 border-red-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
}
