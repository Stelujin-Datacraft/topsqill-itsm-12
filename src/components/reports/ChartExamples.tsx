import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart3, PieChart, LineChart } from 'lucide-react';

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

interface ChartExamplesProps {
  onSelectExample: (example: ChartExample) => void;
  formId: string;
}

export function ChartExamples({ onSelectExample, formId }: ChartExamplesProps) {
  const examples: ChartExample[] = [
    {
      id: 'field-type-analysis',
      title: 'Field Type Distribution',
      description: 'Count of tests by field type with aggregation enabled',
      chartType: 'bar',
      metrics: ['1e3de8d4-445f-4182-a626-7b77027f5fc0'], // Field Type
      dimensions: ['1e3de8d4-445f-4182-a626-7b77027f5fc0'], // Field Type
      aggregationEnabled: true,
      metricAggregations: [
        { field: '1e3de8d4-445f-4182-a626-7b77027f5fc0', aggregation: 'count' as const }
      ],
      icon: <BarChart3 className="h-4 w-4" />
    },
    {
      id: 'test-status-breakdown',
      title: 'Test Status Pie Chart',
      description: 'Distribution of test statuses across all submissions',
      chartType: 'pie',
      metrics: ['7b9ca31d-d768-4203-9017-b684120fe62c'], // Test Status
      dimensions: ['7b9ca31d-d768-4203-9017-b684120fe62c'], // Test Status
      aggregationEnabled: true,
      metricAggregations: [
        { field: '7b9ca31d-d768-4203-9017-b684120fe62c', aggregation: 'count' as const }
      ],
      icon: <PieChart className="h-4 w-4" />
    },
    {
      id: 'tester-performance',
      title: 'Tests by Tester Email',
      description: 'Count of test submissions grouped by tester email',
      chartType: 'column',
      metrics: ['b2e5e3bd-a5b8-484b-86c2-396f33518dff'], // Tester Email
      dimensions: ['b2e5e3bd-a5b8-484b-86c2-396f33518dff'], // Tester Email
      aggregationEnabled: true,
      metricAggregations: [
        { field: 'b2e5e3bd-a5b8-484b-86c2-396f33518dff', aggregation: 'count' as const }
      ],
      icon: <LineChart className="h-4 w-4" />
    },
    {
      id: 'multi-dimensional',
      title: 'Multi-Dimensional Analysis',
      description: 'Field Type vs Test Status with dual dimensions',
      chartType: 'bar',
      metrics: ['1e3de8d4-445f-4182-a626-7b77027f5fc0', '7b9ca31d-d768-4203-9017-b684120fe62c'],
      dimensions: ['1e3de8d4-445f-4182-a626-7b77027f5fc0', '7b9ca31d-d768-4203-9017-b684120fe62c'],
      aggregationEnabled: true,
      metricAggregations: [
        { field: '1e3de8d4-445f-4182-a626-7b77027f5fc0', aggregation: 'count' as const },
        { field: '7b9ca31d-d768-4203-9017-b684120fe62c', aggregation: 'count' as const }
      ],
      icon: <TrendingUp className="h-4 w-4" />
    }
  ];

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Choose from these examples using the Field Test Management Form data:
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
          <strong>Advanced Features Demonstrated:</strong>
          <ul className="mt-2 list-disc list-inside text-xs space-y-1">
            <li>Multiple metrics per chart (compare different data points)</li>
            <li>Advanced aggregation options (count, sum, average, etc.)</li>
            <li>Multi-dimensional grouping (primary and secondary categories)</li>
            <li>Field type filtering (only numeric fields for metrics)</li>
            <li>Configurable chart capabilities based on chart type</li>
          </ul>
        </div>
      </div>
    </div>
  );
}