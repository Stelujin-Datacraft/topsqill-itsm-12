import React from 'react';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListFilter } from 'lucide-react';

interface MaxDataPointsControlProps {
  config: ChartConfig;
  onConfigChange: (updates: Partial<ChartConfig>) => void;
  stepNumber?: number;
  label?: string;
  description?: string;
}

export function MaxDataPointsControl({ 
  config, 
  onConfigChange, 
  stepNumber,
  label = "Max Records Visible",
  description = "Limit the number of data points shown on the chart"
}: MaxDataPointsControlProps) {
  const handleChange = (value: string) => {
    const num = parseInt(value);
    if (value === '' || isNaN(num)) {
      onConfigChange({ maxDataPoints: undefined });
    } else {
      onConfigChange({ maxDataPoints: Math.max(1, Math.min(1000, num)) });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {stepNumber ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground text-sm font-bold shrink-0">
              {stepNumber}
            </div>
          ) : (
            <ListFilter className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <CardTitle className="text-base">{label}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={1000}
            value={config.maxDataPoints || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="All (no limit)"
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">
            {config.maxDataPoints 
              ? `Showing top ${config.maxDataPoints} records` 
              : 'Showing all records'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Leave empty to show all data points. Max: 1000
        </p>
      </CardContent>
    </Card>
  );
}
