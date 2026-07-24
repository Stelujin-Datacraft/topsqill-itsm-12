import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { backend as supabase } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow, differenceInMinutes, differenceInSeconds } from 'date-fns';
import DashboardLayout from '@/components/DashboardLayout';
import { BackToMembersButton } from '@/components/users/BackToMembersButton';
import {
  Monitor,
  Smartphone,
  Globe,
  Clock,
  LogOut,
  RefreshCw,
  Search,
  Users,
  Activity,
  Wifi,
  WifiOff,
  Tablet,
  ShieldCheck,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Session {
  id: string;
  user_id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_activity: string;
  is_active: boolean;
  expires_at: string | null;
}

interface UserInfo {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

// "Online" if active within the last 5 minutes
const ONLINE_THRESHOLD_MIN = 5;

const ManageSessions: React.FC = () => {
  const { user, session, signOut } = useAuth();
  const { effectiveUserId, effectiveRole } = useEffectiveUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'idle'>('all');
  // Tick every 30s so "time ago" stays fresh
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleSignOutCurrentSession = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const fetchSessions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (effectiveRole !== 'admin') {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const allSessions = data || [];
      setSessions(allSessions);

      if (user && session?.access_token) {
        const exactMatch = allSessions.find((s) => s.session_token === session.access_token);
        if (exactMatch) {
          setCurrentSessionId(exactMatch.id);
        } else {
          const userSessions = allSessions
            .filter((s) => s.user_id === user.id)
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          if (userSessions.length > 0) {
            setCurrentSessionId(userSessions[0].id);
          }
        }
      }

      const userIds = [...new Set(allSessions.map((s) => s.user_id))];
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name, role')
          .in('id', userIds);

        if (!usersError && usersData) {
          const map: Record<string, UserInfo> = {};
          usersData.forEach((u) => {
            map[u.id] = u;
          });
          setUsersMap(map);
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveUserId, effectiveRole]);

  const terminateSession = async (sessionId: string, _sessionToken: string) => {
    setTerminatingId(sessionId);
    try {
      const { error } = await supabase.functions.invoke('terminate-session', {
        body: { sessionId },
      });
      if (error) throw error;
      toast.success('Session terminated successfully');
      fetchSessions();
    } catch (error) {
      console.error('Error terminating session:', error);
      toast.error('Failed to terminate session');
    } finally {
      setTerminatingId(null);
    }
  };

  // -------- Helpers (device, browser, online) --------

  const isOnline = (lastActivity: string) =>
    differenceInMinutes(new Date(), new Date(lastActivity)) < ONLINE_THRESHOLD_MIN;

  const getDeviceType = (userAgent: string | null): 'mobile' | 'tablet' | 'desktop' | 'unknown' => {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) return 'tablet';
    if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) return 'mobile';
    return 'desktop';
  };

  const getDeviceIcon = (userAgent: string | null) => {
    const t = getDeviceType(userAgent);
    if (t === 'mobile') return <Smartphone className="icon-lg" />;
    if (t === 'tablet') return <Tablet className="icon-lg" />;
    if (t === 'desktop') return <Monitor className="icon-lg" />;
    return <Globe className="icon-lg" />;
  };

  const getDeviceName = (userAgent: string | null): string => {
    if (!userAgent) return 'Unknown Device';
    const ua = userAgent.toLowerCase();
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('android')) return ua.includes('mobile') ? 'Android Phone' : 'Android Tablet';
    if (ua.includes('windows')) return 'Windows PC';
    if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
    if (ua.includes('linux')) return 'Linux PC';
    if (ua.includes('chromeos')) return 'Chromebook';
    return 'Desktop';
  };

  const getBrowserInfo = (userAgent: string | null): string => {
    if (!userAgent) return 'Unknown Browser';
    if (userAgent.includes('Edg/') || userAgent.includes('Edge/')) return 'Microsoft Edge';
    if (userAgent.includes('OPR/') || userAgent.includes('Opera')) return 'Opera';
    if (userAgent.includes('Firefox/')) return 'Mozilla Firefox';
    if (userAgent.includes('Chrome/')) return 'Google Chrome';
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) return 'Safari';
    return 'Unknown Browser';
  };

  const isCurrentSession = (sessionId: string) => currentSessionId === sessionId;

  const getUserInitials = (u: UserInfo | undefined): string => {
    if (!u) return '?';
    const first = u.first_name?.charAt(0) || '';
    const last = u.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || u.email.charAt(0).toUpperCase();
  };

  const getUserDisplayName = (u: UserInfo | undefined): string => {
    if (!u) return 'Unknown User';
    if (u.first_name || u.last_name) return `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return u.email;
  };

  const formatDuration = (createdAt: string) => {
    const seconds = differenceInSeconds(new Date(), new Date(createdAt));
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return remH ? `${days}d ${remH}h` : `${days}d`;
  };

  // -------- Stats + Filtering --------

  const stats = useMemo(() => {
    const onlineSessions = sessions.filter((s) => isOnline(s.last_activity));
    const uniqueUsers = new Set(sessions.map((s) => s.user_id)).size;
    const onlineUsers = new Set(onlineSessions.map((s) => s.user_id)).size;
    const desktops = sessions.filter((s) => getDeviceType(s.user_agent) === 'desktop').length;
    const mobiles = sessions.filter((s) =>
      ['mobile', 'tablet'].includes(getDeviceType(s.user_agent))
    ).length;
    const admins = sessions.filter((s) => usersMap[s.user_id]?.role === 'admin').length;
    return {
      total: sessions.length,
      online: onlineSessions.length,
      idle: sessions.length - onlineSessions.length,
      uniqueUsers,
      onlineUsers,
      desktops,
      mobiles,
      admins,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, usersMap]);

  const filteredSessions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sessions.filter((s) => {
      if (statusFilter === 'online' && !isOnline(s.last_activity)) return false;
      if (statusFilter === 'idle' && isOnline(s.last_activity)) return false;
      if (!term) return true;
      const u = usersMap[s.user_id];
      const haystack = [
        u?.email,
        u?.first_name,
        u?.last_name,
        u?.role,
        s.ip_address,
        getDeviceName(s.user_agent),
        getBrowserInfo(s.user_agent),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, usersMap, searchTerm, statusFilter]);

  // -------- Render --------

  const headerActions = (
    <div className="flex items-center gap-2">
      <BackToMembersButton />
      <Button variant="outline" onClick={fetchSessions} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );

  const StatCard = ({
    label,
    value,
    icon: Icon,
    accent,
  }: {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${accent}`}>
          <Icon className="icon-lg" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout
      title="Manage Sessions"
      description="Monitor live user activity and manage active sessions across devices"
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard
            label="Total Sessions"
            value={stats.total}
            icon={Activity}
            accent="bg-primary/10 text-primary"
          />
          <StatCard
            label="Online Now"
            value={stats.online}
            icon={Wifi}
            accent="bg-success/10 text-success dark:bg-emerald-900/30 dark:text-emerald-300"
          />
          <StatCard
            label="Idle"
            value={stats.idle}
            icon={WifiOff}
            accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          />
          {effectiveRole === 'admin' && (
            <>
              <StatCard
                label="Users Logged In"
                value={stats.uniqueUsers}
                icon={Users}
                accent="bg-info/10 text-info dark:bg-blue-900/30 dark:text-blue-300"
              />
              <StatCard
                label="Users Online"
                value={stats.onlineUsers}
                icon={Users}
                accent="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
              />
              <StatCard
                label="Desktops"
                value={stats.desktops}
                icon={Monitor}
                accent="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
              />
              <StatCard
                label="Admins"
                value={stats.admins}
                icon={ShieldCheck}
                accent="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
              />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="icon-lg" />
                  Active Sessions
                </CardTitle>
                <CardDescription>
                  Showing {filteredSessions.length} of {sessions.length} session
                  {sessions.length !== 1 ? 's' : ''}
                  {' · Online = active within last '}
                  {ONLINE_THRESHOLD_MIN} min
                </CardDescription>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search user, IP, device..."
                    className="pl-8 w-full sm:w-64"
                  />
                </div>
                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="online">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 inline-block animate-pulse" />
                      Online
                    </TabsTrigger>
                    <TabsTrigger value="idle">Idle</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12">
                <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {sessions.length === 0
                    ? 'No active sessions found'
                    : 'No sessions match your filters'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {sessions.length === 0
                    ? 'Sessions will appear here after users log in'
                    : 'Try adjusting search or status filter'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((sess) => {
                  const userInfo = usersMap[sess.user_id];
                  const online = isOnline(sess.last_activity);
                  const current = isCurrentSession(sess.id);
                  return (
                    <div
                      key={sess.id}
                      className={`grid grid-cols-12 gap-4 p-4 rounded-lg border transition-colors items-start ${
                        current
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      {/* Device Icon + Online indicator */}
                      <div className="col-span-1 flex justify-center">
                        <div className="relative">
                          <div className="p-3 rounded-lg bg-muted">
                            {getDeviceIcon(sess.user_agent)}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                              online ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                            }`}
                            title={online ? 'Online' : 'Idle'}
                          />
                        </div>
                      </div>

                      {/* Device & Browser */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{getDeviceName(sess.user_agent)}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              online
                                ? 'bg-success/10 text-success dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {online ? 'Online' : 'Idle'}
                          </Badge>
                          {current && (
                            <Badge variant="default" className="text-xs bg-blue-500 hover:bg-blue-600">
                              Current
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground mt-1 block">
                          {getBrowserInfo(sess.user_agent)}
                        </span>
                        {sess.ip_address && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Globe className="icon-xs" />
                            {sess.ip_address}
                          </span>
                        )}
                      </div>

                      {/* User Info */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getUserInitials(userInfo)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {getUserDisplayName(userInfo)}
                              </span>
                              {userInfo?.role && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs capitalize ${
                                    userInfo.role === 'admin'
                                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                                      : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                  }`}
                                >
                                  {userInfo.role}
                                </Badge>
                              )}
                            </div>
                            {userInfo?.email && (userInfo.first_name || userInfo.last_name) && (
                              <span className="text-xs text-muted-foreground truncate block">
                                {userInfo.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Activity Timing */}
                      <div className="col-span-4">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Last Activity</p>
                            <p className="font-medium flex items-center gap-1">
                              <Clock className="icon-xs" />
                              {formatDistanceToNow(new Date(sess.last_activity), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Logged In For</p>
                            <p className="font-medium">{formatDuration(sess.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Started</p>
                            <p className="font-medium">
                              {new Date(sess.created_at).toLocaleString()}
                            </p>
                          </div>
                          {sess.expires_at && (
                            <div>
                              <p className="text-muted-foreground">Expires</p>
                              <p className="font-medium">
                                {formatDistanceToNow(new Date(sess.expires_at), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      <div className="col-span-1 flex justify-end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={terminatingId === sess.id}
                            >
                              {terminatingId === sess.id ? (
                                <>
                                  <RefreshCw className="icon-md mr-1 animate-spin" />
                                  ...
                                </>
                              ) : (
                                <>
                                  <LogOut className="icon-md mr-1" />
                                  Sign Out
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-background">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {current
                                  ? 'Sign out of your current session?'
                                  : 'Sign out this session?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {current
                                  ? 'You will be logged out immediately and redirected to the login page.'
                                  : "This will sign out this session. The user will need to sign in again from that device."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() =>
                                  current
                                    ? handleSignOutCurrentSession()
                                    : terminateSession(sess.id, sess.session_token)
                                }
                              >
                                Sign Out
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ManageSessions;
