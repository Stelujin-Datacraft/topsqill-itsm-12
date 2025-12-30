import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
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
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c'],
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
  const { records, loading, error } = useCrossReferenceData(
    targetFormId,
    selectedRefIds,
    []
  );

  const getFieldValue = (record: any, fieldId: string) => {
    return record.submission_data?.[fieldId];
  };

  const getFieldLabel = (fieldId: string) => {
    const field = targetFormFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

  const getFieldType = (fieldId: string) => {
    const field = targetFormFields.find(f => f.id === fieldId);
    return field?.field_type || 'text';
  };

  const extractNumericValue = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val.amount) return parseFloat(val.amount) || 0;
    if (typeof val === 'string') {
      // Handle currency format like "USD:100"
      if (val.includes(':')) {
        const parts = val.split(':');
        return parseFloat(parts[1]) || 0;
      }
      return parseFloat(val) || 0;
    }
    return 0;
  };

  const formatDisplayValue = (val: any): string => {
    if (val === null || val === undefined) return 'Unknown';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  // Get axis labels based on config
  const getAxisLabels = () => {
    if (config.mode === 'compare') {
      return {
        xLabel: config.compareXFieldId ? getFieldLabel(config.compareXFieldId) : '',
        yLabel: config.compareYFieldId ? getFieldLabel(config.compareYFieldId) : ''
      };
    }
    if (config.mode === 'calculate') {
      return {
        xLabel: config.groupByFieldId ? getFieldLabel(config.groupByFieldId) : '',
        yLabel: config.metricFieldId ? getFieldLabel(config.metricFieldId) : 'Value'
      };
    }
    if (config.mode === 'count') {
      return {
        xLabel: config.groupByFieldId ? getFieldLabel(config.groupByFieldId) : '',
        yLabel: 'Count'
      };
    }
    return { xLabel: '', yLabel: 'Value' };
  };

  // Process data based on mode
  const { chartData, dataKeys, isMultiSeries } = useMemo(() => {
    if (!records || records.length === 0) {
      return { chartData: [], dataKeys: ['value'], isMultiSeries: false };
    }

    if (config.mode === 'count') {
      const groupByField = config.groupByFieldId;
      if (!groupByField) {
        return {
          chartData: [{ name: 'Total Records', value: records.length }],
          dataKeys: ['value'],
          isMultiSeries: false
        };
      }

      const groups: Record<string, { count: number; stacks: Record<string, number> }> = {};
      
      records.forEach(record => {
        const groupValue = formatDisplayValue(getFieldValue(record, groupByField));
        
        if (!groups[groupValue]) {
          groups[groupValue] = { count: 0, stacks: {} };
        }
        groups[groupValue].count++;

        if (config.stackByFieldId) {
          const stackValue = formatDisplayValue(getFieldValue(record, config.stackByFieldId));
          groups[groupValue].stacks[stackValue] = (groups[groupValue].stacks[stackValue] || 0) + 1;
        }
      });

      if (config.stackByFieldId) {
        const allStackValues = new Set<string>();
        Object.values(groups).forEach(g => {
          Object.keys(g.stacks).forEach(k => allStackValues.add(k));
        });
        
        const stackKeysArr = Array.from(allStackValues);
        const data = Object.entries(groups).map(([name, d]) => {
          const entry: Record<string, any> = { name };
          stackKeysArr.forEach(sv => {
            entry[sv] = d.stacks[sv] || 0;
          });
          return entry;
        });

        return { chartData: data, dataKeys: stackKeysArr, isMultiSeries: true };
      }

      return {
        chartData: Object.entries(groups).map(([name, d]) => ({ name, value: d.count })),
        dataKeys: ['value'],
        isMultiSeries: false
      };
    }

    if (config.mode === 'calculate') {
      const metricField = config.metricFieldId;
      const groupByField = config.groupByFieldId;
      const aggregationType = config.aggregationType || 'sum';

      if (!metricField) {
        return { chartData: [], dataKeys: ['value'], isMultiSeries: false };
      }

      const aggregate = (values: number[]): number => {
        if (values.length === 0) return 0;
        switch (aggregationType) {
          case 'sum': return values.reduce((a, b) => a + b, 0);
          case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
          case 'min': return Math.min(...values);
          case 'max': return Math.max(...values);
          case 'median':
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          default: return values.reduce((a, b) => a + b, 0);
        }
      };

      if (!groupByField) {
        const values = records.map(r => extractNumericValue(getFieldValue(r, metricField))).filter(v => !isNaN(v));
        return {
          chartData: [{ name: getFieldLabel(metricField), value: Math.round(aggregate(values) * 100) / 100 }],
          dataKeys: ['value'],
          isMultiSeries: false
        };
      }

      const groups: Record<string, number[]> = {};
      records.forEach(record => {
        const groupValue = formatDisplayValue(getFieldValue(record, groupByField));
        const numVal = extractNumericValue(getFieldValue(record, metricField));
        if (!isNaN(numVal)) {
          if (!groups[groupValue]) groups[groupValue] = [];
          groups[groupValue].push(numVal);
        }
      });

      return {
        chartData: Object.entries(groups).map(([name, values]) => ({
          name,
          value: Math.round(aggregate(values) * 100) / 100
        })),
        dataKeys: ['value'],
        isMultiSeries: false
      };
    }

    if (config.mode === 'compare') {
      const xFieldId = config.compareXFieldId;
      const yFieldId = config.compareYFieldId;

      if (!xFieldId || !yFieldId) {
        return { chartData: [], dataKeys: ['value'], isMultiSeries: false };
      }

      const xFieldType = getFieldType(xFieldId);
      const yFieldType = getFieldType(yFieldId);
      const isXNumeric = NUMERIC_FIELD_TYPES.includes(xFieldType);
      const isYNumeric = NUMERIC_FIELD_TYPES.includes(yFieldType);
      
      const xLabel = getFieldLabel(xFieldId);
      const yLabel = getFieldLabel(yFieldId);

      if (isXNumeric && isYNumeric) {
        // Both numeric - show each record with X value as name, both field values as bars
        const data = records.map((record, index) => {
          const xVal = extractNumericValue(getFieldValue(record, xFieldId));
          const yVal = extractNumericValue(getFieldValue(record, yFieldId));
          return {
            name: `${xLabel}: ${xVal}`,
            [xLabel]: xVal,
            [yLabel]: yVal
          };
        });
        return { chartData: data, dataKeys: [xLabel, yLabel], isMultiSeries: true };
      }

      if (!isXNumeric && isYNumeric) {
        // X is text (category), Y is numeric - X values as categories, Y as bars
        const groups: Record<string, number[]> = {};
        records.forEach(record => {
          const xVal = formatDisplayValue(getFieldValue(record, xFieldId));
          const yVal = extractNumericValue(getFieldValue(record, yFieldId));
          if (!groups[xVal]) groups[xVal] = [];
          groups[xVal].push(yVal);
        });

        const data = Object.entries(groups).map(([name, values]) => ({
          name, // X field value as category name
          [yLabel]: Math.round((values.reduce((a, b) => a + b, 0)) * 100) / 100
        }));
        return { chartData: data, dataKeys: [yLabel], isMultiSeries: false };
      }

      if (isXNumeric && !isYNumeric) {
        // X is numeric, Y is text - X values shown, Y values as legend
        const allYValues = new Set<string>();
        records.forEach(record => {
          allYValues.add(formatDisplayValue(getFieldValue(record, yFieldId)));
        });

        const yValuesArr = Array.from(allYValues);
        
        // Group by Y value, show X values
        const groupedByY: Record<string, { xValues: number[], records: any[] }> = {};
        yValuesArr.forEach(yVal => {
          groupedByY[yVal] = { xValues: [], records: [] };
        });

        records.forEach((record, index) => {
          const yVal = formatDisplayValue(getFieldValue(record, yFieldId));
          const xVal = extractNumericValue(getFieldValue(record, xFieldId));
          groupedByY[yVal].xValues.push(xVal);
          groupedByY[yVal].records.push(record);
        });

        // Create data points - each record shown with its X value, colored by Y
        const data = records.map((record, index) => {
          const xVal = extractNumericValue(getFieldValue(record, xFieldId));
          const yVal = formatDisplayValue(getFieldValue(record, yFieldId));
          
          const entry: Record<string, any> = {
            name: `#${index + 1}`
          };
          
          // Only the matching Y category gets the X value
          yValuesArr.forEach(yKey => {
            entry[yKey] = yVal === yKey ? xVal : 0;
          });
          return entry;
        });

        return { chartData: data, dataKeys: yValuesArr, isMultiSeries: true };
      }

      // Both text - X values as categories, Y values as legend (stacked count)
      const groups: Record<string, Record<string, number>> = {};
      const allYValues = new Set<string>();

      records.forEach(record => {
        const xVal = formatDisplayValue(getFieldValue(record, xFieldId));
        const yVal = formatDisplayValue(getFieldValue(record, yFieldId));
        allYValues.add(yVal);
        if (!groups[xVal]) groups[xVal] = {};
        groups[xVal][yVal] = (groups[xVal][yVal] || 0) + 1;
      });

      const yValuesArr = Array.from(allYValues);
      const data = Object.entries(groups).map(([xValue, yValues]) => {
        const entry: Record<string, any> = { name: xValue }; // X field value as name
        yValuesArr.forEach(yVal => {
          entry[yVal] = yValues[yVal] || 0;
        });
        return entry;
      });

      return { chartData: data, dataKeys: yValuesArr, isMultiSeries: true };
    }

    return { chartData: [], dataKeys: ['value'], isMultiSeries: false };
  }, [records, config, targetFormFields]);

  const colors = CHART_COLORS[config.colorTheme || 'default'];
  const chartHeight = config.height || 280;
  const axisLabels = getAxisLabels();

  if (!config.enabled) return null;

  if (selectedRefIds.length === 0) {
    return (
      <Card className="mt-3 border-dashed">
        <CardContent className="py-6 text-center text-muted-foreground">
          <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select records to view chart</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="mt-3">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading chart...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-3 border-destructive">
        <CardContent className="py-4 text-center text-destructive text-sm">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="mt-3">
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          No data available for chart
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    const chartType = config.chartType || 'bar';
    const showLegend = isMultiSeries && dataKeys.length > 1;

    // Chart margins - minimal for full width usage
    const margins = { 
      top: 20, 
      right: showLegend ? 140 : 15, 
      left: 15, 
      bottom: axisLabels.xLabel ? 50 : 30 
    };

    if (chartType === 'pie' || chartType === 'donut') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={chartType === 'donut' ? 70 : 85}
              innerRadius={chartType === 'donut' ? 40 : 0}
              paddingAngle={2}
              label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => [value, 'Value']}
              contentStyle={{ fontSize: '12px' }}
            />
            <Legend 
              layout="vertical" 
              align="right" 
              verticalAlign="middle"
              wrapperStyle={{ fontSize: '11px', paddingLeft: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData} margin={margins}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
              angle={chartData.length > 5 ? -30 : 0}
              textAnchor={chartData.length > 5 ? 'end' : 'middle'}
              height={chartData.length > 5 ? 60 : 30}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={50}
              tickFormatter={(value) => typeof value === 'number' && value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
            />
            <Tooltip 
              contentStyle={{ fontSize: '12px', background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              formatter={(value: number, name: string) => [value, name]}
            />
            {showLegend && (
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '11px', paddingLeft: '10px' }}
              />
            )}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 4, fill: colors[index % colors.length] }}
                activeDot={{ r: 6 }}
                name={key}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={chartData} margin={margins}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
              angle={chartData.length > 5 ? -30 : 0}
              textAnchor={chartData.length > 5 ? 'end' : 'middle'}
              height={chartData.length > 5 ? 60 : 30}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={50}
              tickFormatter={(value) => typeof value === 'number' && value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
            />
            <Tooltip 
              contentStyle={{ fontSize: '12px', background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              formatter={(value: number, name: string) => [value, name]}
            />
            {showLegend && (
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '11px', paddingLeft: '10px' }}
              />
            )}
            {dataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={colors[index % colors.length]}
                stroke={colors[index % colors.length]}
                fillOpacity={0.6}
                name={key}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Default: Bar chart
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} margin={margins} barCategoryGap="25%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval={0}
            angle={chartData.length > 5 ? -30 : 0}
            textAnchor={chartData.length > 5 ? 'end' : 'middle'}
            height={chartData.length > 5 ? 60 : 30}
          />
          <YAxis 
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(value) => typeof value === 'number' && value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
          />
          <Tooltip 
            contentStyle={{ fontSize: '12px', background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
            formatter={(value: number, name: string) => [value, name]}
          />
          {showLegend && (
            <Legend 
              layout="vertical" 
              align="right" 
              verticalAlign="middle"
              wrapperStyle={{ fontSize: '11px', paddingLeft: '10px' }}
            />
          )}
          {dataKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={colors[index % colors.length]}
              radius={[4, 4, 0, 0]}
              name={key}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="w-full border">
      {config.title && (
        <CardHeader className="py-2 px-4 border-b bg-muted/30">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {config.title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-2">
        <div className="w-full" style={{ minHeight: chartHeight }}>
          {renderChart()}
        </div>
        {/* Axis labels below chart */}
        <div className="flex justify-between items-center px-4 mt-1">
          {axisLabels.yLabel && (
            <span className="text-xs text-muted-foreground font-medium">
              Y: {axisLabels.yLabel}
            </span>
          )}
          {axisLabels.xLabel && (
            <span className="text-xs text-muted-foreground font-medium ml-auto">
              X: {axisLabels.xLabel}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
