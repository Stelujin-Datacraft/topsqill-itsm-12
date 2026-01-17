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
          .select('id, email, first_name, last_name')
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
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        event_type: 'session_terminated',
        event_category: 'security',
        description: 'User terminated a session',
        metadata: { session_id: sessionId }
      });

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
    <div className="flex gap-2">
      <Button variant="outline" onClick={fetchSessions} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      {sessions.length > 1 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out all other sessions
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out all other sessions?</AlertDialogTitle>
              <AlertDialogDescription>
                This will sign you out from all other devices and browsers. Your current session will remain active.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={terminateAllOtherSessions}>
                Sign out all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
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
                    className={`p-4 rounded-lg border transition-colors ${
                      isCurrentSession(sess.session_token)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-muted">
                          {getDeviceIcon(sess.user_agent)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {getBrowserInfo(sess.user_agent)}
                            </span>
                            {isCurrentSession(sess.session_token) && (
                              <Badge variant="default" className="text-xs">
                                Current Session
                              </Badge>
                            )}
                          </div>
                          
                          {/* User Info */}
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getUserInitials(userInfo)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{getUserDisplayName(userInfo)}</span>
                              {userInfo?.email && (userInfo.first_name || userInfo.last_name) && (
                                <span className="text-xs text-muted-foreground">{userInfo.email}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                            {sess.ip_address && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {sess.ip_address}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last active: {formatDate(sess.last_activity)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created: {formatDate(sess.created_at)}
                          </p>
                        </div>
                      </div>
                      {!isCurrentSession(sess.session_token) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={terminatingId === sess.id}
                            >
                              {terminatingId === sess.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <LogOut className="h-4 w-4 mr-1" />
                                  Sign out
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
                                onClick={() => terminateSession(sess.id, sess.session_token)}
                              >
                                Sign out
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
