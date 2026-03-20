import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type PerformanceAlert, type PerformanceThreshold } from '@/hooks/usePerformanceMonitoring';
import { usePerformanceAuditLog, type PerformanceAuditEntry } from '@/hooks/usePerformanceAuditLog';
import { getSeverityColorClass } from '@/components/performance/utils/severityUtils';
import { AlertTriangle, Bell, CheckCircle2, Clock, EyeOff, Plus, Settings2, Loader2, Brain, MapPin, ClipboardCheck, FlaskConical, Database, Shield, Download } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  alerts: PerformanceAlert[];
  thresholds: PerformanceThreshold[];
  loading: boolean;
  perfProjectId?: string;
}

interface ActivityEvent {
  id: string;
  type: string;
  category: string;
  title: string;
  description?: string;
  severity?: string;
  timestamp: Date;
  icon: React.ReactNode;
  source: 'derived' | 'audit_log';
  userId?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  analysis: <Brain className="h-4 w-4 text-purple-600" />,
  alerts: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
  thresholds: <Settings2 className="h-4 w-4 text-blue-600" />,
  data_sources: <Database className="h-4 w-4 text-cyan-600" />,
  gis: <MapPin className="h-4 w-4 text-emerald-600" />,
  questionnaire: <ClipboardCheck className="h-4 w-4 text-orange-600" />,
  scenarios: <FlaskConical className="h-4 w-4 text-pink-600" />,
  security: <Shield className="h-4 w-4 text-red-600" />,
  general: <Clock className="h-4 w-4 text-muted-foreground" />,
};

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'analysis', label: 'AI Analysis' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'thresholds', label: 'Thresholds' },
  { value: 'data_sources', label: 'Data Sources' },
  { value: 'gis', label: 'GIS' },
  { value: 'questionnaire', label: 'Assessment' },
  { value: 'scenarios', label: 'Scenarios' },
];

export function PerformanceActivityLog({ alerts, thresholds, loading, perfProjectId }: Props) {
  const { auditLogs, isLoading: loadingAudit } = usePerformanceAuditLog(perfProjectId);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const events = useMemo(() => {
    const items: ActivityEvent[] = [];

    // Build events from alerts (derived)
    for (const alert of alerts) {
      items.push({
        id: `alert-created-${alert.id}`,
        type: 'alert_created',
        category: 'alerts',
        title: `Alert raised: ${alert.title}`,
        description: alert.description || undefined,
        severity: alert.severity,
        timestamp: new Date(alert.created_at),
        icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
        source: 'derived',
      });

      if (alert.status === 'acknowledged') {
        items.push({
          id: `alert-ack-${alert.id}`,
          type: 'alert_acknowledged',
          category: 'alerts',
          title: `Alert acknowledged: ${alert.title}`,
          severity: alert.severity,
          timestamp: new Date(alert.created_at),
          icon: <Bell className="h-4 w-4 text-blue-600" />,
          source: 'derived',
        });
      }
      if (alert.status === 'resolved') {
        items.push({
          id: `alert-res-${alert.id}`,
          type: 'alert_resolved',
          category: 'alerts',
          title: `Alert resolved: ${alert.title}`,
          severity: alert.severity,
          timestamp: new Date(alert.created_at),
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
          source: 'derived',
        });
      }
      if (alert.status === 'dismissed') {
        items.push({
          id: `alert-dis-${alert.id}`,
          type: 'alert_dismissed',
          category: 'alerts',
          title: `Alert dismissed: ${alert.title}`,
          severity: alert.severity,
          timestamp: new Date(alert.created_at),
          icon: <EyeOff className="h-4 w-4 text-muted-foreground" />,
          source: 'derived',
        });
      }
    }

    // Build events from thresholds (derived)
    for (const threshold of thresholds) {
      items.push({
        id: `threshold-${threshold.id}`,
        type: 'threshold_created',
        category: 'thresholds',
        title: `Threshold created: ${threshold.metric_name}`,
        description: `${threshold.operator} ${threshold.threshold_value} (${threshold.severity})`,
        severity: threshold.severity,
        timestamp: new Date(),
        icon: <Plus className="h-4 w-4 text-primary" />,
        source: 'derived',
      });
    }

    // Build events from audit logs (persisted)
    for (const log of auditLogs) {
      items.push({
        id: `audit-${log.id}`,
        type: log.action_type,
        category: log.action_category,
        title: log.title,
        description: log.description || undefined,
        timestamp: new Date(log.created_at),
        icon: CATEGORY_ICONS[log.action_category] || CATEGORY_ICONS.general,
        source: 'audit_log',
        userId: log.user_id,
      });
    }

    // Deduplicate: prefer audit_log over derived
    const auditKeys = new Set(auditLogs.map(l => l.action_type + l.title));
    const deduped = items.filter(item => {
      if (item.source === 'derived') {
        return !auditKeys.has(item.type + item.title);
      }
      return true;
    });

    deduped.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return deduped;
  }, [alerts, thresholds, auditLogs]);

  const filteredEvents = categoryFilter === 'all'
    ? events
    : events.filter(e => e.category === categoryFilter);

  const isLoading = loading || loadingAudit;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Events</p>
            <p className="text-2xl font-bold text-foreground">{events.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Audit Entries</p>
            <p className="text-2xl font-bold text-primary">{auditLogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Alert Events</p>
            <p className="text-2xl font-bold text-yellow-600">{events.filter(e => e.category === 'alerts').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold text-foreground">{new Set(events.map(e => e.category)).size}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Performance Audit Trail
              </CardTitle>
              <CardDescription>
                Complete activity log with persisted audit entries and derived events
              </CardDescription>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_FILTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
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
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-1">
                  {filteredEvents.map((event) => (
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
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {event.category}
                          </Badge>
                          {event.source === 'audit_log' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              <Shield className="h-2.5 w-2.5 mr-0.5" />
                              Audited
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
    </div>
  );
}
