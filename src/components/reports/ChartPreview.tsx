
import React, { useState, useEffect, useMemo } from 'react';
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
  const { getFormSubmissionData, getChartData, getFormFields } = useReports();

  // Get field names mapping
  const formFields = useMemo(() => {
    if (!config.formId) return [];
    return getFormFields(config.formId);
  }, [config.formId, getFormFields]);

  const getFieldName = (fieldId: string): string => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

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
        if (config.drilldownConfig?.enabled && config.drilldownConfig?.drilldownLevels?.length > 0) {
          console.log('Using drilldown-enabled chart data fetch');
          
          // Determine the current dimension based on drilldown state
          const currentDrilldownLevel = drilldownState?.values?.length || 0;
          const currentDimension = config.drilldownConfig.drilldownLevels[currentDrilldownLevel] || 
                                   config.drilldownConfig.drilldownLevels[0];
          
          // Use the current dimension for the chart
          const chartDimensions = [currentDimension];
          
          console.log('Drilldown chart config:', {
            currentLevel: currentDrilldownLevel,
            currentDimension,
            drilldownValues: drilldownState?.values || [],
            allLevels: config.drilldownConfig.drilldownLevels
          });
          
          const serverData = await getChartData(
            config.formId,
            chartDimensions,
            config.metrics || [],
            config.aggregation || 'count',
            config.filters || [],
            config.drilldownConfig?.drilldownLevels || [],
            drilldownState?.values || [],
            config.metricAggregations || [],
            config.groupByField
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
    config.drilldownConfig?.enabled,
    config.drilldownConfig?.drilldownLevels,
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
    
    // Get dimension fields
    let dimensionFields: string[] = [];
    
    if (config.drilldownConfig?.enabled && config.drilldownConfig?.drilldownLevels?.length > 0) {
      const currentDrilldownLevel = drilldownState?.values?.length || 0;
      const currentDimension = config.drilldownConfig.drilldownLevels[currentDrilldownLevel] || 
                               config.drilldownConfig.drilldownLevels[0];
      dimensionFields = [currentDimension];
    } else {
      dimensionFields = config.dimensions && config.dimensions.length > 0 
        ? config.dimensions 
        : config.xAxis 
          ? [config.xAxis] 
          : [];
    }

    if (dimensionFields.length === 0) {
      dimensionFields = ['_default'];
    }

    // Get metric fields
    const metricFields = config.metrics && config.metrics.length > 0 
      ? config.metrics 
      : config.aggregation === 'count' || config.aggregationType === 'count'
        ? ['count'] 
        : config.yAxis 
          ? [config.yAxis] 
          : ['count'];

    console.log('Processing with dimensions:', dimensionFields, 'metrics:', metricFields);

    // For multiple dimensions, we need to create a cross-product structure
    if (dimensionFields.length > 1) {
      return processMultiDimensionalData(submissions, dimensionFields, metricFields);
    } else {
      return processSingleDimensionalData(submissions, dimensionFields, metricFields);
    }
  };

  const processSingleDimensionalData = (submissions: any[], dimensionFields: string[], metricFields: string[]) => {
    const processedData: { [key: string]: any } = {};

    submissions.forEach((submission) => {
      const submissionData = submission.submission_data;
      
      // Apply filters
      if (!passesFilters(submissionData)) return;

      const dimensionKey = getDimensionKey(submissionData, dimensionFields);

      if (!processedData[dimensionKey]) {
        processedData[dimensionKey] = { name: dimensionKey, value: 0 };
        metricFields.forEach(metric => {
          processedData[dimensionKey][metric] = 0;
        });
      }

      // Aggregate metrics
      metricFields.forEach(metric => {
        const metricValue = getMetricValue(submissionData, metric);
        processedData[dimensionKey][metric] += metricValue;
        processedData[dimensionKey]['value'] += metricValue;
      });
    });

    return Object.values(processedData);
  };

  const processMultiDimensionalData = (submissions: any[], dimensionFields: string[], metricFields: string[]) => {
    // For multiple dimensions, create separate data points for each dimension value
    const dimensionValueSets: { [key: string]: Set<string> } = {};
    const processedData: { [key: string]: any } = {};

    // First pass: collect all unique values for each dimension
    submissions.forEach((submission) => {
      const submissionData = submission.submission_data;
      if (!passesFilters(submissionData)) return;

      dimensionFields.forEach(dim => {
        if (!dimensionValueSets[dim]) {
          dimensionValueSets[dim] = new Set();
        }
        const value = getDimensionValue(submissionData, dim);
        dimensionValueSets[dim].add(value);
      });
    });

    // Create data structure: each unique value becomes a separate series
    const allDimensionValues: string[] = [];
    Object.entries(dimensionValueSets).forEach(([dim, values]) => {
      values.forEach((value, index) => {
        const fieldName = getFieldName(dim);
        const seriesName = `${fieldName}: ${value}`;
        allDimensionValues.push(seriesName);
      });
    });

    // Second pass: aggregate data
    submissions.forEach((submission) => {
      const submissionData = submission.submission_data;
      if (!passesFilters(submissionData)) return;

      // Create a composite key for grouping (could be time-based or just "All")
      const groupKey = "All Data";
      
      if (!processedData[groupKey]) {
        processedData[groupKey] = { name: groupKey };
        allDimensionValues.forEach(dimValue => {
          processedData[groupKey][dimValue] = 0;
        });
      }

      // Add to appropriate dimension series
      dimensionFields.forEach(dim => {
        const value = getDimensionValue(submissionData, dim);
        const fieldName = getFieldName(dim);
        const seriesName = `${fieldName}: ${value}`;
        
        metricFields.forEach(metric => {
          const metricValue = getMetricValue(submissionData, metric);
          processedData[groupKey][seriesName] += metricValue;
        });
      });
    });

    return Object.values(processedData);
  };

  const passesFilters = (submissionData: any): boolean => {
    const drilldownFilters: any[] = [];
    if (config.drilldownConfig?.enabled && drilldownState?.values?.length > 0) {
      drilldownState.values.forEach((value, index) => {
        const field = config.drilldownConfig?.drilldownLevels?.[index];
        if (field) {
          drilldownFilters.push({
            field,
            operator: 'equals',
            value
          });
        }
      });
    }
    
    const allFilters = [...(config.filters || []), ...drilldownFilters];
    return allFilters?.every(filter => {
      const value = submissionData[filter.field];
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
  };

  const getDimensionKey = (submissionData: any, dimensionFields: string[]): string => {
    return dimensionFields
      .map(dim => getDimensionValue(submissionData, dim))
      .join(' - ') || 'Not Specified';
  };

  const getDimensionValue = (submissionData: any, dim: string): string => {
    if (dim === '_default') return 'Total';
    
    const val = submissionData[dim];
    if (typeof val === 'object' && val !== null) {
      if (val.status) return val.status;
      if (val.label) return val.label;
      return JSON.stringify(val);
    }
    if (val === null || val === undefined || val === '') {
      return 'Not Specified';
    }
    return String(val);
  };

  const getMetricValue = (submissionData: any, metric: string): number => {
    if (metric === 'count' || config.aggregation === 'count' || config.aggregationType === 'count') {
      return 1;
    }
    
    const value = submissionData[metric] || submissionData[config.yAxis];
    
    if (typeof value === 'object' && value !== null) {
      if (value.status) {
        return value.status === 'approved' ? 1 : 0;
      }
      return 1;
    } else if (typeof value === 'number') {
      return value;
    } else if (value) {
      return 1;
    }
    return 0;
  };

  const colors = colorSchemes[config.colorTheme || 'default'];

  const handleChartClick = (data: any, event?: any) => {
    if (!config.drilldownConfig?.enabled || !onDrilldown || !config.drilldownConfig?.drilldownLevels?.length) return;
    
    // Check if we can drill down further
    const currentLevel = drilldownState?.values?.length || 0;
    if (currentLevel >= config.drilldownConfig?.drilldownLevels.length) return;
    
    // Get the next drilldown level and the clicked value
    const nextLevel = config.drilldownConfig?.drilldownLevels[currentLevel];
    let clickedValue = data?.activeLabel || data?.name || data?.payload?.name;
    
    // Handle different chart click scenarios
    if (event && event.activePayload && event.activePayload[0]) {
      clickedValue = event.activePayload[0].payload.name;
    }
    
    if (nextLevel && clickedValue) {
      console.log('Chart drilldown:', { nextLevel, clickedValue, currentLevel });
      onDrilldown(nextLevel, clickedValue);
    }
  };

  const handleBarClick = (data: any, index: number) => {
    if (!config.drilldownConfig?.enabled || !onDrilldown || !config.drilldownConfig?.drilldownLevels?.length) return;
    
    const currentLevel = drilldownState?.values?.length || 0;
    if (currentLevel >= config.drilldownConfig?.drilldownLevels.length) return;
    
    const nextLevel = config.drilldownConfig?.drilldownLevels[currentLevel];
    const clickedValue = data.name;
    
    if (nextLevel && clickedValue) {
      console.log('Bar click drilldown:', { nextLevel, clickedValue, currentLevel });
      onDrilldown(nextLevel, clickedValue);
    }
  };

  const handlePieClick = (data: any, index: number) => {
    if (!config.drilldownConfig?.enabled || !onDrilldown || !config.drilldownConfig?.drilldownLevels?.length) return;
    
    const currentLevel = drilldownState?.values?.length || 0;
    if (currentLevel >= config.drilldownConfig.drilldownLevels.length) return;
    
    const nextLevel = config.drilldownConfig.drilldownLevels[currentLevel];
    const clickedValue = data.name;
    
    if (nextLevel && clickedValue) {
      console.log('Pie click drilldown:', { nextLevel, clickedValue, currentLevel });
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

    // Determine the primary metric to display
    let primaryMetric = 'value'; // Default fallback
    
    if (config.metrics && config.metrics.length > 0) {
      primaryMetric = config.metrics[0];
    } else if (config.yAxis) {
      primaryMetric = config.yAxis;
    } else if (config.aggregationType === 'count' || config.aggregation === 'count') {
      primaryMetric = 'count';
    }
    
    // Ensure the primary metric exists in the data
    if (chartData.length > 0 && !chartData[0].hasOwnProperty(primaryMetric)) {
      // Fallback to available keys
      const availableKeys = Object.keys(chartData[0]).filter(key => key !== 'name' && typeof chartData[0][key] === 'number');
      if (availableKeys.length > 0) {
        primaryMetric = availableKeys[0];
      }
    }
    
    const chartType = config.type || config.chartType || 'bar';
    
    console.log('Chart rendering config:', {
      chartType,
      primaryMetric,
      dataKeys: chartData.length > 0 ? Object.keys(chartData[0]) : [],
      sampleData: chartData[0],
      totalRecords: chartData.length
    });

    // Get all dimension-based data keys (for multi-dimensional charts)
    const dimensionKeys = chartData.length > 0 
      ? Object.keys(chartData[0]).filter(key => key !== 'name' && typeof chartData[0][key] === 'number')
      : [];
    
    const isMultiDimensional = config.dimensions && config.dimensions.length > 1;

    switch (chartType) {
      case 'bar':
        return (
          <div className="relative w-full" style={{ height: '400px', paddingBottom: '40px' }}>
            <div className="absolute inset-0" style={{ bottom: '40px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
                >
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    label={{ value: getFieldName(primaryMetric), angle: -90, position: 'insideLeft' }}
                    domain={[0, 'dataMax']}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${getFieldName(name.toString())}: ${value}`,
                      `Category: ${props.payload?.name || 'N/A'}`
                    ]}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    formatter={(value) => getFieldName(value.toString())}
                    iconType="rect"
                  />
                  {isMultiDimensional ? (
                    // Render separate bars for each dimension value
                    dimensionKeys.map((key, index) => (
                      <Bar 
                        key={key} 
                        dataKey={key} 
                        fill={colors[index % colors.length]} 
                        name={key}
                        style={{ cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default' }}
                        onClick={config.drilldownConfig?.enabled ? handleBarClick : undefined}
                      />
                    ))
                  ) : (
                    // Single dimension - render primary metric and additional metrics if any
                    <>
                      <Bar 
                        dataKey={primaryMetric} 
                        fill={colors[0]} 
                        name={primaryMetric}
                        style={{ cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default' }}
                        onClick={config.drilldownConfig?.enabled ? handleBarClick : undefined}
                      />
                      {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => (
                        <Bar 
                          key={metric} 
                          dataKey={metric} 
                          fill={colors[(index + 1) % colors.length]} 
                          name={metric}
                          style={{ cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default' }}
                          onClick={config.drilldownConfig?.enabled ? handleBarClick : undefined}
                        />
                      ))}
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'column':
        return (
          <div className="relative w-full" style={{ height: '400px', paddingBottom: '40px' }}>
            <div className="absolute inset-0" style={{ bottom: '40px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  layout="horizontal" 
                  margin={{ top: 20, right: 30, left: 120, bottom: 20 }}
                >
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 11 }}
                    label={{ value: getFieldName(primaryMetric), position: 'insideBottom', offset: -5 }}
                    domain={[0, 'dataMax']}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${getFieldName(name.toString())}: ${value}`,
                      `Category: ${props.payload?.name || 'N/A'}`
                    ]}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    formatter={(value) => getFieldName(value.toString())}
                    iconType="rect"
                  />
                  <Bar 
                    dataKey={primaryMetric} 
                    fill={colors[0]} 
                    name={primaryMetric}
                  />
                  {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => (
                    <Bar 
                      key={metric} 
                      dataKey={metric} 
                      fill={colors[(index + 1) % colors.length]} 
                      name={metric}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      
      case 'pie':
        return (
          <div className="relative w-full" style={{ height: '400px', paddingBottom: '40px' }}>
            <div className="absolute inset-0" style={{ bottom: '40px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey={primaryMetric}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    style={{ cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default' }}
                    onClick={config.drilldownConfig?.enabled ? handlePieClick : undefined}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={colors[index % colors.length]}
                        style={{ cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${getFieldName(name.toString())}: ${value}`,
                      `Total: ${chartData.reduce((sum, item) => sum + item[primaryMetric], 0)}`
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    formatter={(value) => getFieldName(value.toString())}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsPieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={config.innerRadius || 60}
                outerRadius={120}
                fill="#8884d8"
                dataKey={primaryMetric}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        );
      
      case 'line':
        return (
          <div className="relative w-full" style={{ height: '400px', paddingBottom: '40px' }}>
            <div className="absolute inset-0" style={{ bottom: '40px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart 
                  data={chartData} 
                  margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
                  onClick={handleChartClick}
                >
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    label={{ value: getFieldName(primaryMetric), angle: -90, position: 'insideLeft' }}
                    domain={[0, 'dataMax']}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${getFieldName(name.toString())}: ${value}`,
                      `Category: ${props.payload?.name || 'N/A'}`
                    ]}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    formatter={(value) => getFieldName(value.toString())}
                    iconType="line"
                  />
                  {isMultiDimensional ? (
                    // Render separate lines for each dimension value
                    dimensionKeys.map((key, index) => (
                      <Line 
                        key={key} 
                        type="monotone" 
                        dataKey={key} 
                        stroke={colors[index % colors.length]} 
                        strokeWidth={3}
                        name={key}
                        dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                        style={{ cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default' }}
                      />
                    ))
                  ) : (
                    // Single dimension - render primary metric and additional metrics if any
                    <>
                      <Line 
                        type="monotone" 
                        dataKey={primaryMetric} 
                        stroke={colors[0]} 
                        strokeWidth={3}
                        name={primaryMetric}
                        dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
                        style={{ cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default' }}
                      />
                      {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => (
                        <Line 
                          key={metric}
                          type="monotone" 
                          dataKey={metric} 
                          stroke={colors[(index + 1) % colors.length]} 
                          strokeWidth={3}
                          name={metric}
                          dot={{ fill: colors[(index + 1) % colors.length], strokeWidth: 2, r: 4 }}
                          style={{ cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default' }}
                        />
                      ))}
                    </>
                  )}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      
      case 'area':
        return (
          <div className="relative w-full" style={{ height: '400px', paddingBottom: '40px' }}>
            <div className="absolute inset-0" style={{ bottom: '40px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsAreaChart 
                  data={chartData} 
                  margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
                >
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    label={{ value: getFieldName(primaryMetric), angle: -90, position: 'insideLeft' }}
                    domain={[0, 'dataMax']}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${getFieldName(name.toString())}: ${value}`,
                      `Category: ${props.payload?.name || 'N/A'}`
                    ]}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    formatter={(value) => getFieldName(value.toString())}
                    iconType="rect"
                  />
                  <Area 
                    type="monotone" 
                    dataKey={primaryMetric} 
                    stroke={colors[0]} 
                    fill={colors[0]} 
                    fillOpacity={0.6}
                    name={primaryMetric}
                  />
                  {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => (
                    <Area 
                      key={metric}
                      type="monotone" 
                      dataKey={metric} 
                      stroke={colors[(index + 1) % colors.length]} 
                      fill={colors[(index + 1) % colors.length]} 
                      fillOpacity={0.6}
                      name={metric}
                    />
                  ))}
                </RechartsAreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsScatterChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                dataKey={primaryMetric} 
                tick={{ fontSize: 12 }}
                label={{ value: primaryMetric, angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value, name) => [value, name]}
                labelFormatter={(label) => `Category: ${label}`}
              />
              <Scatter dataKey={primaryMetric} fill={colors[0]} />
            </RechartsScatterChart>
          </ResponsiveContainer>
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
                      const lastLevel = config.drilldownConfig?.drilldownLevels?.[newValues.length - 1] || '';
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>Drilldown:</span>
                {drilldownState.values.map((value, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span>{'>'}</span>}
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {value}
                    </span>
                  </React.Fragment>
                ))}
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
