import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type PerformanceAlert, type PerformancePrediction, type AIAnalysis } from '@/hooks/usePerformanceMonitoring';
import { getSeverityBadgeVariant, getHealthColorClass } from '@/components/performance/utils/severityUtils';
import { Brain, Loader2, Lightbulb, TrendingUp, EyeOff, Settings2 } from 'lucide-react';
import { UseMutationResult } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface Props {
  alerts: PerformanceAlert[];
  predictions: PerformancePrediction[];
  loading: boolean;
  runAnalysis: UseMutationResult<AIAnalysis, Error, void, unknown>;
  onNavigateToThresholds?: () => void;
}

export function PerformanceOverview({ alerts, predictions, loading, runAnalysis, onNavigateToThresholds }: Props) {
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [dismissedPredictions, setDismissedPredictions] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (!aiResult && (alerts.length > 0 || predictions.length > 0)) {
      const latestAlerts = alerts.filter(a => a.ai_generated);
      const riskScore = latestAlerts.length > 3 ? 65 : latestAlerts.length > 1 ? 40 : latestAlerts.length > 0 ? 20 : 0;
      const healthStatus = riskScore > 70 ? 'red' : riskScore > 40 ? 'orange' : riskScore > 20 ? 'yellow' : 'green';

      setAiResult({
        risk_score: riskScore,
        health_status: healthStatus,
        summary: `Last analysis detected ${latestAlerts.length} anomalies and generated ${predictions.length} predictions.`,
        anomalies: latestAlerts.map(a => ({
          metric: a.metric_name || 'Unknown',
          description: a.description || '',
          severity: a.severity,
          value: a.actual_value ?? undefined,
          expected_value: a.threshold_value ?? undefined,
        })),
        predictions: predictions.map(p => ({
          type: p.prediction_type,
          description: p.reasoning || '',
          predicted_value: p.predicted_value ?? undefined,
          confidence: (p.confidence_level ?? 0) > 1 ? (p.confidence_level ?? 0) / 100 : (p.confidence_level ?? 0),
        })),
        recommendations: [],
      });
    }
  }, [alerts, predictions]);

  const handleRunAnalysis = async () => {
    const result = await runAnalysis.mutateAsync();
    setAiResult(result);
    setDismissedPredictions(new Set());
  };

  const handleDismissPrediction = (index: number) => {
    setDismissedPredictions(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    toast({ title: 'Prediction dismissed' });
  };

  const handleCreateThresholdFromPrediction = () => {
    if (onNavigateToThresholds) {
      onNavigateToThresholds();
      toast({ title: 'Navigated to Thresholds', description: 'Create a threshold rule based on the prediction.' });
    }
  };

  const visiblePredictions = aiResult?.predictions?.filter((_, i) => !dismissedPredictions.has(i)) ?? [];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold text-foreground">AI Performance Analysis</p>
              <p className="text-sm text-muted-foreground">
                Analyze connected form data for anomalies, trends, and predictive insights
              </p>
            </div>
          </div>
          <Button onClick={handleRunAnalysis} disabled={runAnalysis.isPending}>
            {runAnalysis.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : 'Run AI Analysis'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Risk Score</p>
                <p className="text-2xl font-bold text-foreground">
                  {aiResult ? `${aiResult.risk_score}/100` : '—'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Predictions</p>
                <p className="text-2xl font-bold text-foreground">{visiblePredictions.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

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
            <CardContent>
              <div className="flex items-center gap-4">
                <Badge className={getHealthColorClass(aiResult.health_status)}>
                  Health: {aiResult.health_status?.toUpperCase()}
                </Badge>
                <Badge variant="outline">Risk Score: {aiResult.risk_score}/100</Badge>
              </div>
            </CardContent>
          </Card>

          {visiblePredictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Predictions ({visiblePredictions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiResult.predictions.map((p, i) => {
                  if (dismissedPredictions.has(i)) return null;
                  return (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 group">
                      <Badge variant="outline" className="text-xs mt-0.5">{Math.round((p.confidence > 1 ? p.confidence : p.confidence * 100))}%</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{p.type}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                        {p.timeframe && <p className="text-xs text-muted-foreground mt-1">Timeframe: {p.timeframe}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {onNavigateToThresholds && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateThresholdFromPrediction} title="Create threshold rule">
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDismissPrediction(i)} title="Dismiss prediction">
                          <EyeOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

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
                    <Badge variant={getSeverityBadgeVariant(rec.priority)} className="text-xs mt-0.5">{rec.priority}</Badge>
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

      {!aiResult && alerts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">No analysis data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your data source fields, then click "Run AI Analysis" to get insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
