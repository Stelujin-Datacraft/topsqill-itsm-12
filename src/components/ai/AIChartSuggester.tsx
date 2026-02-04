import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Check, BarChart3, LineChart, PieChart, Lightbulb, AlertTriangle } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartSuggestion {
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'bubble' | 'table';
  title: string;
  description: string;
  dimensions: string[];
  metrics: string[];
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Array<{ fieldId: string; operator: string; value: string }>;
  reasoning: string;
  priority: number;
}

interface ChartSuggestionResult {
  suggestions: ChartSuggestion[];
  insights?: string[];
  warnings?: string[];
}

interface AIChartSuggesterProps {
  formFields: Array<{ id: string; label: string; type: string }>;
  formName?: string;
  formData?: Array<Record<string, any>>;
  existingCharts?: Array<{ type: string; dimensions: string[]; metrics: string[] }>;
  onApply: (chart: ChartSuggestion) => void;
  buttonLabel?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

const chartTypeIcons: Record<string, React.ReactNode> = {
  bar: <BarChart3 className="h-4 w-4" />,
  line: <LineChart className="h-4 w-4" />,
  area: <LineChart className="h-4 w-4" />,
  pie: <PieChart className="h-4 w-4" />,
  scatter: <BarChart3 className="h-4 w-4" />,
  bubble: <BarChart3 className="h-4 w-4" />,
  table: <BarChart3 className="h-4 w-4" />
};

const chartTypeColors: Record<string, string> = {
  bar: 'bg-blue-100 text-blue-800',
  line: 'bg-green-100 text-green-800',
  area: 'bg-teal-100 text-teal-800',
  pie: 'bg-purple-100 text-purple-800',
  scatter: 'bg-orange-100 text-orange-800',
  bubble: 'bg-pink-100 text-pink-800',
  table: 'bg-gray-100 text-gray-800'
};

export function AIChartSuggester({
  formFields,
  formName = 'Form',
  formData,
  existingCharts,
  onApply,
  buttonLabel = 'AI Suggest Charts',
  buttonVariant = 'outline',
  buttonSize = 'sm'
}: AIChartSuggesterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userRequest, setUserRequest] = useState('');
  const [result, setResult] = useState<ChartSuggestionResult | null>(null);
  const [selectedChart, setSelectedChart] = useState<ChartSuggestion | null>(null);
  const { suggestCharts, isLoading } = useFormAI();

  const handleGenerate = async () => {
    if (formFields.length === 0) {
      toast.error('Form must have fields to suggest charts');
      return;
    }

    const response = await suggestCharts(formFields, {
      formName,
      formData: formData?.slice(0, 10), // Limit sample data
      existingCharts,
      userRequest: userRequest || undefined
    });

    if (response) {
      setResult(response);
      setSelectedChart(response.suggestions[0] || null);
      toast.success('Chart suggestions generated!');
    }
  };

  const handleApply = () => {
    if (selectedChart) {
      onApply(selectedChart);
      setIsOpen(false);
      resetForm();
      toast.success('Chart configuration applied');
    }
  };

  const resetForm = () => {
    setResult(null);
    setSelectedChart(null);
    setUserRequest('');
  };

  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            AI Chart Suggestions
          </DialogTitle>
          <DialogDescription>
            AI will analyze your form data and suggest the most insightful visualizations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form info */}
          <div className="flex items-center gap-4">
            <Badge variant="outline">{formName}</Badge>
            <span className="text-sm text-muted-foreground">{formFields.length} fields</span>
            {formData && (
              <span className="text-sm text-muted-foreground">{formData.length} records</span>
            )}
          </div>

          {/* Optional request */}
          <div className="space-y-2">
            <Label>Specific visualization needs (optional)</Label>
            <Textarea
              placeholder="e.g., Show me trends over time, compare categories, highlight top performers..."
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isLoading || formFields.length === 0}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Data...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Suggestions
              </>
            )}
          </Button>

          {/* Results */}
          {result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chart suggestions list */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Suggested Charts</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-2">
                      {result.suggestions
                        .sort((a, b) => a.priority - b.priority)
                        .map((chart, index) => (
                          <div
                            key={index}
                            onClick={() => setSelectedChart(chart)}
                            className={`p-3 border rounded-md cursor-pointer transition-colors ${
                              selectedChart === chart
                                ? 'border-primary bg-primary/5'
                                : 'hover:border-muted-foreground/50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {chartTypeIcons[chart.chartType]}
                                <span className="font-medium text-sm">{chart.title}</span>
                              </div>
                              <Badge className={`text-xs ${chartTypeColors[chart.chartType]}`}>
                                {chart.chartType}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {chart.description}
                            </p>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Selected chart details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Chart Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedChart ? (
                    <ScrollArea className="h-[300px] pr-2">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Type</Label>
                          <div className="flex items-center gap-2 mt-1">
                            {chartTypeIcons[selectedChart.chartType]}
                            <span className="capitalize">{selectedChart.chartType} Chart</span>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Dimensions (Group By)</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedChart.dimensions.map((dim, i) => (
                              <Badge key={i} variant="secondary">{getFieldLabel(dim)}</Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Metrics</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedChart.metrics.map((metric, i) => (
                              <Badge key={i} variant="outline">{getFieldLabel(metric)}</Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Aggregation</Label>
                          <div className="mt-1">
                            <Badge>{selectedChart.aggregation.toUpperCase()}</Badge>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Why this chart?</Label>
                          <p className="text-sm text-muted-foreground mt-1">{selectedChart.reasoning}</p>
                        </div>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Select a chart to see details
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Insights and warnings */}
          {result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.insights && result.insights.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    Data Insights
                  </Label>
                  {result.insights.map((insight, index) => (
                    <div key={index} className="text-xs p-2 bg-blue-50 text-blue-800 rounded">
                      {insight}
                    </div>
                  ))}
                </div>
              )}

              {result.warnings && result.warnings.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    Warnings
                  </Label>
                  {result.warnings.map((warning, index) => (
                    <div key={index} className="text-xs p-2 bg-yellow-50 text-yellow-800 rounded">
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {selectedChart && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGenerate} disabled={isLoading} className="flex-1">
                Regenerate
              </Button>
              <Button onClick={handleApply} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Apply This Chart
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
