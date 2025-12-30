import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
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

const COLOR_THEMES: Record<string, string[]> = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#6366f1', '#d084d0', '#8dd1e1', '#ffb347'],
  vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'],
  pastel: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFB3FF', '#D5AAFF', '#FFD3A5', '#AAFFE6'],
  monochrome: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7', '#85929E', '#5D6D7E', '#AEB6BF'],
  ocean: ['#006A6B', '#1B9AAA', '#40C9A2', '#9FFFCB', '#06FFA5', '#4DD0E1', '#26C6DA', '#00BCD4'],
  sunset: ['#FF6B35', '#F7931E', '#FFD23F', '#F06292', '#FF8A65', '#FFAB40', '#FFCC02', '#FF7043'],
  nature: ['#8BC34A', '#4CAF50', '#009688', '#607D8B', '#66BB6A', '#26A69A', '#78909C', '#689F38'],
  business: ['#1976D2', '#1565C0', '#0D47A1', '#42A5F5', '#2196F3', '#03A9F4', '#0288D1', '#1E88E5']
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

  // Get field options for color lookup
  const getFieldOptions = (fieldId: string) => {
    const field = targetFormFields.find(f => f.id === fieldId);
    if (field?.options && Array.isArray(field.options)) {
      const optionsMap = new Map<string, { label: string; color?: string }>();
      field.options.forEach((opt: any) => {
        const optValue = opt.value || opt.label || '';
        optionsMap.set(optValue, {
          label: opt.label || opt.value || optValue,
          color: opt.color
        });
      });
      return optionsMap;
    }
    return null;
  };

  // Process data based on mode
  const { chartData, dataKeys, isMultiSeries, recordsMap, legendMapping, legendFieldName, isEncodedMode } = useMemo(() => {
    if (!records || records.length === 0) {
      return { chartData: [], dataKeys: ['value'], isMultiSeries: false, recordsMap: {}, legendMapping: [], legendFieldName: '', isEncodedMode: false };
    }

    const rMap: Record<string, any[]> = {};

    if (config.mode === 'count') {
      const groupByField = config.groupByFieldId;
      if (!groupByField) {
        return {
          chartData: [{ name: 'Total Records', value: records.length, _records: records }],
          dataKeys: ['value'],
          isMultiSeries: false,
          recordsMap: { 'Total Records': records },
          legendMapping: [],
          legendFieldName: '',
          isEncodedMode: false
        };
      }

      const fieldOptions = getFieldOptions(groupByField);
      const groups: Record<string, { count: number; stacks: Record<string, number>; records: any[]; color?: string }> = {};
      
      records.forEach(record => {
        const rawValue = getFieldValue(record, groupByField);
        const groupValue = formatDisplayValue(rawValue);
        const optionInfo = fieldOptions?.get(groupValue);
        
        if (!groups[groupValue]) {
          groups[groupValue] = { count: 0, stacks: {}, records: [], color: optionInfo?.color };
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

      // Create legend mapping with codes
      const sortedGroups = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
      const legendMap = sortedGroups.map(([label, data], index) => ({
        code: index + 1,
        label,
        color: data.color
      }));

      if (config.stackByFieldId) {
        const stackFieldOptions = getFieldOptions(config.stackByFieldId);
        const allStackValues = new Set<string>();
        Object.values(groups).forEach(g => {
          Object.keys(g.stacks).forEach(k => allStackValues.add(k));
        });
        
        const stackKeysArr = Array.from(allStackValues).sort();
        const stackLegendMap = stackKeysArr.map((label, index) => ({
          code: index + 1,
          label,
          color: stackFieldOptions?.get(label)?.color
        }));

        const data = Object.entries(groups).map(([name, d]) => {
          const entry: Record<string, any> = { name, _records: d.records };
          stackKeysArr.forEach(sv => {
            entry[sv] = d.stacks[sv] || 0;
          });
          return entry;
        });

        return { 
          chartData: data, 
          dataKeys: stackKeysArr, 
          isMultiSeries: true, 
          recordsMap: rMap,
          legendMapping: stackLegendMap,
          legendFieldName: getFieldLabel(config.stackByFieldId),
          isEncodedMode: true
        };
      }

      return {
        chartData: sortedGroups.map(([name, d], index) => ({ 
          name, 
          value: d.count, 
          _records: d.records,
          _code: index + 1,
          _color: d.color
        })),
        dataKeys: ['value'],
        isMultiSeries: false,
        recordsMap: rMap,
        legendMapping: legendMap,
        legendFieldName: getFieldLabel(groupByField),
        isEncodedMode: true
      };
    }

    if (config.mode === 'calculate') {
      const metricField = config.metricFieldId;
      const groupByField = config.groupByFieldId;
      const aggregationType = config.aggregationType || 'sum';

      if (!metricField) {
        return { chartData: [], dataKeys: ['value'], isMultiSeries: false, recordsMap: {}, legendMapping: [], legendFieldName: '', isEncodedMode: false };
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
          recordsMap: { [getFieldLabel(metricField)]: records },
          legendMapping: [],
          legendFieldName: '',
          isEncodedMode: false
        };
      }

      const fieldOptions = getFieldOptions(groupByField);
      const groups: Record<string, { values: number[]; records: any[]; color?: string }> = {};
      records.forEach(record => {
        const groupValue = formatDisplayValue(getFieldValue(record, groupByField));
        const optionInfo = fieldOptions?.get(groupValue);
        const numVal = extractNumericValue(getFieldValue(record, metricField));
        if (!isNaN(numVal)) {
          if (!groups[groupValue]) groups[groupValue] = { values: [], records: [], color: optionInfo?.color };
          groups[groupValue].values.push(numVal);
          groups[groupValue].records.push(record);
        }
      });

      Object.entries(groups).forEach(([key, val]) => {
        rMap[key] = val.records;
      });

      const sortedGroups = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
      const legendMap = sortedGroups.map(([label, data], index) => ({
        code: index + 1,
        label,
        color: data.color
      }));

      return {
        chartData: sortedGroups.map(([name, d], index) => ({
          name,
          value: Math.round(aggregate(d.values) * 100) / 100,
          _records: d.records,
          _code: index + 1,
          _color: d.color
        })),
        dataKeys: ['value'],
        isMultiSeries: false,
        recordsMap: rMap,
        legendMapping: legendMap,
        legendFieldName: getFieldLabel(groupByField),
        isEncodedMode: true
      };
    }

    if (config.mode === 'compare') {
      const xFieldId = config.compareXFieldId;
      const yFieldId = config.compareYFieldId;

      if (!xFieldId || !yFieldId) {
        return { chartData: [], dataKeys: ['value'], isMultiSeries: false, recordsMap: {}, legendMapping: [], legendFieldName: '', isEncodedMode: false };
      }

      const xFieldType = getFieldType(xFieldId);
      const yFieldType = getFieldType(yFieldId);
      const isYNumeric = NUMERIC_FIELD_TYPES.includes(yFieldType);
      
      const xLabel = getFieldLabel(xFieldId);
      const yLabel = getFieldLabel(yFieldId);
      const xFieldOptions = getFieldOptions(xFieldId);
      const yFieldOptions = getFieldOptions(yFieldId);

      if (isYNumeric) {
        // Y is numeric - X values on x-axis, Y values as bars
        const groups: Record<string, { values: number[]; records: any[]; color?: string }> = {};
        
        records.forEach(record => {
          const xVal = formatDisplayValue(getFieldValue(record, xFieldId));
          const yVal = extractNumericValue(getFieldValue(record, yFieldId));
          const optionInfo = xFieldOptions?.get(xVal);
          
          if (!groups[xVal]) groups[xVal] = { values: [], records: [], color: optionInfo?.color };
          groups[xVal].values.push(yVal);
          groups[xVal].records.push(record);
        });

        Object.entries(groups).forEach(([key, val]) => {
          rMap[key] = val.records;
        });

        const sortedGroups = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
        const legendMap = sortedGroups.map(([label, data], index) => ({
          code: index + 1,
          label,
          color: data.color
        }));

        const data = sortedGroups.map(([name, d], index) => ({
          name,
          [yLabel]: d.values.length === 1 ? d.values[0] : Math.round((d.values.reduce((a, b) => a + b, 0)) * 100) / 100,
          _records: d.records,
          _code: index + 1,
          _color: d.color
        }));

        return { 
          chartData: data, 
          dataKeys: [yLabel], 
          isMultiSeries: false, 
          recordsMap: rMap,
          legendMapping: legendMap,
          legendFieldName: xLabel,
          isEncodedMode: true
        };
      }

      // Y is text - encode Y values as numeric codes
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

      // Sort Y values and create encoding map
      const yValuesArr = Array.from(allYValues).sort();
      const encodingMap: Record<string, number> = {};
      const legendMap = yValuesArr.map((label, index) => {
        const code = index + 1;
        encodingMap[label] = code;
        return {
          code,
          label,
          color: yFieldOptions?.get(label)?.color
        };
      });
      
      Object.entries(groups).forEach(([xKey, yGroups]) => {
        const allRecords: any[] = [];
        Object.values(yGroups).forEach(g => allRecords.push(...g.records));
        rMap[xKey] = allRecords;
      });

      // Create encoded data - bars show the encoded number
      const data = Object.entries(groups).map(([xValue, yValues]) => {
        const allRecords: any[] = [];
        Object.values(yValues).forEach(g => allRecords.push(...g.records));
        
        // For text Y-axis, show the encoded value (first Y value's code for this X)
        const yValKeys = Object.keys(yValues);
        const primaryYVal = yValKeys.length > 0 ? yValKeys[0] : '';
        const encodedValue = encodingMap[primaryYVal] || 0;
        const yOptColor = yFieldOptions?.get(primaryYVal)?.color;
        
        return {
          name: xValue,
          value: encodedValue,
          _rawYValue: primaryYVal,
          _records: allRecords,
          _code: encodedValue,
          _color: yOptColor
        };
      });

      return { 
        chartData: data, 
        dataKeys: ['value'], 
        isMultiSeries: false, 
        recordsMap: rMap,
        legendMapping: legendMap,
        legendFieldName: yLabel,
        isEncodedMode: true
      };
    }

    return { chartData: [], dataKeys: ['value'], isMultiSeries: false, recordsMap: {}, legendMapping: [], legendFieldName: '', isEncodedMode: false };
  }, [records, config, targetFormFields]);

  const colors = COLOR_THEMES[config.colorTheme || 'default'] || COLOR_THEMES.default;
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

  // Custom tooltip component with decoded value display
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = chartData.find(d => d.name === label);
    const recordCount = dataPoint?._records?.length || 0;
    const rawYValue = (dataPoint as any)?._rawYValue;

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
              <span className="font-medium text-foreground">
                {rawYValue ? `${entry.value} (${rawYValue})` : entry.value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-1 border-t text-xs text-muted-foreground">
          {recordCount} record{recordCount !== 1 ? 's' : ''}
        </div>
      </div>
    );
  };

  // Custom legend renderer with code-to-value mapping
  const renderCustomLegend = () => {
    // Show encoded legend with code -> value mapping
    if (isEncodedMode && legendMapping.length > 0) {
      return (
        <div className="w-44 shrink-0 border-l border-border pl-4">
          <div className="text-sm font-semibold mb-3 text-foreground">{legendFieldName} Legend</div>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {legendMapping.map(({ code, label, color }) => (
              <div key={code} className="flex items-center gap-2 text-sm">
                {/* Show color dot if option has a color, otherwise show number */}
                {color ? (
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-border"
                    style={{ backgroundColor: color }}
                    title={`Color: ${color}`}
                  />
                ) : (
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold bg-muted text-foreground border border-border shrink-0"
                  >
                    {code}
                  </div>
                )}
                <span className="text-foreground truncate" title={label}>
                  {label.length > 15 ? `${label.slice(0, 15)}...` : label}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Fallback for multi-series without encoding
    if (isMultiSeries && legendMapping.length > 0) {
      return (
        <div className="w-44 shrink-0 border-l border-border pl-4">
          <div className="text-sm font-semibold mb-3 text-foreground">{legendFieldName}</div>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {legendMapping.map(({ code, label, color }, index) => (
              <div key={code} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-4 h-4 rounded-sm shrink-0" 
                  style={{ backgroundColor: color || colors[index % colors.length] }}
                />
                <span className="text-foreground truncate" title={label}>
                  {label.length > 15 ? `${label.slice(0, 15)}...` : label}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  };

  const renderChart = () => {
    const chartType = config.chartType || 'bar';
    const showLegend = isEncodedMode && legendMapping.length > 0;
    const barCount = chartData.length;

    // Margins with axis labels - reduced right margin since legend is now external
    const margins = { 
      top: 20, 
      right: 20, 
      left: 60, 
      bottom: 60
    };

    // Get bar color - prefer option color, then use theme color
    const getBarColor = (entry: any, index: number) => {
      if (entry._color) return entry._color;
      return colors[index % colors.length];
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
        <div className="flex h-full">
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart margin={{ top: 30, right: 30, left: 30, bottom: 30 }}>
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
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry, index)} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {showLegend && renderCustomLegend()}
        </div>
      );
    }

    if (chartType === 'line') {
      return (
        <div className="flex h-full">
          <div className="flex-1 min-w-0">
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
          </div>
          {showLegend && renderCustomLegend()}
        </div>
      );
    }

    if (chartType === 'area') {
      return (
        <div className="flex h-full">
          <div className="flex-1 min-w-0">
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
          </div>
          {showLegend && renderCustomLegend()}
        </div>
      );
    }

    // Default: Bar chart - with sidebar legend
    return (
      <div className="flex h-full">
        <div className="flex-1 min-w-0">
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
              {dataKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[index % colors.length]}
                  radius={[4, 4, 0, 0]}
                  name={key}
                >
                  {/* Apply individual colors to each bar - prefer option color */}
                  {!isMultiSeries && chartData.map((entry, entryIndex) => (
                    <Cell 
                      key={`cell-${entryIndex}`} 
                      fill={getBarColor(entry, entryIndex)} 
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {showLegend && renderCustomLegend()}
      </div>
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
