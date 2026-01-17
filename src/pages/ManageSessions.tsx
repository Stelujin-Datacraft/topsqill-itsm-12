import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Monitor, 
  Smartphone, 
  Globe, 
  Clock, 
  LogOut, 
  RefreshCw,
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

const ManageSessions: React.FC = () => {
  const { user, session, userProfile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Admins see all sessions, users only their own
      let query = supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (userProfile?.role !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions(data || []);

      // Fetch user info for all unique user IDs
      const userIds = [...new Set((data || []).map(s => s.user_id))];
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name, role')
          .in('id', userIds);

        if (!usersError && usersData) {
          const map: Record<string, UserInfo> = {};
          usersData.forEach(u => { map[u.id] = u; });
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
  }, [user, userProfile]);

  const terminateSession = async (sessionId: string, sessionToken: string) => {
    setTerminatingId(sessionId);
    try {
      // Call edge function to terminate the session
      const { data, error } = await supabase.functions.invoke('terminate-session', {
        body: { sessionId }
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

  const terminateAllOtherSessions = async () => {
    try {
      const currentSessionToken = session?.access_token;
      
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .neq('session_token', currentSessionToken || '');

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        event_type: 'all_sessions_terminated',
        event_category: 'security',
        description: 'User terminated all other sessions'
      });

      toast.success('All other sessions terminated');
      fetchSessions();
    } catch (error) {
      console.error('Error terminating sessions:', error);
      toast.error('Failed to terminate sessions');
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Globe className="h-5 w-5" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const getBrowserInfo = (userAgent: string | null): string => {
    if (!userAgent) return 'Unknown browser';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown browser';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const isCurrentSession = (sessionToken: string) => {
    return session?.access_token === sessionToken;
  };

  const getUserInitials = (userInfo: UserInfo | undefined): string => {
    if (!userInfo) return '?';
    const first = userInfo.first_name?.charAt(0) || '';
    const last = userInfo.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || userInfo.email.charAt(0).toUpperCase();
  };

  const getUserDisplayName = (userInfo: UserInfo | undefined): string => {
    if (!userInfo) return 'Unknown User';
    if (userInfo.first_name || userInfo.last_name) {
      return `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim();
    }
    return userInfo.email;
  };

  const headerActions = (
    <Button variant="outline" onClick={fetchSessions} disabled={loading}>
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  );

  return (
    <DashboardLayout title="Manage Sessions" actions={headerActions}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">View and manage your active sessions across devices</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active sessions found</p>
                <p className="text-sm text-muted-foreground mt-1">Sessions will appear here after you log in</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((sess) => {
                  const userInfo = usersMap[sess.user_id];
                  return (
                  <div
                    key={sess.id}
                    className={`grid grid-cols-12 gap-4 p-4 rounded-lg border transition-colors items-start ${
                      isCurrentSession(sess.session_token)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {/* Device Icon */}
                    <div className="col-span-1 flex justify-center">
                      <div className="p-3 rounded-lg bg-muted">
                        {getDeviceIcon(sess.user_agent)}
                      </div>
                    </div>
                    
                    {/* Device & Browser */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getBrowserInfo(sess.user_agent)}
                        </span>
                        {isCurrentSession(sess.session_token) && (
                          <Badge variant="default" className="text-xs bg-emerald-500 hover:bg-emerald-600">
                            Current
                          </Badge>
                        )}
                      </div>
                      {sess.ip_address && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Globe className="h-3 w-3" />
                          {sess.ip_address}
                        </span>
                      )}
                    </div>
                    
                    {/* User Info */}
                    <div className="col-span-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getUserInitials(userInfo)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{getUserDisplayName(userInfo)}</span>
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
                            <span className="text-xs text-muted-foreground">{userInfo.email}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Timestamps */}
                    <div className="col-span-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Last: {formatDate(sess.last_activity)}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {formatDate(sess.created_at)}
                      </p>
                    </div>
                    
                    {/* Action */}
                    <div className="col-span-1 flex justify-end">
                      {!isCurrentSession(sess.session_token) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={terminatingId === sess.id}
                            >
                              {terminatingId === sess.id ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                  Signing Out...
                                </>
                              ) : (
                                <>
                                  <LogOut className="h-4 w-4 mr-1" />
                                  Sign Out
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-background">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Sign out this session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will sign you out from this device. You'll need to sign in again to access your account from that device.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => terminateSession(sess.id, sess.session_token)}
                              >
                                Sign Out
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
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
