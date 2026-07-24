import * as React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

export const iconSizes = {
  xs: 'size-3',
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
  xl: 'size-6',
  '2xl': 'size-8',
} as const;

export type AppIconSize = keyof typeof iconSizes;

export interface AppIconProps extends Omit<LucideProps, 'ref'> {
  icon: LucideIcon;
  size?: AppIconSize;
  /** Render inside a muted icon box */
  boxed?: boolean | 'sm' | 'md' | 'lg';
}

const boxClasses = {
  sm: 'icon-box-sm',
  md: 'icon-box-md',
  lg: 'icon-box-lg',
} as const;

/**
 * HD-enhanced Lucide icon — consistent stroke, sizing, and optional boxed container.
 */
export function AppIcon({
  icon: Icon,
  size = 'md',
  className,
  strokeWidth = 1.75,
  absoluteStrokeWidth = true,
  boxed,
  ...props
}: AppIconProps) {
  const icon = (
    <Icon
      className={cn(iconSizes[size], 'shrink-0', className)}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={absoluteStrokeWidth}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );

  if (!boxed) return icon;

  const boxSize = boxed === true ? 'md' : boxed;
  return <span className={boxClasses[boxSize]}>{icon}</span>;
}
