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
  FileText,
  Plus,
  Edit,
  Trash2,
  Copy,
  Settings,
  Users,
  Archive,
  Filter,
  ClipboardList,
  ArrowUpDown,
  Globe
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface FormAuditLog {
  id: string;
  user_id: string | null;
  event_type: string;
  form_id: string | null;
  form_name: string | null;
  field_id: string | null;
  field_label: string | null;
  description: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string;
}

interface UserInfo {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface FormInfo {
  id: string;
  name: string;
}

const FormAuditLogs: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [logs, setLogs] = useState<FormAuditLog[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserInfo>>({});
  const [formsMap, setFormsMap] = useState<Record<string, FormInfo>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [formFilter, setFormFilter] = useState<string>('all');
  const [availableForms, setAvailableForms] = useState<FormInfo[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('form_audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Non-admins can only see their own logs
      if (userProfile?.role !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      if (eventFilter !== 'all') {
        query = query.eq('event_type', eventFilter);
      }

      if (formFilter !== 'all') {
        query = query.eq('form_id', formFilter);
      }

      if (searchTerm) {
        query = query.or(`event_type.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,form_name.ilike.%${searchTerm}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      const typedLogs = (data || []).map(log => ({
        ...log,
        changes: log.changes as FormAuditLog['changes'],
        metadata: log.metadata as FormAuditLog['metadata']
      }));

      setLogs(typedLogs);
      setTotalCount(count || 0);

      // Fetch user info for all unique user IDs
      const userIds = [...new Set(typedLogs.filter(l => l.user_id).map(l => l.user_id as string))];
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

      // Fetch form info for all unique form IDs
      const formIds = [...new Set(typedLogs.filter(l => l.form_id).map(l => l.form_id as string))];
      if (formIds.length > 0) {
        const { data: formsData, error: formsError } = await supabase
          .from('forms')
          .select('id, name')
          .in('id', formIds);

        if (!formsError && formsData) {
          const map: Record<string, FormInfo> = {};
          formsData.forEach(f => { map[f.id] = f; });
          setFormsMap(map);
        }
      }
    } catch (error) {
      console.error('Error fetching form audit logs:', error);
      toast.error('Failed to load form audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableForms = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('forms')
        .select('id, name')
        .order('name');

      if (!error && data) {
        setAvailableForms(data);
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchAvailableForms();
  }, [user, page, eventFilter, formFilter]);

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('created')) return <Plus className="h-4 w-4" />;
    if (eventType.includes('updated') || eventType.includes('changed')) return <Edit className="h-4 w-4" />;
    if (eventType.includes('deleted')) return <Trash2 className="h-4 w-4" />;
    if (eventType.includes('duplicated')) return <Copy className="h-4 w-4" />;
    if (eventType.includes('published')) return <Globe className="h-4 w-4" />;
    if (eventType.includes('archived')) return <Archive className="h-4 w-4" />;
    if (eventType.includes('settings')) return <Settings className="h-4 w-4" />;
    if (eventType.includes('permission') || eventType.includes('access')) return <Users className="h-4 w-4" />;
    if (eventType.includes('reorder')) return <ArrowUpDown className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getEventColor = (eventType: string) => {
    if (eventType.includes('created')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    if (eventType.includes('deleted')) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (eventType.includes('updated') || eventType.includes('changed')) return 'bg-primary/10 text-primary border-primary/20';
    if (eventType.includes('duplicated')) return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800';
    if (eventType.includes('permission') || eventType.includes('access')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    return 'bg-muted text-muted-foreground border-border';
  };

  const formatEventType = (eventType: string): string => {
    const eventLabels: Record<string, string> = {
      'form_created': 'Created',
      'form_updated': 'Updated',
      'form_deleted': 'Deleted',
      'form_duplicated': 'Duplicated',
      'form_published': 'Published',
      'form_archived': 'Archived',
      'form_field_added': 'Field Added',
      'form_field_updated': 'Field Updated',
      'form_field_deleted': 'Field Deleted',
      'form_fields_reordered': 'Fields Reordered',
      'form_settings_changed': 'Settings Changed',
      'form_permissions_changed': 'Permissions Changed',
      'form_access_granted': 'Access Granted',
      'form_access_revoked': 'Access Revoked',
    };
    return eventLabels[eventType] || eventType.replace('form_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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

  const getFormName = (log: FormAuditLog): string => {
    if (log.form_name) return log.form_name;
    if (log.form_id && formsMap[log.form_id]) {
      return formsMap[log.form_id].name;
    }
    return 'Unknown Form';
  };

  const handleSearch = () => {
    setPage(0);
    fetchLogs();
  };

  const eventTypes = [
    { value: 'all', label: 'All Events' },
    { value: 'form_created', label: 'Form Created' },
    { value: 'form_updated', label: 'Form Updated' },
    { value: 'form_deleted', label: 'Form Deleted' },
    { value: 'form_duplicated', label: 'Form Duplicated' },
    { value: 'form_published', label: 'Form Published' },
    { value: 'form_archived', label: 'Form Archived' },
    { value: 'form_field_added', label: 'Field Added' },
    { value: 'form_field_updated', label: 'Field Updated' },
    { value: 'form_field_deleted', label: 'Field Deleted' },
    { value: 'form_fields_reordered', label: 'Fields Reordered' },
    { value: 'form_settings_changed', label: 'Settings Changed' },
    { value: 'form_permissions_changed', label: 'Permissions Changed' },
    { value: 'form_access_granted', label: 'Access Granted' },
    { value: 'form_access_revoked', label: 'Access Revoked' },
  ];

  const headerActions = (
    <Button variant="outline" onClick={fetchLogs} disabled={loading}>
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  );

  return (
    <DashboardLayout title="Form History" actions={headerActions}>
      <div className="space-y-6">
        <p className="text-muted-foreground">
          {userProfile?.role === 'admin' ? 'View all form changes and activity across the organization' : 'View your form activity history'}
        </p>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Form Activity History
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
                <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-44">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map(et => (
                      <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={formFilter} onValueChange={(v) => { setFormFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-44">
                    <FileText className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Forms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Forms</SelectItem>
                    {availableForms.map(form => (
                      <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                    ))}
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
                <p className="text-muted-foreground">No form activity logs found</p>
                <p className="text-sm text-muted-foreground mt-1">Activity logs will appear here as form changes occur</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const userInfo = log.user_id ? usersMap[log.user_id] : undefined;
                  return (
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
                            {formatEventType(log.event_type)}
                          </span>
                          <Badge variant="outline" className={getEventColor(log.event_type)}>
                            {getFormName(log)}
                          </Badge>
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
                        
                        {log.description && (
                          <p className="text-sm text-muted-foreground mt-2">{log.description}</p>
                        )}

                        {/* Show field info if available */}
                        {log.field_label && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Field: <span className="font-medium">{log.field_label}</span>
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{formatDate(log.created_at)}</span>
                        </div>
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

export default FormAuditLogs;
