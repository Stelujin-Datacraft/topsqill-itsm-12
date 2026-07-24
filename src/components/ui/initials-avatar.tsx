import * as React from 'react';
import { cn } from '@/lib/utils';

const AVATAR_GRADIENTS = [
  'from-teal-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-cyan-500 to-blue-500',
  'from-violet-500 to-indigo-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return 'U';
}

interface InitialsAvatarProps {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'size-7 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

export function InitialsAvatar({
  name,
  firstName,
  lastName,
  email,
  size = 'md',
  className,
}: InitialsAvatarProps) {
  const initials = name
    ? name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    : getInitials(firstName, lastName, email);
  const seed = email || name || `${firstName}${lastName}` || 'user';
  const gradient = AVATAR_GRADIENTS[hashString(seed) % AVATAR_GRADIENTS.length];

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br flex items-center justify-center font-semibold text-white shadow-xs shrink-0',
        gradient,
        sizeClasses[size],
        className
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
