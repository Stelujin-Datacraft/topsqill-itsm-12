import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { FormField } from '@/types/form';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface KeyMetric {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable' | 'neutral';
}

interface Anomaly {
  description: string;
  severity: 'low' | 'medium' | 'high';
  fieldId?: string;
}

interface DataSummaryResult {
  summary: string;
  keyMetrics: KeyMetric[];
  insights: string[];
  recommendations: string[];
  anomalies: Anomaly[];
}

interface AIDataSummaryProps {
  formFields: FormField[];
  formName: string;
  submissions: Array<Record<string, any>>;
  totalRecords: number;
}

const trendIcons = {
  up: <TrendingUp className="h-3 w-3 text-primary" />,
  down: <TrendingDown className="h-3 w-3 text-destructive" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
  neutral: <Minus className="h-3 w-3 text-muted-foreground" />,
};

const severityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-accent text-accent-foreground',
  high: 'bg-destructive/10 text-destructive',
};

// Generate basic statistics from data for AI context
function computeDataSummary(submissions: Array<Record<string, any>>, formFields: FormField[]) {
  const summary: Record<string, any> = { totalRecords: submissions.length };
  
  for (const field of formFields) {
    const values = submissions
      .map(s => s[field.id])
      .filter(v => v !== null && v !== undefined && v !== '');
    
    const fieldSummary: any = { 
      filledCount: values.length,
      emptyCount: submissions.length - values.length 
    };

    if (['number', 'currency', 'slider', 'rating'].includes(field.type)) {
      const nums = values.map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) {
        fieldSummary.min = Math.min(...nums);
        fieldSummary.max = Math.max(...nums);
        fieldSummary.avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
      }
    } else if (['select', 'radio', 'multi-select'].includes(field.type)) {
      const counts: Record<string, number> = {};
      values.forEach(v => {
        const key = String(v);
        counts[key] = (counts[key] || 0) + 1;
      });
      fieldSummary.distribution = counts;
    }

    summary[field.label] = fieldSummary;
  }
  return summary;
}

export function AIDataSummary({ formFields, formName, submissions, totalRecords }: AIDataSummaryProps) {
  const [result, setResult] = useState<DataSummaryResult | null>(null);
  const { summarizeData, isLoading } = useFormAI();

  const handleGenerate = async () => {
    if (submissions.length === 0) {
      toast.error('No data to summarize');
      return;
    }

    const dataSummary = computeDataSummary(submissions, formFields);

    const response = await summarizeData(
      formFields,
      formName,
      submissions.slice(0, 20),
      dataSummary,
      totalRecords
    );

    if (response) {
      setResult(response);
    }
  };

  if (!result) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Data Summary
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Get AI-powered insights from your {totalRecords} record(s)
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={isLoading || submissions.length === 0} size="sm">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Summary
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Data Summary
          </span>
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        {result.keyMetrics && result.keyMetrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {result.keyMetrics.slice(0, 4).map((metric, i) => (
              <div key={i} className="p-2 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-1">
                  {trendIcons[metric.trend]}
                  <span className="text-xs text-muted-foreground truncate">{metric.label}</span>
                </div>
                <p className="text-sm font-semibold mt-0.5">{metric.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <ScrollArea className="max-h-[200px]">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown>{result.summary}</ReactMarkdown>
          </div>
        </ScrollArea>

        {/* Insights & Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {result.insights && result.insights.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium flex items-center gap-1">
                <Lightbulb className="h-3 w-3 text-primary" /> Insights
              </p>
              {result.insights.slice(0, 3).map((insight, i) => (
                <p key={i} className="text-xs p-1.5 rounded bg-primary/5 text-foreground">{insight}</p>
              ))}
            </div>
          )}

          {result.anomalies && result.anomalies.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-destructive" /> Anomalies
              </p>
              {result.anomalies.slice(0, 3).map((anomaly, i) => (
                <div key={i} className="text-xs p-1.5 rounded flex items-start gap-1.5">
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${severityColors[anomaly.severity]}`}>
                    {anomaly.severity}
                  </Badge>
                  <span>{anomaly.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        {result.recommendations && result.recommendations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium">💡 Recommendations</p>
            {result.recommendations.slice(0, 3).map((rec, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {rec}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
