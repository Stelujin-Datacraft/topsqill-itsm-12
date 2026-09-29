import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * Shared Integration Studio page chrome — full-width content area aligned
 * with the rest of the app shell (no narrow centered column).
 */
export function VisPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('w-full min-h-full overflow-y-auto', className)}>
      <div className="w-full max-w-[1400px] mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-5">
        {children}
      </div>
    </div>
  );
}

export function VisPageHeader({
  eyebrow = 'Versatile Integration Studio',
  title,
  description,
  backTo,
  backLabel = 'Back',
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {backTo && (
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 px-2 text-muted-foreground">
            <Link to={backTo}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {backLabel}
            </Link>
          </Button>
        )}
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-1">
          {actions}
        </div>
      )}
    </div>
  );
}

export function VisSubnav({ active }: { active: 'dashboard' | 'integrations' | 'connections' | 'executions' }) {
  const items = [
    { id: 'dashboard' as const, label: 'Dashboard', to: '/vis' },
    { id: 'integrations' as const, label: 'Integrations', to: '/vis/integrations' },
    { id: 'connections' as const, label: 'Connections', to: '/vis/connections' },
    { id: 'executions' as const, label: 'Executions', to: '/vis/executions' },
  ];

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border/60 -mx-1 px-1 pb-px">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <Link
            key={item.id}
            to={item.to}
            className={cn(
              'px-3 py-2 text-sm rounded-t-md transition-colors',
              isActive
                ? 'text-foreground font-medium border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
