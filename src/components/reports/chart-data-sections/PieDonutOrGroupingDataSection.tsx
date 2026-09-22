import React from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ListOrdered, PieChart } from 'lucide-react';
import { ChartDataSection } from '../ChartDataSection';
import { PieDonutDataSection } from './PieDonutDataSection';
import { groupingDrilldownConfig } from '../utils/aiReportGrouping';

interface PieDonutOrGroupingDataSectionProps {
  config: ChartConfig;
  formFields: FormField[];
  onConfigChange: (updates: Partial<ChartConfig>) => void;
  chartType: 'pie' | 'donut';
}

/**
 * Preserves the original Pie/Donut calculate UI (slice by + value + max slices).
 * When Grouping is enabled, switches to the shared multilevel ChartDataSection.
 */
export function PieDonutOrGroupingDataSection({
  config,
  formFields,
  onConfigChange,
  chartType,
}: PieDonutOrGroupingDataSectionProps) {
  const enableGrouping = () => {
    const dims = (config.dimensions || []).filter(Boolean);
    onConfigChange({
      groupingMode: true,
      compareMode: false,
      aggregationEnabled: true,
      aggregationType: 'count',
      aggregation: 'count',
      metrics: [],
      metricAggregations: [{ field: 'count', aggregation: 'count' }],
      dimensions: dims,
      drilldownConfig: groupingDrilldownConfig(dims),
    });
  };

  const exitGrouping = () => {
    const dim = config.dimensions?.[0];
    onConfigChange({
      groupingMode: false,
      compareMode: false,
      aggregationEnabled: true,
      metrics: [],
      metricAggregations: [],
      dimensions: dim ? [dim] : [],
      drilldownConfig: { enabled: false, levels: [], drilldownLevels: [] },
    });
  };

  if (config.groupingMode) {
    return (
      <div className="space-y-4">
        <Alert className="bg-primary/5 border-primary/20">
          <ListOrdered className="icon-md text-module-reports" />
          <AlertDescription className="text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>
              <strong>Grouping mode</strong> is on for this {chartType} chart — multilevel count drilldown.
            </span>
            <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={exitGrouping}>
              Back to {chartType === 'donut' ? 'Donut' : 'Pie'} setup
            </Button>
          </AlertDescription>
        </Alert>
        <ChartDataSection
          config={config}
          formFields={formFields}
          onConfigChange={onConfigChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <PieChart className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Need multilevel drilldown? Switch to Grouping (count of records).</span>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={enableGrouping}>
          <ListOrdered className="h-3.5 w-3.5 mr-1" />
          Grouping
        </Button>
      </div>
      <PieDonutDataSection
        config={config}
        formFields={formFields}
        onConfigChange={onConfigChange}
        chartType={chartType}
      />
    </div>
  );
}
