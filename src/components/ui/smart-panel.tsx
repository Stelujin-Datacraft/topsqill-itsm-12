import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SmartPanelProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}

/**
 * Smart Data Table shell — teal header, white body, footer bar.
 * Matches the reference HD table/panel layout used across the app.
 */
export function SmartPanel({
  title,
  description,
  actions,
  footer,
  children,
  className,
  contentClassName,
  id,
}: SmartPanelProps) {
  return (
    <Card className={cn('smart-panel overflow-hidden', className)}>
      <CardHeader className="smart-panel-header border-b border-border/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle id={id} className="smart-panel-title text-xl sm:text-2xl">
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-sm sm:text-base text-muted-foreground">
                {description}
              </CardDescription>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent className={cn('p-0', contentClassName)}>{children}</CardContent>
      {footer && <div className="smart-panel-footer border-t border-border/60">{footer}</div>}
    </Card>
  );
}

interface SmartPanelFooterProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function SmartPanelFooter({ left, right, className }: SmartPanelFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">{left}</div>
      {right && <div className="flex flex-wrap gap-2">{right}</div>}
    </div>
  );
}
