import * as React from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle, type LucideIcon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/icons';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        approved: 'border-success/20 bg-success/10 text-success',
        active: 'border-success/20 bg-success/10 text-success',
        pending: 'border-warning/20 bg-warning/10 text-warning',
        review: 'border-info/20 bg-info/10 text-info',
        inactive: 'border-destructive/20 bg-destructive/10 text-destructive',
        rejected: 'border-destructive/20 bg-destructive/10 text-destructive',
        draft: 'border-muted-foreground/20 bg-muted text-muted-foreground',
        default: 'border-border bg-muted/60 text-muted-foreground',
      },
    },
    defaultVariants: {
      status: 'default',
    },
  }
);

const statusIcons: Record<string, LucideIcon> = {
  approved: CheckCircle,
  active: CheckCircle,
  pending: Clock,
  review: AlertCircle,
  inactive: XCircle,
  rejected: XCircle,
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string;
  showIcon?: boolean;
}

export function StatusBadge({
  status = 'default',
  label,
  showIcon = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const key = status ?? 'default';
  const Icon = statusIcons[key];
  const text = children ?? label ?? (key === 'review' ? 'In Review' : key);

  return (
    <span className={cn(statusBadgeVariants({ status: key as StatusBadgeProps['status'] }), className)} {...props}>
      {showIcon && Icon && <AppIcon icon={Icon} size="xs" className="opacity-90" />}
      <span className="capitalize">{text}</span>
    </span>
  );
}

export { statusBadgeVariants };
