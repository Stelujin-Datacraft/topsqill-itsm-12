import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Monitor, RefreshCw, Smartphone, Globe } from 'lucide-react';
import { format } from 'date-fns';

interface ActiveSession {
  id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_activity: string;
  is_active: boolean;
}

interface SessionsTabProps {
  sessions: ActiveSession[];
  loading?: boolean;
  onReload?: () => void;
}

export function SessionsTab({ sessions, loading, onReload }: SessionsTabProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Globe className="h-4 w-4" />;
    if (userAgent.toLowerCase().includes('mobile')) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getBrowserInfo = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other Browser';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Active Sessions</CardTitle>
            <CardDescription>
              Currently active sessions for this user ({sessions.length} active)
            </CardDescription>
          </div>
          {onReload && (
            <Button variant="outline" size="sm" onClick={onReload}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <Monitor className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No active sessions</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(session.user_agent)}
                      <span>{getBrowserInfo(session.user_agent)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {session.ip_address || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(session.created_at), 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell>
                    {format(new Date(session.last_activity), 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
