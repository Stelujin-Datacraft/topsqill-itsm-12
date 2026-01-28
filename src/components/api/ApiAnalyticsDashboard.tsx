import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Clock, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, subHours, startOfDay, startOfHour } from 'date-fns';

interface AnalyticsData {
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  errorCount: number;
  requestsByDay: { date: string; count: number; errors: number }[];
  requestsByEndpoint: { endpoint: string; count: number }[];
  requestsByMethod: { method: string; count: number }[];
  responseTimeDistribution: { range: string; count: number }[];
}

type TimeRange = '24h' | '7d' | '30d';

export function ApiAnalyticsDashboard() {
  const { userProfile } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!userProfile?.organization_id) return;

    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case '24h':
          startDate = subHours(now, 24);
          break;
        case '7d':
          startDate = subDays(now, 7);
          break;
        case '30d':
          startDate = subDays(now, 30);
          break;
      }

      const { data: logs, error } = await supabase
        .from('api_request_logs')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Process analytics data
      const totalRequests = logs?.length || 0;
      const successfulRequests = logs?.filter(l => l.response_status && l.response_status < 400).length || 0;
      const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
      const errorCount = logs?.filter(l => l.response_status && l.response_status >= 400).length || 0;
      const avgResponseTime = totalRequests > 0
        ? (logs?.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) || 0) / totalRequests
        : 0;

      // Group by day
      const dayGroups: Record<string, { count: number; errors: number }> = {};
      logs?.forEach(log => {
        const date = format(startOfDay(new Date(log.created_at)), 'MMM dd');
        if (!dayGroups[date]) {
          dayGroups[date] = { count: 0, errors: 0 };
        }
        dayGroups[date].count++;
        if (log.response_status && log.response_status >= 400) {
          dayGroups[date].errors++;
        }
      });
      const requestsByDay = Object.entries(dayGroups).map(([date, data]) => ({
        date,
        count: data.count,
        errors: data.errors
      }));

      // Group by endpoint
      const endpointGroups: Record<string, number> = {};
      logs?.forEach(log => {
        const endpoint = log.endpoint || 'Unknown';
        endpointGroups[endpoint] = (endpointGroups[endpoint] || 0) + 1;
      });
      const requestsByEndpoint = Object.entries(endpointGroups)
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Group by method
      const methodGroups: Record<string, number> = {};
      logs?.forEach(log => {
        const method = log.method || 'Unknown';
        methodGroups[method] = (methodGroups[method] || 0) + 1;
      });
      const requestsByMethod = Object.entries(methodGroups)
        .map(([method, count]) => ({ method, count }));

      // Response time distribution
      const timeRanges = [
        { range: '<100ms', min: 0, max: 100 },
        { range: '100-500ms', min: 100, max: 500 },
        { range: '500ms-1s', min: 500, max: 1000 },
        { range: '>1s', min: 1000, max: Infinity }
      ];
      const responseTimeDistribution = timeRanges.map(({ range, min, max }) => ({
        range,
        count: logs?.filter(l => {
          const time = l.response_time_ms || 0;
          return time >= min && time < max;
        }).length || 0
      }));

      setAnalytics({
        totalRequests,
        successRate,
        avgResponseTime,
        errorCount,
        requestsByDay,
        requestsByEndpoint,
        requestsByMethod,
        responseTimeDistribution
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.organization_id, timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const chartConfig = {
    count: { label: 'Requests', color: 'hsl(var(--primary))' },
    errors: { label: 'Errors', color: 'hsl(var(--destructive))' }
  };

  const METHOD_COLORS: Record<string, string> = {
    GET: 'hsl(142, 76%, 36%)',
    POST: 'hsl(217, 91%, 60%)',
    PUT: 'hsl(45, 93%, 47%)',
    DELETE: 'hsl(0, 84%, 60%)',
    PATCH: 'hsl(280, 87%, 65%)'
  };

  if (loading && !analytics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Activity className="h-6 w-6 animate-pulse text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Usage Analytics</h3>
          <p className="text-sm text-muted-foreground">Monitor your API usage and performance</p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analytics?.totalRequests.toLocaleString() || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              In the selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {(analytics?.successRate || 0) >= 95 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Success Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analytics?.successRate.toFixed(1) || 100}%</p>
            <Badge 
              variant={(analytics?.successRate || 100) >= 95 ? 'default' : 'destructive'}
              className={(analytics?.successRate || 100) >= 95 ? 'bg-green-600 mt-1' : 'mt-1'}
            >
              {(analytics?.successRate || 100) >= 99 ? 'Excellent' : 
               (analytics?.successRate || 100) >= 95 ? 'Good' : 'Needs Attention'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Response Time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{Math.round(analytics?.avgResponseTime || 0)}ms</p>
            <Badge 
              variant={(analytics?.avgResponseTime || 0) <= 500 ? 'default' : 'secondary'}
              className={(analytics?.avgResponseTime || 0) <= 500 ? 'bg-green-600 mt-1' : 'mt-1'}
            >
              {(analytics?.avgResponseTime || 0) <= 200 ? 'Fast' : 
               (analytics?.avgResponseTime || 0) <= 500 ? 'Normal' : 'Slow'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{analytics?.errorCount || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Failed requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests Over Time</CardTitle>
            <CardDescription>Daily API request volume</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.requestsByDay && analytics.requestsByDay.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <AreaChart data={analytics.requestsByDay}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="hsl(var(--destructive))" 
                    fill="hsl(var(--destructive))" 
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requests by Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests by Method</CardTitle>
            <CardDescription>Distribution of HTTP methods</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.requestsByMethod && analytics.requestsByMethod.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <PieChart>
                  <Pie
                    data={analytics.requestsByMethod}
                    dataKey="count"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ method, count }) => `${method}: ${count}`}
                  >
                    {analytics.requestsByMethod.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={METHOD_COLORS[entry.method] || 'hsl(var(--muted-foreground))'} 
                      />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Endpoints</CardTitle>
            <CardDescription>Most frequently called endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.requestsByEndpoint && analytics.requestsByEndpoint.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={analytics.requestsByEndpoint} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis 
                    type="category" 
                    dataKey="endpoint" 
                    tick={{ fontSize: 10 }} 
                    width={100}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response Time Distribution</CardTitle>
            <CardDescription>Breakdown of response times</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.responseTimeDistribution && analytics.responseTimeDistribution.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={analytics.responseTimeDistribution}>
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
