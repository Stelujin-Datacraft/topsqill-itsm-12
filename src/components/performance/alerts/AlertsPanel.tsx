import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { AlertTriangle, Brain, CheckCircle2, Eye, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  perfProjectId?: string;
}

export function AlertsPanel({ perfProjectId }: Props) {
  const { alerts, loading, updateAlertStatus } = usePerformanceMonitoring(perfProjectId);

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'low': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return '';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'active': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'acknowledged': return <Eye className="h-4 w-4 text-blue-500" />;
      case 'resolved': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'dismissed': return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const otherAlerts = alerts.filter(a => a.status !== 'active');

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Performance Alerts</h2>
        <p className="text-sm text-muted-foreground">AI-detected anomalies and threshold violations</p>
      </div>

      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Active ({activeAlerts.length})</h3>
          {activeAlerts.map(alert => (
            <Card key={alert.id} className="border-l-4 border-l-orange-500">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {alert.ai_generated ? <Brain className="h-5 w-5 text-primary mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground">{alert.title}</p>
                        <Badge className={severityColor(alert.severity)}>{alert.severity}</Badge>
                        {alert.ai_generated && <Badge variant="outline" className="text-xs">AI</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                      {alert.ai_recommendation && (
                        <p className="text-xs text-primary mt-2 bg-primary/5 p-2 rounded">
                          💡 {alert.ai_recommendation}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(alert.created_at), 'MMM dd, yyyy HH:mm')}
                        {alert.ai_confidence && ` • AI Confidence: ${alert.ai_confidence}%`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateAlertStatus.mutate({ alertId: alert.id, status: 'acknowledged' })}>
                      Acknowledge
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateAlertStatus.mutate({ alertId: alert.id, status: 'resolved' })}>
                      Resolve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateAlertStatus.mutate({ alertId: alert.id, status: 'dismissed' })}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {otherAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">History ({otherAlerts.length})</h3>
          {otherAlerts.map(alert => (
            <Card key={alert.id} className="opacity-70">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  {statusIcon(alert.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-foreground">{alert.title}</p>
                      <Badge variant="secondary" className="text-xs">{alert.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(alert.created_at), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {alerts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
            <p className="font-medium text-foreground">No alerts</p>
            <p className="text-sm text-muted-foreground">Run AI Analysis from the Overview tab to detect anomalies.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
