import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { Brain, TrendingUp, Calendar, Users, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  perfProjectId?: string;
}

export function PredictionsPanel({ perfProjectId }: Props) {
  const { predictions, loading } = usePerformanceMonitoring(perfProjectId);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'budget_forecast': return <DollarSign className="h-5 w-5 text-emerald-500" />;
      case 'completion_date': return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'resource_need': return <Users className="h-5 w-5 text-purple-500" />;
      case 'risk_trend': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'milestone_delay': return <TrendingUp className="h-5 w-5 text-red-500" />;
      default: return <Brain className="h-5 w-5 text-primary" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'budget_forecast': return 'Budget Forecast';
      case 'completion_date': return 'Completion Date';
      case 'resource_need': return 'Resource Need';
      case 'risk_trend': return 'Risk Trend';
      case 'milestone_delay': return 'Milestone Delay';
      default: return type;
    }
  };

  const confidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-emerald-500/10 text-emerald-600';
    if (confidence >= 60) return 'bg-yellow-500/10 text-yellow-600';
    return 'bg-red-500/10 text-red-600';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">AI Predictions</h2>
        <p className="text-sm text-muted-foreground">Machine learning-powered forecasts and trend analysis</p>
      </div>

      <div className="space-y-3">
        {predictions.map(prediction => (
          <Card key={prediction.id}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                {typeIcon(prediction.prediction_type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-foreground">{typeLabel(prediction.prediction_type)}</p>
                    {prediction.confidence_level && (
                      <Badge className={confidenceColor(Number(prediction.confidence_level))}>
                        {Number(prediction.confidence_level).toFixed(0)}% confidence
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{prediction.reasoning}</p>
                  {prediction.predicted_value !== null && prediction.predicted_value !== undefined && Number(prediction.predicted_value) !== 0 && (
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-muted-foreground">
                        Predicted Value: <span className="font-semibold text-foreground">{Number(prediction.predicted_value).toLocaleString()}</span>
                      </span>
                      {prediction.prediction_range_low && prediction.prediction_range_high && (
                        <span className="text-xs text-muted-foreground">
                          Range: {Number(prediction.prediction_range_low).toLocaleString()} – {Number(prediction.prediction_range_high).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(prediction.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {predictions.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Brain className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">No predictions yet</p>
              <p className="text-sm text-muted-foreground">Run AI Analysis from the Overview tab with at least 2 snapshots.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
