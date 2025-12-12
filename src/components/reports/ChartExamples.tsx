import React, { useMemo, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart3, PieChart, LineChart, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ChartExample {
  id: string;
  title: string;
  description: string;
  chartType: string;
  metrics: string[];
  dimensions: string[];
  aggregationEnabled: boolean;
  metricAggregations?: Array<{
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median' | 'stddev';
  }>;
  icon: React.ReactNode;
}

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

interface ChartExamplesProps {
  onSelectExample: (example: ChartExample) => void;
  formId: string;
}

export function ChartExamples({ onSelectExample, formId }: ChartExamplesProps) {
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFields = async () => {
      if (!formId) {
        setFormFields([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type')
          .eq('form_id', formId)
          .order('field_order', { ascending: true });

        if (error) {
          console.error('Error fetching form fields for examples:', error);
          setFormFields([]);
        } else {
          setFormFields(data || []);
        }
      } catch (err) {
        console.error('Error fetching fields:', err);
        setFormFields([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [formId]);

  // Categorize fields
  const { dimensionFields, metricFields, selectFields } = useMemo(() => {
    const dimensions = formFields.filter(f => 
      ['text', 'select', 'radio', 'dropdown', 'date', 'datetime', 'email', 'checkbox'].includes(f.field_type)
    );
    const metrics = formFields.filter(f => 
      ['number', 'currency', 'rating', 'slider'].includes(f.field_type)
    );
    const selects = formFields.filter(f => 
      ['select', 'radio', 'dropdown'].includes(f.field_type)
    );
    return { dimensionFields: dimensions, metricFields: metrics, selectFields: selects };
  }, [formFields]);

  // Generate dynamic examples based on available fields
  const examples: ChartExample[] = useMemo(() => {
    const generatedExamples: ChartExample[] = [];

    // Example 1: Count by first dimension field (if available)
    if (dimensionFields.length > 0) {
      const firstDim = dimensionFields[0];
      generatedExamples.push({
        id: 'count-by-dimension',
        title: `Count by ${firstDim.label}`,
        description: `Distribution of submissions grouped by ${firstDim.label}`,
        chartType: 'bar',
        metrics: [firstDim.id],
        dimensions: [firstDim.id],
        aggregationEnabled: true,
        metricAggregations: [{ field: firstDim.id, aggregation: 'count' }],
        icon: <BarChart3 className="h-4 w-4" />
      });
    }

    // Example 2: Pie chart for select/radio field (if available)
    if (selectFields.length > 0) {
      const selectField = selectFields[0];
      generatedExamples.push({
        id: 'pie-distribution',
        title: `${selectField.label} Distribution`,
        description: `Pie chart showing distribution of ${selectField.label}`,
        chartType: 'pie',
        metrics: [selectField.id],
        dimensions: [selectField.id],
        aggregationEnabled: true,
        metricAggregations: [{ field: selectField.id, aggregation: 'count' }],
        icon: <PieChart className="h-4 w-4" />
      });
    }

    // Example 3: Sum/Avg of numeric field by dimension (if both available)
    if (metricFields.length > 0 && dimensionFields.length > 0) {
      const metric = metricFields[0];
      const dimension = dimensionFields[0];
      generatedExamples.push({
        id: 'sum-by-dimension',
        title: `${metric.label} by ${dimension.label}`,
        description: `Sum of ${metric.label} grouped by ${dimension.label}`,
        chartType: 'column',
        metrics: [metric.id],
        dimensions: [dimension.id],
        aggregationEnabled: true,
        metricAggregations: [{ field: metric.id, aggregation: 'sum' }],
        icon: <LineChart className="h-4 w-4" />
      });
    }

    // Example 4: Multi-dimensional analysis (if multiple dimensions available)
    if (dimensionFields.length >= 2) {
      const dim1 = dimensionFields[0];
      const dim2 = dimensionFields[1];
      generatedExamples.push({
        id: 'multi-dimensional',
        title: `${dim1.label} vs ${dim2.label}`,
        description: `Multi-dimensional analysis with two grouping levels`,
        chartType: 'bar',
        metrics: [dim1.id, dim2.id],
        dimensions: [dim1.id, dim2.id],
        aggregationEnabled: true,
        metricAggregations: [
          { field: dim1.id, aggregation: 'count' },
          { field: dim2.id, aggregation: 'count' }
        ],
        icon: <TrendingUp className="h-4 w-4" />
      });
    }

    // Example 5: Line chart trend (if date field available)
    const dateField = dimensionFields.find(f => ['date', 'datetime'].includes(f.field_type));
    if (dateField) {
      generatedExamples.push({
        id: 'trend-over-time',
        title: `Trend by ${dateField.label}`,
        description: `Line chart showing submissions over time`,
        chartType: 'line',
        metrics: [dateField.id],
        dimensions: [dateField.id],
        aggregationEnabled: true,
        metricAggregations: [{ field: dateField.id, aggregation: 'count' }],
        icon: <LineChart className="h-4 w-4" />
      });
    }

    return generatedExamples;
  }, [dimensionFields, metricFields, selectFields]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading form fields...</span>
      </div>
    );
  }

  if (formFields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No fields found for this form.</p>
        <p className="text-sm mt-2">Add fields to the form to see chart examples.</p>
      </div>
    );
  }

  if (examples.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No chart examples available for the current field configuration.</p>
        <p className="text-sm mt-2">Add more fields (text, select, number, date) to see examples.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Chart examples generated based on your form's fields:
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {examples.map((example) => (
          <Card 
            key={example.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectExample(example)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {example.icon}
                {example.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {example.description}
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  {example.chartType}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {example.metrics.length} metric{example.metrics.length !== 1 ? 's' : ''}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {example.dimensions.length} dimension{example.dimensions.length !== 1 ? 's' : ''}
                </Badge>
                {example.aggregationEnabled && (
                  <Badge variant="default" className="text-xs">
                    Aggregation
                  </Badge>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectExample(example);
                }}
              >
                Use This Example
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Available Fields:</strong>
          <div className="mt-2 flex flex-wrap gap-2">
            {dimensionFields.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {dimensionFields.length} dimension fields
              </Badge>
            )}
            {metricFields.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {metricFields.length} metric fields
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}