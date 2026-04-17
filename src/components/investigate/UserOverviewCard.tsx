import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { Mail, Calendar, Building2, IdCard, Clock } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  organization_id?: string | null;
  created_at: string;
}

interface QuickStats {
  rolesCount?: number;
  groupsCount?: number;
  projectsCount?: number;
  activeSessionsCount?: number;
  permissionsCount?: number;
  lastLogin?: string | null;
  mfaEnabled?: boolean | null;
  accountLockedUntil?: string | null;
}

interface UserOverviewCardProps {
  profile: UserProfile;
  loading?: boolean;
  stats?: QuickStats;
}

export function UserOverviewCard({ profile, loading, stats }: UserOverviewCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-60" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      case 'suspended':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400';
      case 'user':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const displayName = profile.first_name && profile.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile.email;

  const initials = profile.first_name && profile.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : profile.email[0].toUpperCase();

  const isLocked = stats?.accountLockedUntil && new Date(stats.accountLockedUntil) > new Date();

  const quickStats = [
    { label: 'Roles', value: stats?.rolesCount ?? 0, color: 'text-violet-600 dark:text-violet-400' },
    { label: 'Groups', value: stats?.groupsCount ?? 0, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Projects', value: stats?.projectsCount ?? 0, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Permissions', value: stats?.permissionsCount ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Active Sessions', value: stats?.activeSessionsCount ?? 0, color: 'text-cyan-600 dark:text-cyan-400' },
  ];

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Avatar + Identity */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold truncate">{displayName}</h2>
                <Badge className={getRoleColor(profile.role)}>{profile.role}</Badge>
                <Badge className={getStatusColor(profile.status)}>{profile.status}</Badge>
                {isLocked && (
                  <Badge variant="destructive">🔒 Locked</Badge>
                )}
                {stats?.mfaEnabled && (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                    MFA Enabled
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>Joined {format(new Date(profile.created_at), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <IdCard className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono text-xs truncate" title={profile.id}>
                    {profile.id.slice(0, 8)}…{profile.id.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Last login: {stats?.lastLogin
                      ? formatDistanceToNow(new Date(stats.lastLogin), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-5 gap-3 lg:min-w-[480px] border-t lg:border-t-0 lg:border-l lg:pl-6 pt-4 lg:pt-0">
            {quickStats.map((s) => (
              <div key={s.label} className="text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
