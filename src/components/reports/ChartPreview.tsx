
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, ArrowLeft } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  LineChart as RechartsLineChart, 
  Line, 
  AreaChart as RechartsAreaChart,
  Area,
  ScatterChart as RechartsScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  FunnelChart,
  Funnel,
  Treemap,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { useReports } from '@/hooks/useReports';
import { ChartConfig } from '@/types/reports';
import { colorSchemes } from './ChartColorThemes';

interface ChartPreviewProps {
  config: ChartConfig;
  onEdit?: () => void;
  hideControls?: boolean;
  onDrilldown?: (drilldownLevel: string, drilldownValue: string) => void;
  drilldownState?: {
    path: string[];
    values: string[];
  };
}


export function ChartPreview({ 
  config, 
  onEdit, 
  hideControls = false, 
  onDrilldown,
  drilldownState
}: ChartPreviewProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { getFormSubmissionData, getChartData } = useReports();

  useEffect(() => {
    const loadChartData = async () => {
      // Use sample data if provided, otherwise fetch from form
      if ((config as any).data) {
        console.log('Using provided sample data:', (config as any).data);
        setChartData((config as any).data);
        setLoading(false);
        return;
      }

      // Check if we have minimum required configuration
      if (!config.formId) {
        console.log('No formId provided, showing empty state');
        setChartData([]);
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching chart data for form:', config.formId);
        
        // Use server-side RPC function for drilldown-enabled charts
        if (config.drilldownEnabled && config.drilldownLevels?.length > 0) {
          console.log('Using drilldown-enabled chart data fetch');
          const serverData = await getChartData(
            config.formId,
            config.dimensions || [],
            config.metrics || [],
            config.aggregation || 'count',
            config.filters || [],
            config.drilldownLevels || [],
            drilldownState?.values || []
          );
          
          // Transform server data to chart format
          const chartData = serverData.map((item: any) => ({
            name: item.name,
            value: Number(item.value),
            [config.metrics?.[0] || 'count']: Number(item.value),
            _drilldownData: item.additional_data
          }));
          
          console.log('Processed drilldown chart data:', chartData);
          setChartData(chartData);
        } else {
          // Fallback to client-side processing for non-drilldown charts
          const submissions = await getFormSubmissionData(config.formId);
          console.log('Received submissions:', submissions?.length || 0);
          
          if (!submissions || submissions.length === 0) {
            console.log('No submissions found');
            setChartData([]);
            setLoading(false);
            return;
          }

          const processedData = processSubmissionData(submissions);
          console.log('Processed chart data:', processedData);
          setChartData(processedData);
        }
      } catch (error) {
        console.error('Error loading chart data:', error);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [
    config.formId, 
    config.dimensions, 
    config.metrics, 
    config.filters, 
    config.xAxis, 
    config.yAxis, 
    config.aggregation, 
    config.aggregationType, 
    config.drilldownEnabled,
    config.drilldownLevels,
    drilldownState?.values,
    (config as any).data, 
    getFormSubmissionData,
    getChartData
  ]);

  const processSubmissionData = (submissions: any[]) => {
    if (!submissions.length) {
      console.log('No submissions to process');
      return [];
    }

    console.log('Processing submissions:', submissions.length);
    const processedData: { [key: string]: any } = {};

    submissions.forEach((submission, index) => {
      const submissionData = submission.submission_data;
      
      // Apply filters
      const passesFilters = config.filters?.every(filter => {
        const rawValue = submissionData[filter.field];
        // Extract primitive value from object structures for filtering
        const value = rawValue && typeof rawValue === 'object' && 'value' in rawValue
          ? (rawValue.value === 'undefined' ? '' : rawValue.value)
          : rawValue;
          
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).includes(filter.value);
          case 'greater_than':
            return Number(value) > Number(filter.value);
          case 'less_than':
            return Number(value) < Number(filter.value);
          case 'starts_with':
            return String(value).startsWith(filter.value);
          case 'ends_with':
            return String(value).endsWith(filter.value);
          case 'not_equals':
            return value !== filter.value;
          case 'is_empty':
            return !value || value === '';
          case 'is_not_empty':
            return value && value !== '';
          default:
            return true;
        }
      }) ?? true;

      if (!passesFilters) return;

      // Create dimension key - use xAxis if dimensions not set, or use a default categorization
      let dimensionFields = config.dimensions && config.dimensions.length > 0 
        ? config.dimensions 
        : config.xAxis 
          ? [config.xAxis] 
          : [];

      // If no dimension is specified, create a simple count-based dimension
      if (dimensionFields.length === 0) {
        dimensionFields = ['_default'];
      }

      const dimensionKey = dimensionFields
        .map(dim => {
          if (dim === '_default') return 'Total';
          
          const rawVal = submissionData[dim];
          
          // Extract primitive value from object structures
          let val = rawVal;
          if (rawVal && typeof rawVal === 'object' && 'value' in rawVal) {
            val = rawVal.value === 'undefined' ? '' : rawVal.value;
          }
          
          // Handle complex field types for dimensions
          if (typeof val === 'object' && val !== null) {
            if (val.status) return val.status; // For approval fields
            if (val.label) return val.label; // For select fields with labels
            return JSON.stringify(val);
          }
          return val || 'Unknown';
        })
        .join(' - ');

      if (!processedData[dimensionKey]) {
        processedData[dimensionKey] = {
          name: dimensionKey,
        };
        
        // Initialize metrics - use yAxis/aggregation if metrics not set
        const metricFields = config.metrics && config.metrics.length > 0 
          ? config.metrics 
          : config.aggregation === 'count' || config.aggregationType === 'count'
            ? ['count'] 
            : config.yAxis 
              ? [config.yAxis] 
              : ['count'];

        metricFields.forEach(metric => {
          processedData[dimensionKey][metric] = 0;
        });
      }

      // Aggregate metrics
      const metricFields = config.metrics && config.metrics.length > 0 
        ? config.metrics 
        : config.aggregation === 'count' || config.aggregationType === 'count'
          ? ['count'] 
          : config.yAxis 
            ? [config.yAxis] 
            : ['count'];

      metricFields.forEach(metric => {
        if (metric === 'count' || config.aggregation === 'count' || config.aggregationType === 'count') {
          processedData[dimensionKey][metric] += 1;
        } else {
          const rawValue = submissionData[metric] || submissionData[config.yAxis];
          
          // Extract primitive value from object structures
          let value = rawValue;
          if (rawValue && typeof rawValue === 'object' && 'value' in rawValue) {
            value = rawValue.value === 'undefined' ? '' : rawValue.value;
          }
          
          // Handle complex field types (approval, etc.)
          if (typeof value === 'object' && value !== null) {
            // For approval fields, count based on status
            if (value.status) {
              processedData[dimensionKey][metric] += value.status === 'approved' ? 1 : 0;
            } else {
              // For other object types, just count as 1 if present
              processedData[dimensionKey][metric] += 1;
            }
          } else if (typeof value === 'number') {
            processedData[dimensionKey][metric] += value;
          } else if (value) {
            processedData[dimensionKey][metric] += 1;
          }
        }
      });
    });

    const result = Object.values(processedData);
    console.log('Final processed data:', result);
    return result;
  };

  const colors = colorSchemes[config.colorTheme || 'default'];

  const handleChartClick = (data: any) => {
    if (!config.drilldownEnabled || !onDrilldown || !config.drilldownLevels?.length) return;
    
    // Check if we can drill down further
    const currentLevel = drilldownState?.values?.length || 0;
    if (currentLevel >= config.drilldownLevels.length) return;
    
    // Get the next drilldown level and the clicked value
    const nextLevel = config.drilldownLevels[currentLevel];
    const clickedValue = data?.activeLabel || data?.name;
    
    if (nextLevel && clickedValue) {
      onDrilldown(nextLevel, clickedValue);
    }
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading chart data...</div>
        </div>
      );
    }

    if (!chartData.length) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">No data available</div>
            <div className="text-sm text-muted-foreground">Configure the chart settings to display data</div>
          </div>
        </div>
      );
    }

    const primaryMetric = (config.metrics && config.metrics.length > 0) ? config.metrics[0] : 
                         config.yAxis || 
                         (config.aggregationType === 'count' ? 'count' : 'value');
    const chartType = config.type || config.chartType || 'bar';

    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={chartData} onClick={handleChartClick}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {(config.metrics || [primaryMetric]).map((metric, index) => (
              <Bar 
                key={metric} 
                dataKey={metric} 
                fill={colors[index % colors.length]} 
                name={metric}
                style={{ cursor: config.drilldownEnabled ? 'pointer' : 'default' }}
              />
            ))}
          </BarChart>
        );

      case 'column':
        return (
          <BarChart data={chartData} layout="horizontal">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={80} />
            <Tooltip />
            <Legend />
            {(config.metrics || [primaryMetric]).map((metric, index) => (
              <Bar 
                key={metric} 
                dataKey={metric} 
                fill={colors[index % colors.length]} 
                name={metric}
              />
            ))}
          </BarChart>
        );
      
      case 'pie':
        return (
          <RechartsPieChart onClick={handleChartClick}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey={primaryMetric}
              label={({ name, value }) => `${name}: ${value}`}
              style={{ cursor: config.drilldownEnabled ? 'pointer' : 'default' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </RechartsPieChart>
        );

      case 'donut':
        return (
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={config.innerRadius || 40}
              outerRadius={80}
              fill="#8884d8"
              dataKey={primaryMetric}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </RechartsPieChart>
        );
      
      case 'line':
        return (
          <RechartsLineChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {(config.metrics || [primaryMetric]).map((metric, index) => (
              <Line 
                key={metric}
                type="monotone" 
                dataKey={metric} 
                stroke={colors[index % colors.length]} 
                strokeWidth={2}
                name={metric}
              />
            ))}
          </RechartsLineChart>
        );
      
      case 'area':
        return (
          <RechartsAreaChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {(config.metrics || [primaryMetric]).map((metric, index) => (
              <Area 
                key={metric}
                type="monotone" 
                dataKey={metric} 
                stroke={colors[index % colors.length]} 
                fill={colors[index % colors.length]} 
                fillOpacity={0.6}
                name={metric}
              />
            ))}
          </RechartsAreaChart>
        );
      
      case 'scatter':
        return (
          <RechartsScatterChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis dataKey={primaryMetric} />
            <Tooltip />
            <Scatter dataKey={primaryMetric} fill={colors[0]} />
          </RechartsScatterChart>
        );

      case 'bubble':
        // For bubble chart, use multiple scatter components with different sizes
        const sizeField = config.sizeField || primaryMetric;
        const bubbleData = chartData.map(item => ({
          ...item,
          size: item[sizeField] || 10
        }));
        
        return (
          <RechartsScatterChart data={bubbleData}>
            <XAxis dataKey="name" />
            <YAxis dataKey={primaryMetric} />
            <Tooltip 
              formatter={(value, name, props) => [
                `${name}: ${value}`,
                `Size: ${props.payload.size}`
              ]}
            />
            {bubbleData.map((entry, index) => (
              <Scatter
                key={index}
                data={[entry]}
                fill={colors[index % colors.length]}
                r={Math.max(5, Math.min(20, entry.size / 2))}
              />
            ))}
          </RechartsScatterChart>
        );

      case 'heatmap':
        // Generate heatmap data grid
        const heatmapData = chartData.map((item, index) => ({
          ...item,
          x: index % (config.gridColumns || 5),
          y: Math.floor(index / (config.gridColumns || 5)),
          value: item[config.heatmapIntensityField || primaryMetric]
        }));
        
        return (
          <div className="relative">
            <div className="grid gap-1" style={{ 
              gridTemplateColumns: `repeat(${config.gridColumns || 5}, 1fr)`,
              maxWidth: '100%'
            }}>
              {heatmapData.map((cell, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-sm flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: colors[Math.floor((cell.value / Math.max(...heatmapData.map(d => d.value))) * (colors.length - 1))],
                    color: cell.value > (Math.max(...heatmapData.map(d => d.value)) / 2) ? 'white' : 'black'
                  }}
                  title={`${cell.name}: ${cell.value}`}
                >
                  {cell.value}
                </div>
              ))}
            </div>
          </div>
        );

      case 'table':
        return (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Category
                  </th>
                  {(config.metrics || [primaryMetric]).map((metric) => (
                    <th key={metric} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {metric}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {chartData.map((row, index) => (
                  <tr key={index} className="hover:bg-muted/50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      {row.name}
                    </td>
                    {(config.metrics || [primaryMetric]).map((metric) => (
                      <td key={metric} className="px-4 py-2 whitespace-nowrap text-sm">
                        {row[metric]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      default:
        return (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Chart type "{chartType}" not implemented yet
          </div>
        );
    }
  };

  const canDrillUp = drilldownState?.values && drilldownState.values.length > 0;

  return (
    <div className="space-y-4 relative group h-full">
      {/* Chart Header with Controls */}
      <div className="flex items-center justify-between">
        {config.title && (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{config.title}</h3>
              {canDrillUp && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (onDrilldown && drilldownState?.values) {
                      const newValues = [...drilldownState.values];
                      newValues.pop(); // Remove last value to go up one level
                      // Trigger drilldown with reduced values
                      const lastLevel = config.drilldownLevels?.[newValues.length - 1] || '';
                      const lastValue = newValues[newValues.length - 1] || '';
                      onDrilldown(lastLevel, lastValue);
                    }
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            {config.description && (
              <p className="text-sm text-muted-foreground">{config.description}</p>
            )}
            {drilldownState?.values && drilldownState.values.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Drilldown: {drilldownState.values.join(' > ')}
              </div>
            )}
          </div>
        )}
        
        {/* Chart Controls */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={onEdit}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          
          {config.filters && config.filters.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={() => {/* TODO: Open filter panel */}}
            >
              Filter ({config.filters.length})
            </Button>
          )}
          
          {config.drilldownConfig?.enabled && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={() => {/* TODO: Open drilldown panel */}}
            >
              Drilldown
            </Button>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
