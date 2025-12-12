import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, ArrowLeft, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, PieChart as RechartsPieChart, Pie, Cell, LineChart as RechartsLineChart, Line, AreaChart as RechartsAreaChart, Area, ScatterChart as RechartsScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, FunnelChart, Funnel, Treemap, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useReports } from '@/hooks/useReports';
import { useFormsData } from '@/hooks/useFormsData';
import { ChartConfig } from '@/types/reports';
import { colorSchemes } from './ChartColorThemes';
import { TableCellSubmissionsDialog } from './TableCellSubmissionsDialog';
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
  const [showFormFields, setShowFormFields] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [showDrilldownPanel, setShowDrilldownPanel] = useState(false);
  
  const [cellSubmissionsDialog, setCellSubmissionsDialog] = useState<{
    open: boolean;
    dimensionField: string;
    dimensionValue: string;
    groupField?: string;
    groupValue?: string;
    dimensionLabel?: string;
    groupLabel?: string;
  }>({
    open: false,
    dimensionField: '',
    dimensionValue: '',
  });
  const {
    getFormSubmissionData,
    getChartData,
    getFormFields
  } = useReports();
  const {
    forms
  } = useFormsData();

  // Get current form and its fields from useFormsData for better reliability
  const currentForm = useMemo(() => {
    return forms.find(f => f.id === config.formId);
  }, [forms, config.formId]);
  const formFields = useMemo(() => {
    return currentForm?.fields || [];
  }, [currentForm]);

  // Helper functions to get form and field names with robust fallbacks
  const getFormName = (formId: string): string => {
    const form = forms.find(f => f.id === formId);
    const formName = form?.name || formId;
    console.log(`Getting form name for ${formId}: ${formName}`);
    return formName;
  };
  const getFormFieldName = (fieldId: string): string => {
    // First try to find field in current form fields
    let field = formFields.find(f => f.id === fieldId);

    // If not found and we have forms data, search across all forms
    if (!field && forms.length > 0) {
      for (const form of forms) {
        field = form.fields?.find(f => f.id === fieldId);
        if (field) break;
      }
    }
    const fieldName = field?.label || fieldId;
    console.log(`Getting field name for ${fieldId}: ${fieldName} (field found: ${!!field})`);
    return fieldName;
  };
  const getFieldName = (fieldId: string): string => {
    return getFormFieldName(fieldId);
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

        // Get drilldown levels - support both property names for compatibility
        const drilldownLevels = config.drilldownConfig?.drilldownLevels || config.drilldownConfig?.levels || [];

        // Use server-side RPC function for drilldown-enabled charts
        if (config.drilldownConfig?.enabled && drilldownLevels.length > 0) {
          console.log('Using drilldown-enabled chart data fetch');

          // Determine the current dimension based on drilldown state
          const currentDrilldownLevel = drilldownState?.values?.length || 0;
          const currentDimension = drilldownLevels[currentDrilldownLevel] || drilldownLevels[0];

          // Use the current dimension for the chart - show the NEXT level after current drilldown
          const chartDimensions = [currentDimension];
          console.log('Drilldown chart config:', {
            currentLevel: currentDrilldownLevel,
            currentDimension,
            drilldownValues: drilldownState?.values || [],
            allLevels: drilldownLevels,
            dimensionForChart: chartDimensions
          });
          const serverData: any[] = await getChartData(config.formId, chartDimensions, config.metrics || [], config.aggregation || 'count', config.filters || [], drilldownLevels, drilldownState?.values || [], config.metricAggregations || [], config.groupByField);

          console.log('📊 Raw server data for grouped chart:', serverData);
          console.log('📊 Group by field:', config.groupByField);
          console.log('📊 Server data structure check:', serverData.length > 0 ? Object.keys(serverData[0]) : 'no data');

          // Transform server data to chart format
          let chartData: any[];
          
          // Check if server returned grouped structure or if we need to do client-side grouping
          if (config.groupByField && serverData.length > 0) {
            // Check if server returned pre-grouped data with 'groups' or 'group_*' fields
            const firstItem: any = serverData[0];
            const hasGroupsField = 'groups' in firstItem;
            const hasGroupKeys = Object.keys(firstItem).some(key => key !== 'name' && key !== 'value' && key !== 'additional_data' && typeof firstItem[key] === 'number');
            
            if (hasGroupsField) {
              // Server returned data with nested groups: { name: "dim", groups: { "g1": v1, "g2": v2 } }
              console.log('📊 Using server-provided groups structure');
              chartData = serverData.map((item: any) => {
                const dataPoint: any = { name: item.name || 'Unknown' };
                
                if (item.groups) {
                  Object.entries(item.groups).forEach(([groupKey, groupValue]) => {
                    const numVal = Number(groupValue);
                    dataPoint[groupKey] = isNaN(numVal) ? 0 : numVal;
                  });
                }
                
                return dataPoint;
              });
            } else if (hasGroupKeys) {
              // Server already returned flattened grouped data: { name: "dim", "group1": v1, "group2": v2 }
              console.log('📊 Using server-provided flattened groups');
              chartData = serverData.map((item: any) => {
                const dataPoint: any = {};
                Object.entries(item).forEach(([key, value]) => {
                  if (key === 'name') {
                    dataPoint.name = value;
                  } else if (key !== 'additional_data' && typeof value === 'number') {
                    const numVal = Number(value);
                    dataPoint[key] = isNaN(numVal) ? 0 : numVal;
                  }
                });
                return dataPoint;
              });
            } else {
              // Server returned simple structure, needs client-side grouping via RPC with groupBy
              // This means the server-side RPC should have handled it but didn't
              console.log('📊 Server did not group data, falling back to simple structure');
              chartData = serverData.map((item: any) => {
                const numValue = Number(item.value);
                const safeValue = isNaN(numValue) ? 0 : numValue;
                return {
                  name: item.name || 'Unknown',
                  value: safeValue,
                  count: safeValue,
                  [config.metrics?.[0] || 'count']: safeValue,
                  _drilldownData: item.additional_data
                };
              });
            }
            
            console.log('📊 Transformed grouped chart data:', chartData);
          } else {
            // Non-grouped data structure: { name: "dimension_value", value: number }
            chartData = serverData.map((item: any) => {
              const numValue = Number(item.value);
              const safeValue = isNaN(numValue) ? 0 : numValue;
              return {
                name: item.name || 'Unknown',
                value: safeValue,
                count: safeValue,
                [config.metrics?.[0] || 'count']: safeValue,
                _drilldownData: item.additional_data
              };
            });
          }
          console.log('✅ Processed drilldown chart data:', {
            totalItems: chartData.length,
            sampleData: chartData[0],
            currentLevel: currentDrilldownLevel,
            nextDimension: config.drilldownConfig?.drilldownLevels[currentDrilldownLevel + 1] || 'none',
            allData: chartData
          });
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
  }, [config.formId, config.dimensions, config.metrics, config.filters, config.xAxis, config.yAxis, config.aggregation, config.aggregationType, config.groupByField, config.drilldownConfig?.enabled, config.drilldownConfig?.drilldownLevels, drilldownState?.values, (config as any).data, getFormSubmissionData, getChartData]);
  const processSubmissionData = (submissions: any[]) => {
    if (!submissions.length) {
      console.log('No submissions to process');
      return [];
    }
    console.log('Processing submissions:', submissions.length);
    console.log('🔍 Group by field:', config.groupByField);

    // Get dimension fields - support both drilldownLevels and levels for compatibility
    const drilldownLevelsLocal = config.drilldownConfig?.drilldownLevels || config.drilldownConfig?.levels || [];
    let dimensionFields: string[] = [];
    if (config.drilldownConfig?.enabled && drilldownLevelsLocal.length > 0) {
      const currentDrilldownLevel = drilldownState?.values?.length || 0;
      const currentDimension = drilldownLevelsLocal[currentDrilldownLevel] || drilldownLevelsLocal[0];
      dimensionFields = [currentDimension];
    } else {
      dimensionFields = config.dimensions && config.dimensions.length > 0 ? config.dimensions : config.xAxis ? [config.xAxis] : [];
    }
    if (dimensionFields.length === 0) {
      dimensionFields = ['_default'];
    }

    // Get metric fields
    const metricFields = config.metrics && config.metrics.length > 0 ? config.metrics : config.aggregation === 'count' || config.aggregationType === 'count' ? ['count'] : config.yAxis ? [config.yAxis] : ['count'];
    console.log('Processing with dimensions:', dimensionFields, 'metrics:', metricFields, 'groupBy:', config.groupByField);

    // If groupByField is specified, use grouped processing
    if (config.groupByField) {
      return processGroupedData(submissions, dimensionFields, metricFields, config.groupByField);
    }
    
    // For multiple dimensions, we need to create a cross-product structure
    if (dimensionFields.length > 1) {
      return processMultiDimensionalData(submissions, dimensionFields, metricFields);
    } else {
      return processSingleDimensionalData(submissions, dimensionFields, metricFields);
    }
  };
  
  const processGroupedData = (submissions: any[], dimensionFields: string[], metricFields: string[], groupByField: string) => {
    console.log('🔍 Processing grouped data with groupBy:', groupByField);
    
    // Structure: { dimensionValue: { groupValue1: metricSum, groupValue2: metricSum } }
    const groupedData: { [dimensionKey: string]: { [groupKey: string]: number } } = {};
    const allGroupValues = new Set<string>();
    
    submissions.forEach(submission => {
      const submissionData = submission.submission_data;
      
      // Apply filters
      if (!passesFilters(submissionData)) return;
      
      // Get dimension and group values
      const dimensionKey = getDimensionKey(submissionData, dimensionFields);
      const groupValue = getDimensionValue(submissionData, groupByField);
      
      allGroupValues.add(groupValue);
      
      // Initialize structures
      if (!groupedData[dimensionKey]) {
        groupedData[dimensionKey] = {};
      }
      if (!groupedData[dimensionKey][groupValue]) {
        groupedData[dimensionKey][groupValue] = 0;
      }
      
      // Aggregate metrics
      metricFields.forEach(metric => {
        const metricValue = getMetricValue(submissionData, metric);
        groupedData[dimensionKey][groupValue] += metricValue;
      });
    });
    
    // Convert to chart-friendly format
    const result: any[] = [];
    Object.entries(groupedData).forEach(([dimensionValue, groups]) => {
      const dataPoint: any = { name: dimensionValue };
      
      // Add each group value as a separate property
      allGroupValues.forEach(groupValue => {
        dataPoint[groupValue] = groups[groupValue] || 0;
      });
      
      result.push(dataPoint);
    });
    
    console.log('🔍 Grouped data result:', result);
    console.log('🔍 All group values:', Array.from(allGroupValues));
    
    return result;
  };
  const processSingleDimensionalData = (submissions: any[], dimensionFields: string[], metricFields: string[]) => {
    const processedData: {
      [key: string]: any;
    } = {};
    submissions.forEach(submission => {
      const submissionData = submission.submission_data;

      // Apply filters
      if (!passesFilters(submissionData)) return;
      const dimensionKey = getDimensionKey(submissionData, dimensionFields);
      if (!processedData[dimensionKey]) {
        processedData[dimensionKey] = {
          name: dimensionKey,
          value: 0
        };
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
    // For multiple dimensions, create a matrix where each row represents unique combinations
    const groupedData: {
      [key: string]: {
        [seriesKey: string]: number;
      };
    } = {};
    const allSeries = new Set<string>();

    // Process each submission
    submissions.forEach(submission => {
      const submissionData = submission.submission_data;
      if (!passesFilters(submissionData)) return;

      // Create combinations for each dimension
      dimensionFields.forEach((dim, dimIndex) => {
        const value = getDimensionValue(submissionData, dim);
        const fieldName = getFormFieldName(dim);
        const seriesKey = `${fieldName}: ${value}`;
        allSeries.add(seriesKey);

        // Group by dimension field for proper separation
        const groupKey = fieldName;
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = {};
        }
        if (!groupedData[groupKey][seriesKey]) {
          groupedData[groupKey][seriesKey] = 0;
        }
        metricFields.forEach(metric => {
          const metricValue = getMetricValue(submissionData, metric);
          groupedData[groupKey][seriesKey] += metricValue;
        });
      });
    });

    // Convert to chart-friendly format - create separate data points for each dimension group
    const result: any[] = [];
    Object.entries(groupedData).forEach(([groupName, series]) => {
      const dataPoint: any = {
        name: groupName
      };

      // Add all series as separate properties
      Object.entries(series).forEach(([seriesKey, value]) => {
        dataPoint[seriesKey] = value;
      });

      // Fill missing series with 0
      allSeries.forEach(seriesKey => {
        if (!(seriesKey in dataPoint)) {
          dataPoint[seriesKey] = 0;
        }
      });
      result.push(dataPoint);
    });

    // If no groups were created, create a single "All Data" group
    if (result.length === 0) {
      const dataPoint: any = {
        name: "All Data"
      };
      allSeries.forEach(seriesKey => {
        dataPoint[seriesKey] = 0;
      });
      result.push(dataPoint);
    }
    console.log('Multi-dimensional processed data:', result);
    console.log('All series keys:', Array.from(allSeries));
    console.log('Form fields loaded:', formFields.length, 'Current form:', currentForm?.name);
    return result;
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
    return dimensionFields.map(dim => getDimensionValue(submissionData, dim)).join(' - ') || 'Not Specified';
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
      // Handle currency objects
      if (value.amount !== undefined) {
        const numValue = Number(value.amount);
        return isNaN(numValue) ? 0 : numValue;
      }
      return 1;
    } else if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    } else if (value) {
      // Try to parse as number for string values
      const numValue = Number(value);
      return isNaN(numValue) ? 1 : numValue;
    }
    return 0;
  };
  const colors = colorSchemes[config.colorTheme || 'default'];

  // Helper to get drilldown levels (supports both property names for compatibility)
  const getDrilldownLevels = (): string[] => {
    return config.drilldownConfig?.drilldownLevels || config.drilldownConfig?.levels || [];
  };

  // Get available values for the current drilldown level
  const getAvailableValuesForLevel = (levelIndex: number) => {
    const drilldownLevels = getDrilldownLevels();
    if (!config.drilldownConfig?.enabled || drilldownLevels.length === 0 || !chartData.length) {
      return [];
    }
    const currentDimension = drilldownLevels[levelIndex];
    if (!currentDimension) return [];

    // Extract unique values from chart data
    const values = chartData.map(item => item?.name).filter(name => name && name !== 'Not Specified').filter((value, index, array) => array.indexOf(value) === index).sort();
    return values;
  };
  const handleDrilldownSelect = (value: string) => {
    const drilldownLevels = getDrilldownLevels();
    if (!config.drilldownConfig?.enabled || drilldownLevels.length === 0 || !onDrilldown) {
      return;
    }
    const currentLevel = drilldownState?.values?.length || 0;
    const nextLevel = drilldownLevels[currentLevel];
    if (nextLevel && value) {
      console.log('🔍 Drilldown select:', {
        nextLevel,
        selectedValue: value,
        currentLevel,
        fieldName: getFormFieldName(nextLevel)
      });
      onDrilldown(nextLevel, value);
    }
  };
  const resetDrilldown = () => {
    if (onDrilldown) {
      // Reset to initial state by calling drilldown with empty values
      onDrilldown('', '');
    }
  };

  // Get the current level info for the drilldown selector
  const getCurrentLevelInfo = () => {
    const drilldownLevels = getDrilldownLevels();
    if (!config.drilldownConfig?.enabled || drilldownLevels.length === 0) {
      return null;
    }
    const currentLevel = drilldownState?.values?.length || 0;
    const nextDimension = drilldownLevels[currentLevel];
    if (!nextDimension) return null;
    return {
      levelIndex: currentLevel,
      fieldId: nextDimension,
      fieldName: getFormFieldName(nextDimension),
      availableValues: getAvailableValuesForLevel(currentLevel),
      canDrillFurther: currentLevel < drilldownLevels.length
    };
  };
  const currentLevelInfo = getCurrentLevelInfo();
  const handlePieClick = (data: any, index?: number, event?: any) => {
    const drilldownLevels = getDrilldownLevels();
    if (!config.drilldownConfig?.enabled || !onDrilldown || drilldownLevels.length === 0) return;
    if (event) {
      event.stopPropagation();
    }
    const currentLevel = drilldownState?.values?.length || 0;
    if (currentLevel >= drilldownLevels.length) return;
    const nextLevel = drilldownLevels[currentLevel];
    const clickedValue = data?.name || data;
    if (nextLevel && clickedValue && clickedValue !== 'Not Specified') {
      console.log('🥧 Pie click drilldown:', {
        nextLevel,
        clickedValue,
        currentLevel,
        fieldName: getFormFieldName(nextLevel),
        totalLevels: drilldownLevels.length
      });
      onDrilldown(nextLevel, clickedValue);
    }
  };
  const handleBarClick = (data: any, event?: any) => {
    // This will be handled by the drilldown controls instead of direct click
    console.log('Bar clicked, use drilldown controls instead');
  };
  const handleChartClick = (data: any, event?: any) => {
    // This will be handled by the drilldown controls instead of direct click
    console.log('Chart clicked, use drilldown controls instead');
  };
  const renderChart = () => {
    if (loading) {
      return <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading chart data...</div>
        </div>;
    }
    if (!chartData.length) {
      return <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">No data available</div>
            <div className="text-sm text-muted-foreground">Configure the chart settings to display data</div>
          </div>
        </div>;
    }

    // Sanitize chart data - ensure all numeric values are valid numbers (not NaN/undefined)
    const sanitizedChartData = chartData.map(item => {
      const sanitized: any = { name: item.name || 'Unknown' };
      Object.keys(item).forEach(key => {
        if (key === 'name' || key === '_drilldownData') {
          sanitized[key] = item[key];
        } else {
          const val = Number(item[key]);
          sanitized[key] = isNaN(val) || !isFinite(val) ? 0 : val;
        }
      });
      return sanitized;
    });

    // Calculate safe domain for Y axis to prevent NaN errors
    const getYAxisDomain = (data: any[], metricKey: string): [number, number] => {
      if (!data || data.length === 0) return [0, 100]; // Safe default
      const values = data.map(item => {
        const val = Number(item[metricKey]);
        return isNaN(val) || !isFinite(val) ? 0 : val;
      }).filter(v => isFinite(v));
      if (values.length === 0) return [0, 100]; // Safe default
      const maxVal = Math.max(...values, 0);
      const minVal = Math.min(...values, 0);
      // Return safe default if all values are 0 or invalid
      if (!isFinite(maxVal) || (maxVal === 0 && minVal === 0)) return [0, 100];
      // Ensure we have a valid range (max > min)
      const safeMax = Math.max(maxVal * 1.1, 1);
      return [Math.min(0, minVal), safeMax];
    };

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
    if (sanitizedChartData.length > 0 && !sanitizedChartData[0].hasOwnProperty(primaryMetric)) {
      // Fallback to available keys
      const availableKeys = Object.keys(sanitizedChartData[0]).filter(key => key !== 'name' && key !== '_drilldownData' && typeof sanitizedChartData[0][key] === 'number');
      if (availableKeys.length > 0) {
        primaryMetric = availableKeys[0];
      } else {
        // No valid numeric keys found - show no data message
        return <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">No numeric data available</div>
            <div className="text-sm text-muted-foreground">Configure the chart with valid numeric metrics</div>
          </div>
        </div>;
      }
    }

    // Final safety check: ensure we actually have some non-zero numeric data for the primary metric
    const hasValidNumericData = sanitizedChartData.some(item => {
      const val = Number(item[primaryMetric]);
      return !isNaN(val) && isFinite(val) && val !== 0;
    });

    if (!hasValidNumericData) {
      return <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-muted-foreground mb-2">No numeric data available</div>
          <div className="text-sm text-muted-foreground">Current configuration does not produce any numeric values to chart.</div>
        </div>
      </div>;
    }

    const chartType = config.type || config.chartType || 'bar';
    console.log('Chart rendering config:', {
      chartType,
      primaryMetric,
      dataKeys: sanitizedChartData.length > 0 ? Object.keys(sanitizedChartData[0]) : [],
      sampleData: sanitizedChartData[0],
      totalRecords: sanitizedChartData.length
    });

    // Get all dimension-based data keys (for multi-dimensional charts OR grouped charts)
    let dimensionKeys = sanitizedChartData.length > 0 ? Object.keys(sanitizedChartData[0]).filter(key => key !== 'name' && key !== '_drilldownData' && typeof sanitizedChartData[0][key] === 'number') : [];
    const isMultiDimensional = (config.dimensions && config.dimensions.length > 1) || (config.groupByField && dimensionKeys.length > 1);
    
    console.log('📊 Chart rendering - dimensionKeys:', dimensionKeys);
    console.log('📊 Chart rendering - isMultiDimensional:', isMultiDimensional);
    console.log('📊 Chart rendering - groupByField:', config.groupByField);

    // For multi-dimensional charts, limit the number of series to avoid cluttered display
    if (isMultiDimensional && dimensionKeys.length > 8) {
      // Sort by total value and take top 8 series
      const seriesValues = dimensionKeys.map(key => ({
        key,
        total: sanitizedChartData.reduce((sum, item) => sum + (item[key] || 0), 0)
      }));
      seriesValues.sort((a, b) => b.total - a.total);
      dimensionKeys = seriesValues.slice(0, 8).map(s => s.key);
    }
    switch (chartType) {
      case 'bar':
        return <div className="relative w-full" style={{
          height: '400px',
          paddingBottom: '40px'
        }}>
            <div className="absolute inset-0" style={{
            bottom: '40px'
          }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sanitizedChartData} margin={{
                top: 20,
                right: 30,
                left: 40,
                bottom: 80
              }}>
                  <XAxis dataKey="name" tick={{
                  fontSize: 11
                }} angle={-45} textAnchor="end" height={80} interval={0} label={{
                  value: config.xAxisLabel || 'Category',
                  position: 'insideBottom',
                  offset: -5
                }} />
                  <YAxis tick={{
                  fontSize: 11
                }} label={{
                  value: config.yAxisLabel || getFormFieldName(primaryMetric),
                  angle: -90,
                  position: 'insideLeft'
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                   <Tooltip formatter={(value, name, props) => {
                  // For multi-dimensional charts, name is already "Field Name: Value"
                  // For single-dimensional charts, name is the field ID, so get field name
                  const displayName = isMultiDimensional ? name : getFormFieldName(name.toString());
                  return [`${displayName}: ${value}`, `Category: ${props.payload?.name || 'N/A'}`];
                }} labelFormatter={label => `Category: ${label}`} contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }} />
                   {showLegend && <Legend formatter={value => isMultiDimensional ? value : getFormFieldName(value.toString())} iconType="rect" />}
                   {isMultiDimensional ?
                // Render separate bars for each dimension value
                dimensionKeys.map((key, index) => <Bar key={key} dataKey={key} fill={colors[index % colors.length]} name={key} style={{
                  cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default'
                }} />) :
                // Single dimension - render primary metric and additional metrics if any
                <>
                         <Bar dataKey={primaryMetric} fill={colors[0]} name={getFormFieldName(primaryMetric)} style={{
                    cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default'
                  }} />
                         {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => <Bar key={metric} dataKey={metric} fill={colors[(index + 1) % colors.length]} name={getFormFieldName(metric)} style={{
                    cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default'
                  }} />)}
                     </>}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'column':
        return <div className="relative w-full" style={{
          height: '400px',
          paddingBottom: '40px'
        }}>
            <div className="absolute inset-0" style={{
            bottom: '40px'
          }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sanitizedChartData} layout="horizontal" margin={{
                top: 20,
                right: 30,
                left: 120,
                bottom: 20
              }}>
                  <XAxis type="number" tick={{
                  fontSize: 11
                }} label={{
                  value: getFormFieldName(primaryMetric),
                  position: 'insideBottom',
                  offset: -5
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                  <YAxis dataKey="name" type="category" width={120} tick={{
                  fontSize: 11
                }} />
                  <Tooltip formatter={(value, name, props) => [`${getFormFieldName(name.toString())}: ${value}`, `Category: ${props.payload?.name || 'N/A'}`, `Total Records: ${sanitizedChartData.length}`]} labelFormatter={label => `Category: ${label}`} contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }} />
                   {showLegend && <Legend formatter={value => getFormFieldName(value.toString())} iconType="rect" />}
                   <Bar dataKey={primaryMetric} fill={colors[0]} name={getFormFieldName(primaryMetric)} />
                   {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => <Bar key={metric} dataKey={metric} fill={colors[(index + 1) % colors.length]} name={getFormFieldName(metric)} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'pie':
        return <div className="relative w-full" style={{
          height: '400px',
          paddingBottom: '40px'
        }}>
            <div className="absolute inset-0" style={{
            bottom: '40px'
          }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={sanitizedChartData} cx="50%" cy="50%" outerRadius={120} fill="#8884d8" dataKey={primaryMetric} label={({
                  name,
                  value,
                  percent
                }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`} style={{
                  cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default'
                }} onClick={config.drilldownConfig?.enabled ? handlePieClick : undefined}>
                    {sanitizedChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} style={{
                    cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default'
                  }} />)}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => {
                  const numValue = Number(value) || 0;
                  const total = sanitizedChartData.reduce((sum, item) => sum + (Number(item[primaryMetric]) || 0), 0);
                  return [`${props.payload?.name || 'Unknown'}: ${numValue}`, `Percentage: ${total > 0 ? (numValue / total * 100).toFixed(1) : 0}%`];
                }} contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }} />
                   {showLegend && <Legend formatter={value => value} />}
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'donut':
        return <div className="relative w-full" style={{
          height: '400px',
          paddingBottom: '40px'
        }}>
            <div className="absolute inset-0" style={{
            bottom: '40px'
          }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={sanitizedChartData} cx="50%" cy="50%" innerRadius={config.innerRadius || 60} outerRadius={120} fill="#8884d8" dataKey={primaryMetric} label={({
                  name,
                  value,
                  percent
                }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}>
                    {sanitizedChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                  </Pie>
                   <Tooltip formatter={(value, name) => [value, name]} />
                   {showLegend && <Legend />}
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'line':
        return <div className="relative w-full" style={{
          height: '400px',
          paddingBottom: '40px'
        }}>
            <div className="absolute inset-0" style={{
            bottom: '40px'
          }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={sanitizedChartData} margin={{
                top: 20,
                right: 30,
                left: 40,
                bottom: 80
              }}>
                  <XAxis dataKey="name" tick={{
                  fontSize: 11
                }} angle={-45} textAnchor="end" height={80} interval={0} label={{
                  value: config.xAxisLabel || 'Category',
                  position: 'insideBottom',
                  offset: -5
                }} />
                  <YAxis tick={{
                  fontSize: 11
                }} label={{
                  value: config.yAxisLabel || getFormFieldName(primaryMetric),
                  angle: -90,
                  position: 'insideLeft'
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                  <Tooltip formatter={(value, name, props) => {
                  const displayName = isMultiDimensional ? name : getFormFieldName(name.toString());
                  return [`${displayName}: ${value}`, `Category: ${props.payload?.name || 'N/A'}`];
                }} labelFormatter={label => `Category: ${label}`} contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }} />
                   {showLegend && <Legend formatter={value => isMultiDimensional ? value : getFormFieldName(value.toString())} iconType="line" />}
                   {isMultiDimensional ?
                // Render separate lines for each dimension value
                dimensionKeys.map((key, index) => <Line key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} strokeWidth={3} name={key} dot={{
                  fill: colors[index % colors.length],
                  strokeWidth: 2,
                  r: 4
                }} style={{
                  cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default'
                }} />) :
                // Single dimension - render primary metric and additional metrics if any
                <>
                        <Line type="monotone" dataKey={primaryMetric} stroke={colors[0]} strokeWidth={3} name={getFormFieldName(primaryMetric)} dot={{
                    fill: colors[0],
                    strokeWidth: 2,
                    r: 4
                  }} style={{
                    cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default'
                  }} />
                        {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => <Line key={metric} type="monotone" dataKey={metric} stroke={colors[(index + 1) % colors.length]} strokeWidth={3} name={getFormFieldName(metric)} dot={{
                    fill: colors[(index + 1) % colors.length],
                    strokeWidth: 2,
                    r: 4
                  }} style={{
                    cursor: config.drilldownConfig?.enabled ? 'pointer' : 'default'
                  }} />)}
                     </>}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'area':
        return <div className="relative w-full" style={{
          height: '400px',
          paddingBottom: '40px'
        }}>
            <div className="absolute inset-0" style={{
            bottom: '40px'
          }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsAreaChart data={sanitizedChartData} margin={{
                top: 20,
                right: 30,
                left: 40,
                bottom: 80
              }}>
                  <XAxis dataKey="name" tick={{
                  fontSize: 11
                }} angle={-45} textAnchor="end" height={80} interval={0} label={{
                  value: config.xAxisLabel || 'Category',
                  position: 'insideBottom',
                  offset: -5
                }} />
                  <YAxis tick={{
                  fontSize: 11
                }} label={{
                  value: config.yAxisLabel || getFormFieldName(primaryMetric),
                  angle: -90,
                  position: 'insideLeft'
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                  <Tooltip formatter={(value, name, props) => {
                  const displayName = getFormFieldName(name.toString());
                  return [`${displayName}: ${value}`, `Category: ${props.payload?.name || 'N/A'}`];
                }} labelFormatter={label => `Category: ${label}`} contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }} />
                   {showLegend && <Legend formatter={value => getFormFieldName(value.toString())} iconType="rect" />}
                   <Area type="monotone" dataKey={primaryMetric} stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} name={getFormFieldName(primaryMetric)} />
                   {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => <Area key={metric} type="monotone" dataKey={metric} stroke={colors[(index + 1) % colors.length]} fill={colors[(index + 1) % colors.length]} fillOpacity={0.6} name={getFormFieldName(metric)} />)}
                </RechartsAreaChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'scatter':
        return <div className="relative w-full" style={{
          height: '400px',
          paddingBottom: '40px'
        }}>
            <div className="absolute inset-0" style={{
            bottom: '40px'
          }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsScatterChart data={sanitizedChartData} margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 80
              }}>
                  <XAxis dataKey="name" tick={{
                  fontSize: 11
                }} angle={-45} textAnchor="end" height={80} label={{
                  value: config.xAxisLabel || 'Category',
                  position: 'insideBottom',
                  offset: -5
                }} />
                  <YAxis dataKey={primaryMetric} tick={{
                  fontSize: 11
                }} label={{
                  value: config.yAxisLabel || getFormFieldName(primaryMetric),
                  angle: -90,
                  position: 'insideLeft'
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} />
                  <Tooltip formatter={(value, name) => [value, name]} labelFormatter={label => `Category: ${label}`} contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }} />
                  <Scatter dataKey={primaryMetric} fill={colors[0]} />
                </RechartsScatterChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'bubble':
        // For bubble chart, use multiple scatter components with different sizes
        const sizeField = config.sizeField || primaryMetric;
        const bubbleData = sanitizedChartData.map(item => ({
          ...item,
          size: item[sizeField] || 10
        }));
        return <div className="relative w-full" style={{
          height: '400px',
          paddingBottom: '40px'
        }}>
            <div className="absolute inset-0" style={{
            bottom: '40px'
          }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsScatterChart data={bubbleData}>
                    <XAxis dataKey="name" />
                    <YAxis dataKey={primaryMetric} domain={getYAxisDomain(bubbleData, primaryMetric)} />
                    <Tooltip formatter={(value, name, props) => [`${name}: ${value}`, `Size: ${props.payload.size}`]} />
                    {bubbleData.map((entry, index) => <Scatter key={index} data={[entry]} fill={colors[index % colors.length]} r={Math.max(5, Math.min(20, entry.size / 2))} />)}
                </RechartsScatterChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'heatmap':
        // Generate heatmap data grid with safe values
        const heatmapData = sanitizedChartData.map((item, index) => {
          const rawValue = item[config.heatmapIntensityField || primaryMetric];
          const safeValue = typeof rawValue === 'number' && isFinite(rawValue) ? rawValue : 0;
          return {
            ...item,
            x: index % (config.gridColumns || 5),
            y: Math.floor(index / (config.gridColumns || 5)),
            value: safeValue
          };
        });
        const heatmapMaxValue = Math.max(...heatmapData.map(d => d.value), 1); // Ensure minimum of 1 to prevent division by zero
        return <div className="relative">
            <div className="grid gap-1" style={{
            gridTemplateColumns: `repeat(${config.gridColumns || 5}, 1fr)`,
            maxWidth: '100%'
          }}>
              {heatmapData.map((cell, index) => {
                const colorIndex = Math.floor((cell.value / heatmapMaxValue) * (colors.length - 1));
                const safeColorIndex = Math.max(0, Math.min(colors.length - 1, isNaN(colorIndex) ? 0 : colorIndex));
                return <div key={index} className="aspect-square rounded-sm flex items-center justify-center text-xs font-medium" style={{
                  backgroundColor: colors[safeColorIndex],
                  color: cell.value > heatmapMaxValue / 2 ? 'white' : 'black'
                }} title={`${cell.name}: ${cell.value}`}>
                  {cell.value}
                </div>;
              })}
            </div>
          </div>;
      case 'table':
        return <div className="overflow-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Category
                  </th>
                     {(config.metrics || [primaryMetric]).map(metric => <th key={metric} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                         {getFieldName(metric)}
                       </th>)}
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {sanitizedChartData.map((row, index) => <tr key={index} className="hover:bg-muted/50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      {row.name}
                    </td>
                    {(config.metrics || [primaryMetric]).map(metric => <td key={metric} className="px-4 py-2 whitespace-nowrap text-sm">
                        {row[metric]}
                      </td>)}
                  </tr>)}
              </tbody>
            </table>
          </div>;
      default:
        return <div className="flex items-center justify-center h-64 text-muted-foreground">
            Chart type "{chartType}" not implemented yet
          </div>;
    }
  };
  const canDrillUp = drilldownState?.values && drilldownState.values.length > 0;
  return <div className="h-full flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
      {/* Chart Header with Controls */}
      <div className="flex items-center justify-between flex-shrink-0">
        {config.title && <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{config.title}</h3>
              {canDrillUp && <Button variant="outline" size="sm" onClick={() => {
            if (onDrilldown && drilldownState?.values) {
              const newValues = [...drilldownState.values];
              newValues.pop(); // Remove last value to go up one level
              // Trigger drilldown with reduced values
              const lastLevel = config.drilldownConfig?.drilldownLevels?.[newValues.length - 1] || '';
              const lastValue = newValues[newValues.length - 1] || '';
              onDrilldown(lastLevel, lastValue);
            }
          }}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>}
            </div>
            {config.description && <p className="text-sm text-muted-foreground">{config.description}</p>}
            {drilldownState?.values && drilldownState.values.length > 0 && <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 mt-2">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Filtered by:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {drilldownState.values.map((value, index) => {
              const fieldName = getFormFieldName(config.drilldownConfig?.drilldownLevels?.[index] || '');
              return <React.Fragment key={index}>
                        {index > 0 && <ChevronRight className="h-4 w-4 text-blue-500" />}
                        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{fieldName}:</span>
                          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{value}</span>
                        </div>
                      </React.Fragment>;
            })}
                </div>
              </div>}
            {config.drilldownConfig?.enabled && (!drilldownState?.values || drilldownState.values.length === 0)}
          </div>}
        
        {/* Chart Controls */}
         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setShowLegend(!showLegend)}>
            {showLegend ? 'Hide' : 'Show'} Legend
          </Button>
          
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setShowFormFields(!showFormFields)}>
            {showFormFields ? 'Hide' : 'Show'} Form Details ({getFormName(config.formId)})
          </Button>
          
          {config.drilldownConfig?.enabled && <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setShowDrilldownPanel(!showDrilldownPanel)}>
              {showDrilldownPanel ? 'Hide' : 'Show'} Drilldown
            </Button>}
          
          {onEdit && <Button size="sm" variant="outline" className="h-8 px-2" onClick={onEdit}>
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>}
          
          {config.filters && config.filters.length > 0 && <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => {/* TODO: Open filter panel */}}>
              Filter ({config.filters.length})
            </Button>}
          
          {config.drilldownConfig?.enabled && showDrilldownPanel && <div className="mb-4 p-3 bg-muted/30 rounded-lg border">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Drilldown Controls</span>
                  
                  {/* Debug info */}
                  <div className="text-xs text-muted-foreground bg-red-100 p-1 rounded">
                    Debug: enabled={config.drilldownConfig?.enabled?.toString()}, 
                    levels={config.drilldownConfig?.drilldownLevels?.length || 0}, 
                    currentLevel={currentLevelInfo?.levelIndex || 'null'},
                    availableValues={currentLevelInfo?.availableValues?.length || 0}
                  </div>
                </div>
                
                {/* Drilldown Path Breadcrumb */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="font-medium">Path: All Records</span>
                  {drilldownState?.path?.map((level, index) => <React.Fragment key={index}>
                      <ChevronRight className="h-3 w-3" />
                      <span className="font-medium">
                        {getFormFieldName(level)}: {drilldownState.values?.[index] || ''}
                      </span>
                    </React.Fragment>)}
                </div>
                
                {/* Drilldown Level Selector */}
                {currentLevelInfo && <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Drill down by {currentLevelInfo.fieldName}:</span>
                    {currentLevelInfo.availableValues.length > 0 ? <Select onValueChange={handleDrilldownSelect}>
                        <SelectTrigger className="w-48 h-8">
                          <SelectValue placeholder={`Select ${currentLevelInfo.fieldName}`} />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border shadow-md z-50">
                          {currentLevelInfo.availableValues.map(value => <SelectItem key={value} value={value} className="hover:bg-accent hover:text-accent-foreground">
                              {value}
                            </SelectItem>)}
                        </SelectContent>
                      </Select> : <span className="text-sm text-muted-foreground italic">No values available</span>}
                  </div>}
                
                {/* Reset Drilldown Button */}
                {drilldownState?.values?.length > 0 && <Button size="sm" variant="outline" onClick={resetDrilldown}>
                    Reset to All Records
                  </Button>}
              </div>
            </div>}
          
          {config.drilldownConfig?.enabled && !showDrilldownPanel && <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              
              {/* Debug info */}
              
              
              {/* Drilldown Path Breadcrumb */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span className="font-medium">All Records</span>
                {drilldownState?.path?.map((level, index) => <React.Fragment key={index}>
                    <ChevronRight className="h-3 w-3" />
                    <span className="font-medium">
                      {getFormFieldName(level)}: {drilldownState.values?.[index] || ''}
                    </span>
                  </React.Fragment>)}
              </div>
            </div>}
        </div>
      </div>

      {/* Form Fields Display */}
      {showFormFields && <div className="p-4 bg-muted/30 rounded-lg border flex-shrink-0">
          <h4 className="font-semibold mb-2">Form Details: {getFormName(config.formId)}</h4>
          <div className="space-y-2">
            {formFields.map(field => <div key={field.id} className="text-sm">
                <span className="font-medium">{getFormFieldName(field.id)}:</span>
                <span className="ml-2 text-muted-foreground">
                  {field.type} field
                  {config.dimensions?.includes(field.id) && <span className="ml-2 text-xs bg-primary/10 text-primary px-1 rounded">
                      Selected as dimension
                    </span>}
                  {config.metrics?.includes(field.id) && <span className="ml-2 text-xs bg-secondary/10 text-secondary px-1 rounded">
                      Selected as metric
                    </span>}
                </span>
              </div>)}
            {chartData.length > 0 && <div className="mt-4 pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  <strong>Chart Data Series:</strong> {Object.keys(chartData[0]).filter(k => k !== 'name').map(k => k.includes(':') ? k : getFormFieldName(k)).join(', ')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  <strong>Total Records:</strong> {chartData.length}
                </div>
              </div>}
          </div>
        </div>}

      {/* Flexible Spacer - pushes chart to bottom */}
      <div className="flex-grow min-h-4"></div>

      {/* Chart Container - Always positioned at bottom */}
      <div className="flex-shrink-0 min-h-[300px]">
        {config.showAsTable ? (
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse border border-border">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted text-left font-semibold">
                    {config.xAxisLabel || (config.dimensions && config.dimensions.length > 0 
                      ? getFormFieldName(config.dimensions[0]) 
                      : config.xAxis 
                      ? getFormFieldName(config.xAxis)
                      : 'Category')}
                  </th>
                  {(() => {
                    // For grouped data, show all group value columns
                    if (config.groupByField && chartData.length > 0) {
                      const groupKeys = Object.keys(chartData[0]).filter(
                        key => key !== 'name' && key !== '_drilldownData' && typeof chartData[0][key] === 'number'
                      );
                      return groupKeys.map(key => (
                        <th key={key} className="border border-border p-2 bg-muted text-left font-semibold">
                          {key}
                        </th>
                      ));
                    }
                    
                    // For non-grouped data, show metric columns
                    const metrics = config.metrics && config.metrics.length > 0 
                      ? config.metrics 
                      : config.yAxis 
                      ? [config.yAxis]
                      : ['count'];
                    
                    return metrics.map(metric => (
                      <th key={metric} className="border border-border p-2 bg-muted text-left font-semibold">
                        {config.yAxisLabel || getFormFieldName(metric)}
                      </th>
                    ));
                  })()}
                </tr>
              </thead>
              <tbody>
                {chartData.map((item, index) => {
                  const dimensionField = config.dimensions && config.dimensions.length > 0 
                    ? config.dimensions[0] 
                    : config.xAxis || '';
                  const dimensionLabel = config.xAxisLabel || getFormFieldName(dimensionField);
                  
                  return (
                    <tr key={index} className="hover:bg-muted/30">
                      <td className="border border-border p-2 font-medium">{item.name}</td>
                      {(() => {
                        // For grouped data, show all group values
                        if (config.groupByField && chartData.length > 0) {
                          const groupKeys = Object.keys(item).filter(
                            key => key !== 'name' && key !== '_drilldownData' && typeof item[key] === 'number'
                          );
                          return groupKeys.map(key => (
                            <td 
                              key={key} 
                              className="border border-border p-2 cursor-pointer hover:bg-primary/10"
                              onClick={() => {
                                setCellSubmissionsDialog({
                                  open: true,
                                  dimensionField,
                                  dimensionValue: item.name,
                                  groupField: config.groupByField,
                                  groupValue: key,
                                  dimensionLabel,
                                  groupLabel: getFormFieldName(config.groupByField || ''),
                                });
                              }}
                            >
                              {item[key]?.toLocaleString() || 0}
                            </td>
                          ));
                        }
                        
                        // For non-grouped data, show metric values
                        const metrics = config.metrics && config.metrics.length > 0 
                          ? config.metrics 
                          : config.yAxis 
                          ? [config.yAxis]
                          : ['count'];
                        
                        return metrics.map(metric => (
                          <td 
                            key={metric} 
                            className="border border-border p-2 cursor-pointer hover:bg-primary/10"
                            onClick={() => {
                              setCellSubmissionsDialog({
                                open: true,
                                dimensionField,
                                dimensionValue: item.name,
                                dimensionLabel,
                              });
                            }}
                          >
                            {(item[metric] || item.value || item.count || 0).toLocaleString()}
                          </td>
                        ));
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full">
            {renderChart()}
          </div>
        )}
      </div>
      
      <TableCellSubmissionsDialog
        open={cellSubmissionsDialog.open}
        onOpenChange={(open) => setCellSubmissionsDialog({ ...cellSubmissionsDialog, open })}
        formId={config.formId || ''}
        dimensionField={cellSubmissionsDialog.dimensionField}
        dimensionValue={cellSubmissionsDialog.dimensionValue}
        groupField={cellSubmissionsDialog.groupField}
        groupValue={cellSubmissionsDialog.groupValue}
        dimensionLabel={cellSubmissionsDialog.dimensionLabel}
        groupLabel={cellSubmissionsDialog.groupLabel}
      />
    </div>;
}