import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitoring, AIAnalysis } from '@/hooks/usePerformanceMonitoring';
import { Brain, AlertTriangle, Loader2, Lightbulb, ShieldAlert, TrendingUp } from 'lucide-react';

export function PerformanceOverview() {
  const { alerts, predictions, loading, runAnalysis } = usePerformanceMonitoring();
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);

  const activeAlerts = alerts.filter(a => a.status === 'active');

  const handleRunAnalysis = async () => {
    const result = await runAnalysis.mutateAsync();
    setAiResult(result);
  };

  const healthColor = (status?: string) => {
    switch (status) {
      case 'green': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'yellow': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'orange': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'red': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* AI Analysis Button */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold text-foreground">AI Performance Analysis</p>
              <p className="text-sm text-muted-foreground">
                Analyze connected form data sources for anomalies, trends, and predictive insights
              </p>
            </div>
          </div>
          <Button onClick={handleRunAnalysis} disabled={runAnalysis.isPending}>
            {runAnalysis.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : 'Run AI Analysis'}
          </Button>
        </CardContent>
      </Card>

      {/* AI Results */}
      {aiResult && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Analysis Results
              </CardTitle>
              <CardDescription>{aiResult.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className={healthColor(aiResult.health_status)}>
                  Health: {aiResult.health_status?.toUpperCase()}
                </Badge>
                <Badge variant="outline">Risk Score: {aiResult.risk_score}/100</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Anomalies */}
          {aiResult.anomalies?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  Detected Anomalies ({aiResult.anomalies.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.anomalies.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <Badge variant={severityColor(a.severity)} className="text-xs mt-0.5">{a.severity}</Badge>
                    <div>
                      <p className="font-medium text-sm">{a.metric}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Predictions */}
          {aiResult.predictions?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Predictions ({aiResult.predictions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.predictions.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <Badge variant="outline" className="text-xs mt-0.5">{Math.round(p.confidence * 100)}%</Badge>
                    <div>
                      <p className="font-medium text-sm">{p.type}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                      {p.timeframe && <p className="text-xs text-muted-foreground mt-1">Timeframe: {p.timeframe}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {aiResult.recommendations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Recommendations ({aiResult.recommendations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <Badge variant={severityColor(rec.priority)} className="text-xs mt-0.5">{rec.priority}</Badge>
                    <div>
                      <p className="font-medium text-sm">{rec.title}</p>
                      <p className="text-xs text-muted-foreground">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold text-foreground">{activeAlerts.length}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${activeAlerts.length > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Predictions</p>
                <p className="text-2xl font-bold text-foreground">{predictions.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Health Status</p>
                <p className="text-2xl font-bold text-foreground">
                  {aiResult ? aiResult.health_status?.toUpperCase() : '—'}
                </p>
              </div>
              <Brain className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {!aiResult && alerts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">No analysis data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your form data sources, then click "Run AI Analysis" to get insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
