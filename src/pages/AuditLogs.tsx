import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft,
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
  Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

const AuditLogs: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
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
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'authentication':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'user_management':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'data_access':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const handleSearch = () => {
    setPage(0);
    fetchLogs();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground">
              {userProfile?.role === 'admin' ? 'View all security and activity logs' : 'View your activity logs'}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div>
                <CardTitle>Activity History</CardTitle>
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
                  <SelectTrigger className="w-40">
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
                <Button variant="outline" onClick={fetchLogs} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No audit logs found</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      {getEventIcon(log.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {log.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <Badge variant="outline" className={getCategoryColor(log.event_category)}>
                          {log.event_category.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      {log.description && (
                        <p className="text-sm text-muted-foreground mt-1">{log.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{formatDate(log.created_at)}</span>
                        {log.ip_address && <span>IP: {log.ip_address}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalCount > pageSize && (
              <div className="flex justify-center gap-2 mt-6">
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
    </div>
  );
};

export default AuditLogs;
