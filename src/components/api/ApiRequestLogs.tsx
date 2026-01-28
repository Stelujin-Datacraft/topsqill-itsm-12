import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, Filter, Download, RefreshCw, Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface ApiRequestLog {
  id: string;
  api_key_id: string | null;
  organization_id: string;
  endpoint: string;
  method: string;
  request_body: any;
  response_status: number | null;
  response_time_ms: number | null;
  ip_address: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
}

const PAGE_SIZE = 50;

export function ApiRequestLogs() {
  const { userProfile } = useAuth();
  const [logs, setLogs] = useState<ApiRequestLog[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date()
  });
  const [selectedApiKey, setSelectedApiKey] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchEndpoint, setSearchEndpoint] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Detail view
  const [selectedLog, setSelectedLog] = useState<ApiRequestLog | null>(null);

  // Fetch API keys for filter dropdown
  const fetchApiKeys = useCallback(async () => {
    if (!userProfile?.organization_id) return;

    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix')
      .eq('organization_id', userProfile.organization_id);

    setApiKeys(data || []);
  }, [userProfile?.organization_id]);

  const fetchLogs = useCallback(async () => {
    if (!userProfile?.organization_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('api_request_logs')
        .select('*', { count: 'exact' })
        .eq('organization_id', userProfile.organization_id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }
      if (selectedApiKey !== 'all') {
        query = query.eq('api_key_id', selectedApiKey);
      }
      if (selectedMethod !== 'all') {
        query = query.eq('method', selectedMethod);
      }
      if (selectedStatus === 'success') {
        query = query.lt('response_status', 400);
      } else if (selectedStatus === 'error') {
        query = query.gte('response_status', 400);
      }
      if (searchEndpoint) {
        query = query.ilike('endpoint', `%${searchEndpoint}%`);
      }

      // Pagination
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch request logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [userProfile?.organization_id, dateRange, selectedApiKey, selectedMethod, selectedStatus, searchEndpoint, currentPage]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    if (!userProfile?.organization_id) return;

    try {
      let query = supabase
        .from('api_request_logs')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('created_at', { ascending: false });

      // Apply same filters as current view
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }
      if (selectedApiKey !== 'all') {
        query = query.eq('api_key_id', selectedApiKey);
      }
      if (selectedMethod !== 'all') {
        query = query.eq('method', selectedMethod);
      }
      if (selectedStatus === 'success') {
        query = query.lt('response_status', 400);
      } else if (selectedStatus === 'error') {
        query = query.gte('response_status', 400);
      }
      if (searchEndpoint) {
        query = query.ilike('endpoint', `%${searchEndpoint}%`);
      }

      const { data, error } = await query.limit(1000);

      if (error) throw error;

      // Convert to CSV
      const headers = ['Timestamp', 'Method', 'Endpoint', 'Status', 'Response Time (ms)', 'IP Address', 'Error'];
      const rows = (data || []).map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.method,
        log.endpoint,
        log.response_status?.toString() || '',
        log.response_time_ms?.toString() || '',
        log.ip_address || '',
        log.error_message || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `api-request-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      toast({
        title: 'Export Complete',
        description: `Exported ${data?.length || 0} records`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export request logs',
        variant: 'destructive'
      });
    }
  };

  const clearFilters = () => {
    setDateRange({ from: subDays(new Date(), 7), to: new Date() });
    setSelectedApiKey('all');
    setSelectedMethod('all');
    setSelectedStatus('all');
    setSearchEndpoint('');
    setCurrentPage(1);
  };

  const getStatusBadge = (status: number | null) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    if (status < 300) return <Badge className="bg-green-600">{status}</Badge>;
    if (status < 400) return <Badge variant="secondary">{status}</Badge>;
    if (status < 500) return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="destructive">{status}</Badge>;
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-green-600',
      POST: 'bg-blue-600',
      PUT: 'bg-yellow-600',
      DELETE: 'bg-red-600',
      PATCH: 'bg-purple-600'
    };
    return <Badge className={colors[method] || 'bg-gray-600'}>{method}</Badge>;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getApiKeyName = (apiKeyId: string | null) => {
    if (!apiKeyId) return 'Unknown';
    const key = apiKeys.find(k => k.id === apiKeyId);
    return key?.name || key?.key_prefix || 'Unknown';
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by endpoint..."
                  value={searchEndpoint}
                  onChange={(e) => {
                    setSearchEndpoint(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[240px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM d, yyyy')
                    )
                  ) : (
                    'Select date range'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    setCurrentPage(1);
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {/* Toggle Filters */}
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-accent')}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>

            {/* Refresh */}
            <Button variant="outline" onClick={() => fetchLogs()}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>

            {/* Export */}
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Select value={selectedApiKey} onValueChange={(v) => { setSelectedApiKey(v); setCurrentPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Keys" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Keys</SelectItem>
                    {apiKeys.map(key => (
                      <SelectItem key={key.id} value={key.id}>{key.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>HTTP Method</Label>
                <Select value={selectedMethod} onValueChange={(v) => { setSelectedMethod(v); setCurrentPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Success (2xx, 3xx)</SelectItem>
                    <SelectItem value="error">Errors (4xx, 5xx)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button variant="ghost" onClick={clearFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Request Logs</CardTitle>
              <CardDescription>
                {totalCount.toLocaleString()} total requests
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No request logs found matching your filters
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                        </TableCell>
                        <TableCell className="text-sm max-w-[120px] truncate">
                          {getApiKeyName(log.api_key_id)}
                        </TableCell>
                        <TableCell>{getMethodBadge(log.method)}</TableCell>
                        <TableCell className="font-mono text-sm max-w-[200px] truncate">
                          {log.endpoint}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.response_status)}</TableCell>
                        <TableCell className="text-sm">
                          {log.response_time_ms !== null ? `${log.response_time_ms}ms` : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.ip_address || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              {selectedLog && format(new Date(selectedLog.created_at), 'MMMM d, yyyy HH:mm:ss')}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Method</Label>
                  <p className="mt-1">{getMethodBadge(selectedLog.method)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="mt-1">{getStatusBadge(selectedLog.response_status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Response Time</Label>
                  <p className="mt-1 font-medium">
                    {selectedLog.response_time_ms !== null ? `${selectedLog.response_time_ms}ms` : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP Address</Label>
                  <p className="mt-1 font-mono text-sm">{selectedLog.ip_address || 'N/A'}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Endpoint</Label>
                <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {selectedLog.endpoint}
                </code>
              </div>

              <div>
                <Label className="text-muted-foreground">API Key</Label>
                <p className="mt-1">{getApiKeyName(selectedLog.api_key_id)}</p>
              </div>

              {selectedLog.user_agent && (
                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <p className="mt-1 text-sm text-muted-foreground break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <Label className="text-muted-foreground text-destructive">Error Message</Label>
                  <code className="block mt-1 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive break-all">
                    {selectedLog.error_message}
                  </code>
                </div>
              )}

              {selectedLog.request_body && (
                <div>
                  <Label className="text-muted-foreground">Request Body</Label>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs font-mono overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.request_body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
