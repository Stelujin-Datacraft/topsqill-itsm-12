import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface KPIMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  formula?: string;
  className?: string;
}

export function KPIMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  variant = 'default',
  className,
}: KPIMetricCardProps) {
  const variantStyles = {
    default: 'border-border/70 bg-gradient-to-br from-card via-card to-muted/40',
    success: 'border-success/35 bg-gradient-to-br from-success/10 via-card to-card',
    warning: 'border-warning/35 bg-gradient-to-br from-warning/15 via-card to-card',
    danger: 'border-destructive/35 bg-gradient-to-br from-destructive/10 via-card to-card',
  };

  const accentStyles = {
    default: 'from-primary/60 to-primary/20',
    success: 'from-success to-success/40',
    warning: 'from-warning to-warning/40',
    danger: 'from-destructive to-destructive/40',
  };

  const iconStyles = {
    default: 'border-primary/20 bg-primary/10 text-primary',
    success: 'border-success/20 bg-success/10 text-success',
    warning: 'border-warning/20 bg-warning/10 text-warning',
    danger: 'border-destructive/20 bg-destructive/10 text-destructive',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up'
    ? 'text-success bg-success/10 border-success/20'
    : trend === 'down'
      ? 'text-destructive bg-destructive/10 border-destructive/20'
      : 'text-muted-foreground bg-muted border-border';

  return (
    <Card className={cn('group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg', variantStyles[variant], className)}>
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r', accentStyles[variant])} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em] truncate">{title}</p>
            <p className="text-2xl font-bold text-foreground leading-none">{typeof value === 'number' ? formatValue(value) : value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && (
              <div className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', trendColor)}>
                <TrendIcon className="h-3 w-3" />
                {trendLabel && <span>{trendLabel}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn('rounded-xl border p-2.5 transition-transform duration-200 group-hover:scale-105', iconStyles[variant])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `₹${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `₹${(val / 1_000).toFixed(1)}K`;
  if (Number.isInteger(val)) return val.toLocaleString('en-IN');
  return val.toFixed(2);
}
