import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import {
  RefreshCw,
  Search,
  Shield,
  LogIn,
  LogOut,
  Key,
  AlertTriangle,
  User,
  Settings,
  FileText,
  Filter,
  ClipboardList
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface AuditLog {
  id: string;
  user_id: string | null;
  event_type: string;
  event_category: string;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: unknown;
  created_at: string;
}

interface UserInfo {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

const AuditLogs: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Non-admins can only see their own logs
      if (userProfile?.role !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('event_category', categoryFilter);
      }

      if (searchTerm) {
        query = query.or(`event_type.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);

      // Fetch user info for all unique user IDs
      const userIds = [...new Set((data || []).filter(l => l.user_id).map(l => l.user_id as string))];
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
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user, page, categoryFilter]);

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('login')) return <LogIn className="h-4 w-4" />;
    if (eventType.includes('logout')) return <LogOut className="h-4 w-4" />;
    if (eventType.includes('password')) return <Key className="h-4 w-4" />;
    if (eventType.includes('mfa') || eventType.includes('security')) return <Shield className="h-4 w-4" />;
    if (eventType.includes('user')) return <User className="h-4 w-4" />;
    if (eventType.includes('setting')) return <Settings className="h-4 w-4" />;
    if (eventType.includes('session')) return <AlertTriangle className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'authentication':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'user_management':
        return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800';
      case 'data_access':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getUserInitials = (userInfo: UserInfo | undefined): string => {
    if (!userInfo) return '?';
    const first = userInfo.first_name?.charAt(0) || '';
    const last = userInfo.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || userInfo.email.charAt(0).toUpperCase();
  };

  const getUserDisplayName = (userInfo: UserInfo | undefined): string => {
    if (!userInfo) return 'System';
    if (userInfo.first_name || userInfo.last_name) {
      return `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim();
    }
    return userInfo.email;
  };

  const handleSearch = () => {
    setPage(0);
    fetchLogs();
  };

  const headerActions = (
    <Button variant="outline" onClick={fetchLogs} disabled={loading}>
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  );

  return (
    <DashboardLayout title="Audit Logs" actions={headerActions}>
      <div className="space-y-6">
        <p className="text-muted-foreground">
          {userProfile?.role === 'admin' ? 'View all security and activity logs across the organization' : 'View your activity logs'}
        </p>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Activity History
                </CardTitle>
                <CardDescription>
                  {totalCount} total event{totalCount !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-48"
                  />
                  <Button variant="outline" size="icon" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-44">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                    <SelectItem value="user_management">User Management</SelectItem>
                    <SelectItem value="data_access">Data Access</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No audit logs found</p>
                <p className="text-sm text-muted-foreground mt-1">Activity logs will appear here as events occur</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const userInfo = log.user_id ? usersMap[log.user_id] : undefined;
                  return (
                  <div
                    key={log.id}
                    className="grid grid-cols-12 gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors items-start"
                  >
                    {/* Icon */}
                    <div className="col-span-1 flex justify-center">
                      <div className="p-2 rounded-lg bg-muted">
                        {getEventIcon(log.event_type)}
                      </div>
                    </div>
                    
                    {/* Event Type & Category */}
                    <div className="col-span-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {log.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <Badge variant="outline" className={`mt-1 ${getCategoryColor(log.event_category)}`}>
                        {log.event_category.replace(/_/g, ' ')}
                      </Badge>
                      {log.description && (
                        <p className="text-sm text-muted-foreground mt-2">{log.description}</p>
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
                    
                    {/* Timestamp & IP */}
                    <div className="col-span-3 text-right">
                      <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                      {log.ip_address && (
                        <p className="text-xs text-muted-foreground mt-1">IP: {log.ip_address}</p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {totalCount > pageSize && (
              <div className="flex justify-center gap-2 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {page + 1} of {Math.ceil(totalCount / pageSize)}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * pageSize >= totalCount || loading}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;
