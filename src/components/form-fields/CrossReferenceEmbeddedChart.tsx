import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Loader2, BarChart3 } from 'lucide-react';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';
import { EmbeddedChartConfig } from '@/types/reports';

interface CrossReferenceEmbeddedChartProps {
  config: EmbeddedChartConfig;
  targetFormId: string;
  selectedRefIds: string[];
  targetFormFields: Array<{ id: string; label: string; field_type: string; options?: any }>;
}

const NUMERIC_FIELD_TYPES = ['number', 'currency', 'rating', 'star-rating', 'slider'];

const CHART_COLORS = {
  default: ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'],
  vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
  pastel: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFE4BA', '#E8BAFF'],
  monochrome: ['#2C3E50', '#34495E', '#5D6D7E', '#85929E', '#ABB2B9', '#D5D8DC'],
};

export function CrossReferenceEmbeddedChart({
  config,
  targetFormId,
  selectedRefIds,
  targetFormFields
}: CrossReferenceEmbeddedChartProps) {
  // Fetch the actual data for selected cross-reference records
  const { records, loading, error } = useCrossReferenceData(
    targetFormId,
    selectedRefIds,
    [] // We'll process all fields from submission_data
  );

  // Process data based on mode
  const chartData = useMemo(() => {
    if (!records || records.length === 0) return [];

    const getFieldValue = (record: any, fieldId: string) => {
      return record.submission_data?.[fieldId];
    };

    const getFieldLabel = (fieldId: string) => {
      const field = targetFormFields.find(f => f.id === fieldId);
      return field?.label || fieldId;
    };

    const getFieldOptions = (fieldId: string) => {
      const field = targetFormFields.find(f => f.id === fieldId);
      return field?.options || [];
    };

    if (config.mode === 'count') {
      // Count mode: group by field and count occurrences
      const groupByField = config.groupByFieldId;
      if (!groupByField) {
        return [{ name: 'Total Records', value: records.length }];
      }

      const groups: Record<string, { count: number; stacks: Record<string, number> }> = {};
      
      records.forEach(record => {
        let groupValue = getFieldValue(record, groupByField);
        // Handle array values (multi-select)
        if (Array.isArray(groupValue)) {
          groupValue = groupValue.join(', ');
        }
        const groupKey = String(groupValue || 'Unknown');
        
        if (!groups[groupKey]) {
          groups[groupKey] = { count: 0, stacks: {} };
        }
        groups[groupKey].count++;

        // Handle stacking
        if (config.stackByFieldId) {
          let stackValue = getFieldValue(record, config.stackByFieldId);
          if (Array.isArray(stackValue)) {
            stackValue = stackValue.join(', ');
          }
          const stackKey = String(stackValue || 'Unknown');
          groups[groupKey].stacks[stackKey] = (groups[groupKey].stacks[stackKey] || 0) + 1;
        }
      });

      if (config.stackByFieldId) {
        // Get all unique stack values
        const allStackValues = new Set<string>();
        Object.values(groups).forEach(g => {
          Object.keys(g.stacks).forEach(k => allStackValues.add(k));
        });
        
        return Object.entries(groups).map(([name, data]) => {
          const entry: Record<string, any> = { name };
          allStackValues.forEach(stackValue => {
            entry[stackValue] = data.stacks[stackValue] || 0;
          });
          return entry;
        });
      }

      return Object.entries(groups).map(([name, data]) => ({
        name,
        value: data.count
      }));
    }

    if (config.mode === 'calculate') {
      // Calculate mode: aggregate numeric values
      const metricField = config.metricFieldId;
      const groupByField = config.groupByFieldId;
      const aggregationType = config.aggregationType || 'sum';

      if (!metricField) {
        return [];
      }

      if (!groupByField) {
        // Single aggregated value
        const values = records
          .map(r => {
            const val = getFieldValue(r, metricField);
            // Handle currency objects
            if (val && typeof val === 'object' && val.amount) {
              return parseFloat(val.amount);
            }
            return parseFloat(val);
          })
          .filter(v => !isNaN(v));

        let aggregatedValue = 0;
        switch (aggregationType) {
          case 'sum':
            aggregatedValue = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            aggregatedValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case 'min':
            aggregatedValue = values.length > 0 ? Math.min(...values) : 0;
            break;
          case 'max':
            aggregatedValue = values.length > 0 ? Math.max(...values) : 0;
            break;
          case 'median':
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            aggregatedValue = sorted.length > 0
              ? sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
              : 0;
            break;
        }

        return [{
          name: getFieldLabel(metricField),
          value: Math.round(aggregatedValue * 100) / 100
        }];
      }

      // Grouped aggregation
      const groups: Record<string, number[]> = {};
      records.forEach(record => {
        let groupValue = getFieldValue(record, groupByField);
        if (Array.isArray(groupValue)) {
          groupValue = groupValue.join(', ');
        }
        const groupKey = String(groupValue || 'Unknown');
        
        const val = getFieldValue(record, metricField);
        let numVal: number;
        if (val && typeof val === 'object' && val.amount) {
          numVal = parseFloat(val.amount);
        } else {
          numVal = parseFloat(val);
        }

        if (!isNaN(numVal)) {
          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(numVal);
        }
      });

      return Object.entries(groups).map(([name, values]) => {
        let aggregatedValue = 0;
        switch (aggregationType) {
          case 'sum':
            aggregatedValue = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            aggregatedValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case 'min':
            aggregatedValue = values.length > 0 ? Math.min(...values) : 0;
            break;
          case 'max':
            aggregatedValue = values.length > 0 ? Math.max(...values) : 0;
            break;
          case 'median':
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            aggregatedValue = sorted.length > 0
              ? sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
              : 0;
            break;
        }
        return {
          name,
          value: Math.round(aggregatedValue * 100) / 100
        };
      });
    }

    if (config.mode === 'compare') {
      // Compare mode: show two fields side by side
      const xFieldId = config.compareXFieldId;
      const yFieldId = config.compareYFieldId;

      if (!xFieldId || !yFieldId) {
        return [];
      }

      const xField = targetFormFields.find(f => f.id === xFieldId);
      const yField = targetFormFields.find(f => f.id === yFieldId);
      const isYFieldNumeric = yField && NUMERIC_FIELD_TYPES.includes(yField.field_type);

      if (isYFieldNumeric) {
        // Both fields numeric - show side by side values
        return records.map((record, index) => {
          let xVal = getFieldValue(record, xFieldId);
          let yVal = getFieldValue(record, yFieldId);

          // Handle currency
          if (xVal && typeof xVal === 'object' && xVal.amount) xVal = parseFloat(xVal.amount);
          if (yVal && typeof yVal === 'object' && yVal.amount) yVal = parseFloat(yVal.amount);

          const xLabel = getFieldLabel(xFieldId);
          const yLabel = getFieldLabel(yFieldId);

          return {
            name: record.submission_ref_id || `Record ${index + 1}`,
            [xLabel]: typeof xVal === 'number' ? xVal : parseFloat(xVal) || 0,
            [yLabel]: typeof yVal === 'number' ? yVal : parseFloat(yVal) || 0
          };
        });
      } else {
        // Y field is text - use encoded legend transformation (group by X, stack by Y values)
        const groups: Record<string, Record<string, number>> = {};
        const allYValues = new Set<string>();

        records.forEach(record => {
          let xVal = getFieldValue(record, xFieldId);
          let yVal = getFieldValue(record, yFieldId);

          // Handle arrays
          if (Array.isArray(xVal)) xVal = xVal.join(', ');
          if (Array.isArray(yVal)) yVal = yVal.join(', ');

          const xKey = String(xVal || 'Unknown');
          const yKey = String(yVal || 'Unknown');

          allYValues.add(yKey);

          if (!groups[xKey]) {
            groups[xKey] = {};
          }
          groups[xKey][yKey] = (groups[xKey][yKey] || 0) + 1;
        });

        // Transform to chart data with each Y value as a separate bar/series
        return Object.entries(groups).map(([xValue, yValues]) => {
          const entry: Record<string, any> = { name: xValue };
          allYValues.forEach(yVal => {
            entry[yVal] = yValues[yVal] || 0;
          });
          return entry;
        });
      }
    }

    return [];
  }, [records, config, targetFormFields]);

  // Check if compare mode uses text Y field (for legend)
  const compareUsesTextLegend = useMemo(() => {
    if (config.mode !== 'compare' || !config.compareYFieldId) return false;
    const yField = targetFormFields.find(f => f.id === config.compareYFieldId);
    return yField && !NUMERIC_FIELD_TYPES.includes(yField.field_type);
  }, [config.mode, config.compareYFieldId, targetFormFields]);

  const colors = CHART_COLORS[config.colorTheme || 'default'];
  const chartHeight = config.height || 300;

  // Get stack keys for stacked bar charts
  const stackKeys = useMemo(() => {
    if (config.mode === 'count' && config.stackByFieldId && chartData.length > 0) {
      const keys = Object.keys(chartData[0]).filter(k => k !== 'name');
      return keys;
    }
    return [];
  }, [chartData, config.mode, config.stackByFieldId]);

  // Get compare field labels (for numeric compare mode or text legend mode)
  const compareFieldLabels = useMemo(() => {
    if (config.mode === 'compare' && chartData.length > 0) {
      return Object.keys(chartData[0]).filter(k => k !== 'name');
    }
    return [];
  }, [chartData, config.mode]);

  if (!config.enabled) {
    return null;
  }

  if (selectedRefIds.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="py-8 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select records to view chart</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="mt-4">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading chart data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4 border-destructive">
        <CardContent className="py-4 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="py-8 text-center text-muted-foreground">
          No data available for chart
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    const chartType = config.chartType || 'bar';

    if (chartType === 'pie' || chartType === 'donut') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={chartType === 'donut' ? 80 : 100}
              innerRadius={chartType === 'donut' ? 50 : 0}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      const hasMultipleFields = stackKeys.length > 0 || compareFieldLabels.length > 0;
      const dataKeys = hasMultipleFields ? (stackKeys.length > 0 ? stackKeys : compareFieldLabels) : ['value'];

      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length] }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'area') {
      const hasMultipleFields = stackKeys.length > 0 || compareFieldLabels.length > 0;
      const dataKeys = hasMultipleFields ? (stackKeys.length > 0 ? stackKeys : compareFieldLabels) : ['value'];

      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={colors[index % colors.length]}
                stroke={colors[index % colors.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Default: Bar chart
    const hasMultipleFields = stackKeys.length > 0 || compareFieldLabels.length > 0;
    const dataKeys = hasMultipleFields ? (stackKeys.length > 0 ? stackKeys : compareFieldLabels) : ['value'];

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {dataKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={colors[index % colors.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="mt-4">
      {config.title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {config.title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={config.title ? 'pt-0' : ''}>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
