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

const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c',
  '#d084d0', '#ffb347', '#87ceeb', '#98fb98', '#dda0dd', '#f0e68c'
];

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
    if (typeof val === 'object') {
      if (val.amount && val.code) return `${val.code} ${val.amount}`;
      return JSON.stringify(val);
    }
    return String(val);
  };

  // Get axis labels
  const axisLabels = useMemo(() => {
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
  }, [config, targetFormFields]);

  // Process data based on mode
  const { chartData, dataKeys, isMultiSeries, recordsMap } = useMemo(() => {
    if (!records || records.length === 0) {
      return { chartData: [], dataKeys: ['value'], isMultiSeries: false, recordsMap: {} };
    }

    const rMap: Record<string, any[]> = {};

    if (config.mode === 'count') {
      const groupByField = config.groupByFieldId;
      if (!groupByField) {
        return {
          chartData: [{ name: 'Total Records', value: records.length, _records: records }],
          dataKeys: ['value'],
          isMultiSeries: false,
          recordsMap: { 'Total Records': records }
        };
      }

      const groups: Record<string, { count: number; stacks: Record<string, number>; records: any[] }> = {};
      
      records.forEach(record => {
        const groupValue = formatDisplayValue(getFieldValue(record, groupByField));
        
        if (!groups[groupValue]) {
          groups[groupValue] = { count: 0, stacks: {}, records: [] };
        }
        groups[groupValue].count++;
        groups[groupValue].records.push(record);

        if (config.stackByFieldId) {
          const stackValue = formatDisplayValue(getFieldValue(record, config.stackByFieldId));
          groups[groupValue].stacks[stackValue] = (groups[groupValue].stacks[stackValue] || 0) + 1;
        }
      });

      Object.entries(groups).forEach(([key, val]) => {
        rMap[key] = val.records;
      });

      if (config.stackByFieldId) {
        const allStackValues = new Set<string>();
        Object.values(groups).forEach(g => {
          Object.keys(g.stacks).forEach(k => allStackValues.add(k));
        });
        
        const stackKeysArr = Array.from(allStackValues);
        const data = Object.entries(groups).map(([name, d]) => {
          const entry: Record<string, any> = { name, _records: d.records };
          stackKeysArr.forEach(sv => {
            entry[sv] = d.stacks[sv] || 0;
          });
          return entry;
        });

        return { chartData: data, dataKeys: stackKeysArr, isMultiSeries: true, recordsMap: rMap };
      }

      return {
        chartData: Object.entries(groups).map(([name, d]) => ({ name, value: d.count, _records: d.records })),
        dataKeys: ['value'],
        isMultiSeries: false,
        recordsMap: rMap
      };
    }

    if (config.mode === 'calculate') {
      const metricField = config.metricFieldId;
      const groupByField = config.groupByFieldId;
      const aggregationType = config.aggregationType || 'sum';

      if (!metricField) {
        return { chartData: [], dataKeys: ['value'], isMultiSeries: false, recordsMap: {} };
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
          chartData: [{ name: getFieldLabel(metricField), value: Math.round(aggregate(values) * 100) / 100, _records: records }],
          dataKeys: ['value'],
          isMultiSeries: false,
          recordsMap: { [getFieldLabel(metricField)]: records }
        };
      }

      const groups: Record<string, { values: number[]; records: any[] }> = {};
      records.forEach(record => {
        const groupValue = formatDisplayValue(getFieldValue(record, groupByField));
        const numVal = extractNumericValue(getFieldValue(record, metricField));
        if (!isNaN(numVal)) {
          if (!groups[groupValue]) groups[groupValue] = { values: [], records: [] };
          groups[groupValue].values.push(numVal);
          groups[groupValue].records.push(record);
        }
      });

      Object.entries(groups).forEach(([key, val]) => {
        rMap[key] = val.records;
      });

      return {
        chartData: Object.entries(groups).map(([name, d]) => ({
          name,
          value: Math.round(aggregate(d.values) * 100) / 100,
          _records: d.records
        })),
        dataKeys: ['value'],
        isMultiSeries: false,
        recordsMap: rMap
      };
    }

    if (config.mode === 'compare') {
      const xFieldId = config.compareXFieldId;
      const yFieldId = config.compareYFieldId;

      if (!xFieldId || !yFieldId) {
        return { chartData: [], dataKeys: ['value'], isMultiSeries: false, recordsMap: {} };
      }

      const xFieldType = getFieldType(xFieldId);
      const yFieldType = getFieldType(yFieldId);
      const isXNumeric = NUMERIC_FIELD_TYPES.includes(xFieldType);
      const isYNumeric = NUMERIC_FIELD_TYPES.includes(yFieldType);
      
      const xLabel = getFieldLabel(xFieldId);
      const yLabel = getFieldLabel(yFieldId);

      if (isYNumeric) {
        // Y is numeric - X values on x-axis, Y values as bars
        const groups: Record<string, { values: number[]; records: any[] }> = {};
        
        records.forEach(record => {
          const xVal = formatDisplayValue(getFieldValue(record, xFieldId));
          const yVal = extractNumericValue(getFieldValue(record, yFieldId));
          
          if (!groups[xVal]) groups[xVal] = { values: [], records: [] };
          groups[xVal].values.push(yVal);
          groups[xVal].records.push(record);
        });

        Object.entries(groups).forEach(([key, val]) => {
          rMap[key] = val.records;
        });

        const data = Object.entries(groups).map(([name, d]) => ({
          name, // X field actual value
          [yLabel]: d.values.length === 1 ? d.values[0] : Math.round((d.values.reduce((a, b) => a + b, 0)) * 100) / 100,
          _records: d.records
        }));

        return { chartData: data, dataKeys: [yLabel], isMultiSeries: false, recordsMap: rMap };
      }

      // Y is text - show as legend with stacked bars
      const groups: Record<string, Record<string, { count: number; records: any[] }>> = {};
      const allYValues = new Set<string>();

      records.forEach(record => {
        const xVal = formatDisplayValue(getFieldValue(record, xFieldId));
        const yVal = formatDisplayValue(getFieldValue(record, yFieldId));
        allYValues.add(yVal);
        
        if (!groups[xVal]) groups[xVal] = {};
        if (!groups[xVal][yVal]) groups[xVal][yVal] = { count: 0, records: [] };
        groups[xVal][yVal].count++;
        groups[xVal][yVal].records.push(record);
      });

      const yValuesArr = Array.from(allYValues);
      
      Object.entries(groups).forEach(([xKey, yGroups]) => {
        const allRecords: any[] = [];
        Object.values(yGroups).forEach(g => allRecords.push(...g.records));
        rMap[xKey] = allRecords;
      });

      const data = Object.entries(groups).map(([xValue, yValues]) => {
        const entry: Record<string, any> = { name: xValue }; // X field actual value
        const allRecords: any[] = [];
        yValuesArr.forEach(yVal => {
          entry[yVal] = yValues[yVal]?.count || 0;
          if (yValues[yVal]?.records) allRecords.push(...yValues[yVal].records);
        });
        entry._records = allRecords;
        return entry;
      });

      return { chartData: data, dataKeys: yValuesArr, isMultiSeries: true, recordsMap: rMap };
    }

    return { chartData: [], dataKeys: ['value'], isMultiSeries: false, recordsMap: {} };
  }, [records, config, targetFormFields]);

  const colors = CHART_COLORS;
  const chartHeight = config.height || 300;

  if (!config.enabled) return null;

  if (selectedRefIds.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select records to view chart</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading chart...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-4 text-center text-destructive text-sm">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No data available for chart
        </CardContent>
      </Card>
    );
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = chartData.find(d => d.name === label);
    const recordCount = dataPoint?._records?.length || 0;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm max-w-xs">
        <div className="font-semibold text-foreground mb-2 border-b pb-1">
          {axisLabels.xLabel && <span className="text-muted-foreground">{axisLabels.xLabel}: </span>}
          {label}
        </div>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-1 border-t text-xs text-muted-foreground">
          {recordCount} record{recordCount !== 1 ? 's' : ''}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    const chartType = config.chartType || 'bar';
    const showLegend = isMultiSeries && dataKeys.length > 1;
    const barCount = chartData.length;

    // Margins with axis labels
    const margins = { 
      top: 20, 
      right: showLegend ? 150 : 20, 
      left: 60, 
      bottom: 60
    };

    if (chartType === 'pie' || chartType === 'donut') {
      const outerR = Math.min(chartHeight * 0.35, 100);
      const innerR = chartType === 'donut' ? outerR * 0.6 : 0;
      
      // Custom label renderer for outside labels
      const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, name, value, percent }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = outerRadius + 25;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        const textAnchor = x > cx ? 'start' : 'end';
        
        // Only show label if slice is big enough (>5%)
        if (percent < 0.05) return null;
        
        return (
          <text
            x={x}
            y={y}
            textAnchor={textAnchor}
            dominantBaseline="central"
            className="fill-foreground"
            style={{ fontSize: '11px', fontWeight: 500 }}
          >
            {name.length > 12 ? `${name.slice(0, 12)}...` : name}
            <tspan x={x} dy="14" style={{ fontSize: '10px', fontWeight: 400 }} className="fill-muted-foreground">
              {value} ({(percent * 100).toFixed(0)}%)
            </tspan>
          </text>
        );
      };

      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart margin={{ top: 30, right: 80, left: 80, bottom: 30 }}>
            <Pie
              data={chartData}
              dataKey={dataKeys[0] || 'value'}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={outerR}
              innerRadius={innerR}
              paddingAngle={2}
              label={renderCustomLabel}
              labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeOpacity: 0.5 }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              layout="horizontal" 
              align="center" 
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              formatter={(value) => <span className="text-foreground">{value}</span>}
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
              axisLine={{ stroke: '#ccc' }}
              label={{ value: axisLabels.xLabel, position: 'bottom', offset: 40, fontSize: 12, fontWeight: 500 }}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#ccc' }}
              label={{ value: axisLabels.yLabel, angle: -90, position: 'insideLeft', offset: -5, fontSize: 12, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && (
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '12px', paddingLeft: '15px' }}
              />
            )}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 5, fill: colors[index % colors.length] }}
                activeDot={{ r: 7 }}
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
              axisLine={{ stroke: '#ccc' }}
              label={{ value: axisLabels.xLabel, position: 'bottom', offset: 40, fontSize: 12, fontWeight: 500 }}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#ccc' }}
              label={{ value: axisLabels.yLabel, angle: -90, position: 'insideLeft', offset: -5, fontSize: 12, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && (
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '12px', paddingLeft: '15px' }}
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

    // Default: Bar chart - full width, broad bars
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart 
          data={chartData} 
          margin={margins} 
          barCategoryGap={barCount <= 3 ? '30%' : '15%'}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#ccc' }}
            label={{ value: axisLabels.xLabel, position: 'bottom', offset: 40, fontSize: 12, fontWeight: 500 }}
          />
          <YAxis 
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#ccc' }}
            label={{ value: axisLabels.yLabel, angle: -90, position: 'insideLeft', offset: -5, fontSize: 12, fontWeight: 500 }}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend 
              layout="vertical" 
              align="right" 
              verticalAlign="middle"
              wrapperStyle={{ fontSize: '12px', paddingLeft: '15px' }}
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
    <Card className="w-full">
      {config.title && (
        <CardHeader className="py-3 px-4 border-b bg-muted/30">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {config.title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-4">
        <div className="w-full" style={{ height: chartHeight }}>
          {renderChart()}
        </div>
      </CardContent>
    </Card>
  );
}
