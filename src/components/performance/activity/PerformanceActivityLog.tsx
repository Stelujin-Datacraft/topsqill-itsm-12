import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type PerformanceAlert, type PerformanceThreshold } from '@/hooks/usePerformanceMonitoring';
import { getSeverityColorClass } from '@/components/performance/utils/severityUtils';
import { AlertTriangle, Bell, CheckCircle2, Clock, EyeOff, Plus, Settings2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  alerts: PerformanceAlert[];
  thresholds: PerformanceThreshold[];
  loading: boolean;
}

interface ActivityEvent {
  id: string;
  type: 'alert_created' | 'alert_acknowledged' | 'alert_resolved' | 'alert_dismissed' | 'threshold_created';
  title: string;
  description?: string;
  severity?: string;
  timestamp: Date;
  icon: React.ReactNode;
}

export function PerformanceActivityLog({ alerts, thresholds, loading }: Props) {
  const events = useMemo(() => {
    const items: ActivityEvent[] = [];

    // Build events from alerts
    for (const alert of alerts) {
      items.push({
        id: `alert-created-${alert.id}`,
        type: 'alert_created',
        title: `Alert raised: ${alert.title}`,
        description: alert.description || undefined,
        severity: alert.severity,
        timestamp: new Date(alert.created_at),
        icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
      });

      if (alert.status === 'acknowledged') {
        items.push({
          id: `alert-ack-${alert.id}`,
          type: 'alert_acknowledged',
          title: `Alert acknowledged: ${alert.title}`,
          severity: alert.severity,
          timestamp: new Date(alert.created_at), // approximation
          icon: <Bell className="h-4 w-4 text-blue-600" />,
        });
      }

      if (alert.status === 'resolved') {
        items.push({
          id: `alert-res-${alert.id}`,
          type: 'alert_resolved',
          title: `Alert resolved: ${alert.title}`,
          severity: alert.severity,
          timestamp: new Date(alert.created_at),
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        });
      }

      if (alert.status === 'dismissed') {
        items.push({
          id: `alert-dis-${alert.id}`,
          type: 'alert_dismissed',
          title: `Alert dismissed: ${alert.title}`,
          severity: alert.severity,
          timestamp: new Date(alert.created_at),
          icon: <EyeOff className="h-4 w-4 text-muted-foreground" />,
        });
      }
    }

    // Build events from thresholds
    for (const threshold of thresholds) {
      items.push({
        id: `threshold-${threshold.id}`,
        type: 'threshold_created',
        title: `Threshold created: ${threshold.metric_name}`,
        description: `${threshold.operator} ${threshold.threshold_value} (${threshold.severity})`,
        severity: threshold.severity,
        timestamp: new Date(), // thresholds don't expose created_at in our type but it exists in DB
        icon: <Plus className="h-4 w-4 text-primary" />,
      });
    }

    // Sort by timestamp descending
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items;
  }, [alerts, thresholds]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Recent performance monitoring activity for this project
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">No activity yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Activity will appear here as you run analyses, create thresholds, and manage alerts.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-1">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 py-2.5 pl-0 relative">
                    <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border">
                      {event.icon}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                        {event.severity && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getSeverityColorClass(event.severity)}`}>
                            {event.severity}
                          </Badge>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(event.timestamp, 'MMM d, yyyy · h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}