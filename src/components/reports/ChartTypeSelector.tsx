
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartTypeOption, CHART_TYPES } from '@/utils/chartConfig';
import { cn } from '@/lib/utils';

interface ChartTypeSelectorProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  className?: string;
}

export function ChartTypeSelector({ selectedType, onTypeChange, className }: ChartTypeSelectorProps) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-5 gap-3", className)}>
      {CHART_TYPES.map((chartType) => (
        <TooltipProvider key={chartType.value}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedType === chartType.value 
                    ? "ring-2 ring-primary bg-primary/5" 
                    : "hover:bg-muted/50"
                )}
                onClick={() => onTypeChange(chartType.value)}
              >
                <CardContent className="p-3 text-center">
                  <div className="mb-2 text-2xl">📊</div>
                  <div className="text-sm font-medium mb-1">{chartType.label}</div>
                  <div className="flex gap-1 justify-center">
                    {chartType.supportedMetrics > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {chartType.supportedMetrics}M
                      </Badge>
                    )}
                    {chartType.supportedDimensions > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {chartType.supportedDimensions}D
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-xs">
                <p className="font-medium">{chartType.label}</p>
                <p className="text-sm text-muted-foreground">{chartType.description}</p>
                <div className="mt-2 text-xs">
                  <p>Metrics: {chartType.supportedMetrics || 'Any'}</p>
                  <p>Dimensions: {chartType.supportedDimensions || 'Any'}</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
