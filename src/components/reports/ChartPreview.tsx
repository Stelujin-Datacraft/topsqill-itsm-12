import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, ArrowLeft, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, PieChart as RechartsPieChart, Pie, Cell, LineChart as RechartsLineChart, Line, AreaChart as RechartsAreaChart, Area, ScatterChart as RechartsScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, FunnelChart, Funnel, Treemap, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useReports } from '@/hooks/useReports';
import { useFormsData } from '@/hooks/useFormsData';
import { ChartConfig } from '@/types/reports';
import { colorSchemes } from './ChartColorThemes';
import { TableCellSubmissionsDialog } from './TableCellSubmissionsDialog';
import { evaluateFilterCondition, evaluateSubmissionFilters } from '@/utils/filterUtils';
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
  const navigate = useNavigate();
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormFields, setShowFormFields] = useState(false);
  
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

  // State to hold directly fetched fields as fallback
  const [directlyFetchedFields, setDirectlyFetchedFields] = useState<any[]>([]);

  // Get current form and its fields from useFormsData for better reliability
  const currentForm = useMemo(() => {
    return forms.find(f => f.id === config.formId);
  }, [forms, config.formId]);
  
  // Use directly fetched fields as fallback when currentForm.fields is not available
  const formFields = useMemo(() => {
    const fieldsFromForm = currentForm?.fields || [];
    return fieldsFromForm.length > 0 ? fieldsFromForm : directlyFetchedFields;
  }, [currentForm, directlyFetchedFields]);

  // Fetch fields directly when config.formId changes and formFields is empty
  useEffect(() => {
    const fetchFieldsDirectly = async () => {
      if (config.formId && (!currentForm?.fields || currentForm.fields.length === 0)) {
        try {
          const fields = await getFormFields(config.formId);
          if (fields && fields.length > 0) {
            setDirectlyFetchedFields(fields);
            console.log('ChartPreview: Directly fetched fields for form', config.formId, fields);
          }
        } catch (error) {
          console.error('ChartPreview: Error fetching fields directly:', error);
        }
      }
    };
    fetchFieldsDirectly();
  }, [config.formId, currentForm?.fields, getFormFields]);

  // Helper functions to get form and field names with robust fallbacks
  const getFormName = (formId: string): string => {
    const form = forms.find(f => f.id === formId);
    const formName = form?.name || formId;
    console.log(`Getting form name for ${formId}: ${formName}`);
    return formName;
  };
  const getFormFieldName = (fieldId: string): string => {
    // Handle prefixed field IDs from joined forms (e.g., "[FormName].fieldId")
    const prefixMatch = fieldId.match(/^\[(.+?)\]\.(.+)$/);
    if (prefixMatch) {
      const [, formName, originalFieldId] = prefixMatch;
      // Search for the original field ID in forms
      for (const form of forms) {
        const field = form.fields?.find((f: any) => f.id === originalFieldId);
        if (field) {
          return `${formName}: ${field.label || originalFieldId}`;
        }
      }
      return `${formName}: ${originalFieldId}`;
    }
    
    // First try to find field in current form fields
    let field = formFields.find(f => f.id === fieldId);

    // If not found and we have forms data, search across all forms
    if (!field && forms.length > 0) {
      for (const form of forms) {
        field = form.fields?.find((f: any) => f.id === fieldId);
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

  // Apply join to chart data - merges data from secondary form
  const applyChartJoin = async (
    primaryData: any[],
    joinConfig: {
      enabled: boolean;
      secondaryFormId: string;
      joinType: 'inner' | 'left' | 'right' | 'full';
      primaryFieldId: string;
      secondaryFieldId: string;
    }
  ): Promise<any[]> => {
    if (!joinConfig.secondaryFormId || !joinConfig.primaryFieldId || !joinConfig.secondaryFieldId) {
      console.warn('Incomplete join configuration, skipping join');
      return primaryData;
    }

    try {
      // Fetch secondary form data
      const secondaryData = await getFormSubmissionData(joinConfig.secondaryFormId);
      console.log(`📊 Loaded ${secondaryData?.length || 0} records from secondary form for chart join`);

      if (!secondaryData || secondaryData.length === 0) {
        console.log('📊 No secondary data found, returning primary data only');
        return primaryData;
      }

      const { joinType, primaryFieldId, secondaryFieldId, secondaryFormId } = joinConfig;
      const prefix = `[${getFormName(secondaryFormId)}].`;

      // Helper to merge rows
      const mergeRows = (primary: any, secondary: any): any => {
        const merged = { ...primary };
        const mergedData = { ...primary.submission_data };
        
        if (secondary?.submission_data) {
          Object.keys(secondary.submission_data).forEach(key => {
            mergedData[`${prefix}${key}`] = secondary.submission_data[key];
          });
        }
        
        merged.submission_data = mergedData;
        return merged;
      };

      switch (joinType) {
        case 'inner':
          return primaryData
            .map(primaryRow => {
              const primaryValue = primaryRow.submission_data?.[primaryFieldId];
              const matchingSecondary = secondaryData.find(secondaryRow => 
                secondaryRow.submission_data?.[secondaryFieldId] === primaryValue
              );
              if (matchingSecondary) {
                return mergeRows(primaryRow, matchingSecondary);
              }
              return null;
            })
            .filter((row): row is any => row !== null);

        case 'left':
          return primaryData.map(primaryRow => {
            const primaryValue = primaryRow.submission_data?.[primaryFieldId];
            const matchingSecondary = secondaryData.find(secondaryRow => 
              secondaryRow.submission_data?.[secondaryFieldId] === primaryValue
            );
            if (matchingSecondary) {
              return mergeRows(primaryRow, matchingSecondary);
            }
            return primaryRow;
          });

        case 'right':
          const rightResult: any[] = [];
          secondaryData.forEach(secondaryRow => {
            const secondaryValue = secondaryRow.submission_data?.[secondaryFieldId];
            const matchingPrimary = primaryData.find(primaryRow => 
              primaryRow.submission_data?.[primaryFieldId] === secondaryValue
            );
            if (matchingPrimary) {
              rightResult.push(mergeRows(matchingPrimary, secondaryRow));
            } else {
              // Create a row with just secondary data (prefixed)
              const newRow = {
                ...secondaryRow,
                submission_data: Object.keys(secondaryRow.submission_data || {}).reduce((acc: Record<string, any>, key) => {
                  acc[`${prefix}${key}`] = secondaryRow.submission_data[key];
                  return acc;
                }, {} as Record<string, any>)
              };
              rightResult.push(newRow);
            }
          });
          return rightResult;

        case 'full':
          const fullResult: any[] = [];
          const matchedSecondaryIds = new Set<string>();

          primaryData.forEach(primaryRow => {
            const primaryValue = primaryRow.submission_data?.[primaryFieldId];
            const matchingSecondary = secondaryData.find(secondaryRow => 
              secondaryRow.submission_data?.[secondaryFieldId] === primaryValue
            );
            if (matchingSecondary) {
              matchedSecondaryIds.add(matchingSecondary.id);
              fullResult.push(mergeRows(primaryRow, matchingSecondary));
            } else {
              fullResult.push(primaryRow);
            }
          });

          // Add unmatched secondary records
          secondaryData.forEach(secondaryRow => {
            if (!matchedSecondaryIds.has(secondaryRow.id)) {
              const newRow = {
                ...secondaryRow,
                submission_data: Object.keys(secondaryRow.submission_data || {}).reduce((acc: Record<string, any>, key) => {
                  acc[`${prefix}${key}`] = secondaryRow.submission_data[key];
                  return acc;
                }, {} as Record<string, any>)
              };
              fullResult.push(newRow);
            }
          });
          return fullResult;

        default:
          return primaryData;
      }
    } catch (error) {
      console.error('Error applying chart join:', error);
      return primaryData;
    }
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
          // Get aggregation from metricAggregations if available, otherwise use config.aggregation
          const effectiveAggregation = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
          const serverData: any[] = await getChartData(config.formId, chartDimensions, config.metrics || [], effectiveAggregation, config.filters || [], drilldownLevels, drilldownState?.values || [], config.metricAggregations || [], config.groupByField);

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
          let submissions = await getFormSubmissionData(config.formId);
          console.log('Received submissions:', submissions?.length || 0);
          
          // Apply joins if configured
          if (config.joinConfig?.enabled && config.joinConfig?.secondaryFormId) {
            console.log('📊 Applying join with secondary form:', config.joinConfig.secondaryFormId);
            submissions = await applyChartJoin(submissions, config.joinConfig);
            console.log('📊 After join - submissions:', submissions?.length || 0);
          }
          
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
  }, [config.formId, config.dimensions, config.metrics, config.filters, config.xAxis, config.yAxis, config.aggregation, config.aggregationType, config.groupByField, config.drilldownConfig?.enabled, config.drilldownConfig?.drilldownLevels, drilldownState?.values, (config as any).data, config.joinConfig?.enabled, config.joinConfig?.secondaryFormId, getFormSubmissionData, getChartData]);
  const processSubmissionData = (submissions: any[]) => {
    if (!submissions.length) {
      console.log('No submissions to process');
      return [];
    }
    console.log('Processing submissions:', submissions.length);
    
    // Determine the effective group by field - prioritize dimensions[0] over groupByField
    const effectiveGroupByField = config.dimensions?.[0] || config.groupByField;
    console.log('🔍 Group by field:', effectiveGroupByField);

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
    const metricFields = config.metrics && config.metrics.length > 0
      ? config.metrics
      : config.aggregation === 'count' || config.aggregationType === 'count'
        ? ['count']
        : config.yAxis
          ? [config.yAxis]
          : ['count'];

    console.log('Processing with dimensions:', dimensionFields, 'metrics:', metricFields, 'groupBy:', effectiveGroupByField, 'compareMode:', config.compareMode);

    // Compare mode: require exactly two metrics and ignore aggregation/count semantics
    if (config.compareMode) {
      if (!config.metrics || config.metrics.length !== 2) {
        console.warn('Compare mode requires exactly two metric fields. Current metrics:', config.metrics);
        return [];
      }
      return processCompareData(submissions, dimensionFields, config.metrics);
    }

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

  // Process compare mode - X/Y scatter format (Field 1 on X, Field 2 on Y)
  // Get raw display value from submission data (for table display, not numeric conversion)
  const getRawDisplayValue = (submissionData: any, fieldId: string): string => {
    const value = submissionData[fieldId];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if (value.amount !== undefined && value.code) {
        return `${value.code} ${value.amount}`;
      }
      if (value.status) return value.status;
      if (Array.isArray(value)) return value.join(', ');
      return JSON.stringify(value);
    }
    return String(value);
  };

  const processCompareData = (submissions: any[], dimensionFields: string[], metricFields: string[]) => {
    console.log('📊 Processing compare mode with fields:', metricFields, 'dimensions:', dimensionFields);

    const [metricField1, metricField2] = metricFields;
    const field1Name = getFormFieldName(metricField1);
    const field2Name = getFormFieldName(metricField2);

    const hasDimension = dimensionFields.length > 0 && dimensionFields[0] !== '_default';

    // If dimension is selected, group data by dimension and sum values
    if (hasDimension) {
      console.log('📊 Compare mode WITH dimension grouping:', dimensionFields[0]);
      
      // Group submissions by dimension value and sum both metrics
      const groupedData: { [key: string]: { x: number; y: number; count: number } } = {};
      
      submissions
        .filter(submission => passesFilters(submission.submission_data))
        .forEach(submission => {
          const submissionData = submission.submission_data;
          const dimensionKey = getDimensionKey(submissionData, dimensionFields);
          const xValue = getRawMetricValue(submissionData, metricField1);
          const yValue = getRawMetricValue(submissionData, metricField2);
          
          if (!groupedData[dimensionKey]) {
            groupedData[dimensionKey] = { x: 0, y: 0, count: 0 };
          }
          
          groupedData[dimensionKey].x += xValue;
          groupedData[dimensionKey].y += yValue;
          groupedData[dimensionKey].count += 1;
        });
      
      // Convert to array format
      const points = Object.entries(groupedData).map(([name, values]) => ({
        name,
        x: values.x,
        y: values.y,
        xFieldName: field1Name,
        yFieldName: field2Name,
      }));
      
      console.log('📊 Compare grouped data:', points);
      return points;
    }

    // No dimension - each submission becomes a point with raw values for table display
    const points = submissions
      .filter(submission => passesFilters(submission.submission_data))
      .map((submission, index) => {
        const submissionData = submission.submission_data;
        const xValue = getRawMetricValue(submissionData, metricField1);
        const yValue = getRawMetricValue(submissionData, metricField2);
        // Store raw display values for table view
        const xRawValue = getRawDisplayValue(submissionData, metricField1);
        const yRawValue = getRawDisplayValue(submissionData, metricField2);

        return {
          x: xValue,
          y: yValue,
          xRaw: xRawValue,
          yRaw: yRawValue,
          // Use Field 1's text value as the X-axis label (name), fallback to Record N if empty
          name: xRawValue || `Record ${index + 1}`,
          submissionId: submission.id, // Store submission ID for direct navigation
          // Store field names for tooltip
          xFieldName: field1Name,
          yFieldName: field2Name,
        };
      });

    console.log('📊 Compare scatter data:', points);
    return points;
  };
  
  const processGroupedData = (submissions: any[], dimensionFields: string[], metricFields: string[], groupByField: string) => {
    console.log('🔍 Processing grouped data with groupBy:', groupByField);
    
    // Get effective aggregation from metricAggregations or config
    const effectiveAggregation = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
    
    // Structure: { dimensionValue: { groupValue: number[] } } - collect raw values first
    const rawGroupedData: { [dimensionKey: string]: { [groupKey: string]: number[] } } = {};
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
      if (!rawGroupedData[dimensionKey]) {
        rawGroupedData[dimensionKey] = {};
      }
      if (!rawGroupedData[dimensionKey][groupValue]) {
        rawGroupedData[dimensionKey][groupValue] = [];
      }
      
      // Collect raw metric values
      metricFields.forEach(metric => {
        const metricValue = getRawMetricValue(submissionData, metric);
        rawGroupedData[dimensionKey][groupValue].push(metricValue);
      });
    });
    
    // Apply aggregation and convert to chart-friendly format
    const result: any[] = [];
    Object.entries(rawGroupedData).forEach(([dimensionValue, groups]) => {
      const dataPoint: any = { name: dimensionValue };
      
      // Add each group value as a separate property with aggregated value
      allGroupValues.forEach(groupValue => {
        const values = groups[groupValue] || [];
        dataPoint[groupValue] = applyAggregation(values, effectiveAggregation);
      });
      
      result.push(dataPoint);
    });
    
    console.log('🔍 Grouped data result:', result);
    console.log('🔍 All group values:', Array.from(allGroupValues));
    console.log('🔍 Applied aggregation:', effectiveAggregation);
    
    return result;
  };
  const processSingleDimensionalData = (submissions: any[], dimensionFields: string[], metricFields: string[]) => {
    // Get effective aggregation from metricAggregations or config
    const effectiveAggregation = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
    
    // First pass: collect all raw values per dimension key
    const rawData: {
      [key: string]: {
        name: string;
        values: number[];
        metricValues: { [metric: string]: number[] };
      };
    } = {};
    
    submissions.forEach(submission => {
      const submissionData = submission.submission_data;

      // Apply filters
      if (!passesFilters(submissionData)) return;
      const dimensionKey = getDimensionKey(submissionData, dimensionFields);
      if (!rawData[dimensionKey]) {
        rawData[dimensionKey] = {
          name: dimensionKey,
          values: [],
          metricValues: {}
        };
        metricFields.forEach(metric => {
          rawData[dimensionKey].metricValues[metric] = [];
        });
      }

      // Collect raw metric values
      metricFields.forEach(metric => {
        const metricValue = getRawMetricValue(submissionData, metric);
        rawData[dimensionKey].metricValues[metric].push(metricValue);
        rawData[dimensionKey].values.push(metricValue);
      });
    });
    
    // Second pass: apply aggregation function to collected values
    const processedData = Object.values(rawData).map(item => {
      const result: any = { name: item.name };
      
      // Apply aggregation to each metric
      Object.entries(item.metricValues).forEach(([metric, values]) => {
        result[metric] = applyAggregation(values, effectiveAggregation);
      });
      
      // Apply aggregation to combined values for 'value' field
      result.value = applyAggregation(item.values, effectiveAggregation);
      
      return result;
    });
    
    return processedData;
  };
  
  // Get raw numeric value from submission data (without aggregation logic)
  const getRawMetricValue = (submissionData: any, metric: string): number => {
    if (metric === 'count') {
      return 1;
    }
    const value = submissionData[metric] || submissionData[config.yAxis];
    if (typeof value === 'object' && value !== null) {
      if (value.status) {
        return value.status === 'approved' ? 1 : 0;
      }
      if (value.amount !== undefined) {
        const numValue = Number(value.amount);
        return isNaN(numValue) ? 0 : numValue;
      }
      return 1;
    } else if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    } else if (value) {
      const numValue = Number(value);
      return isNaN(numValue) ? 1 : numValue;
    }
    return 0;
  };
  
  // Apply aggregation function to an array of values
  const applyAggregation = (values: number[], aggregationType: string): number => {
    if (values.length === 0) return 0;
    
    switch (aggregationType) {
      case 'count':
        return values.length;
      case 'sum':
        return values.reduce((acc, val) => acc + val, 0);
      case 'avg':
        return values.reduce((acc, val) => acc + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'median': {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
      default:
        return values.reduce((acc, val) => acc + val, 0);
    }
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
    
    // Use expression-based evaluation if manual logic is enabled
    if (config.useManualFilterLogic && config.filterLogicExpression && (config.filters?.length || 0) > 1) {
      // Only apply expression to config filters, drilldown filters always use AND
      const configResult = evaluateSubmissionFilters(
        submissionData,
        config.filters || [],
        true,
        config.filterLogicExpression
      );
      // Drilldown filters must all pass (AND)
      const drilldownResult = drilldownFilters.length === 0 || drilldownFilters.every(filter => {
        const value = submissionData[filter.field];
        return evaluateFilterCondition(value, filter.operator, filter.value);
      });
      return configResult && drilldownResult;
    }
    
    // Default: AND logic for all filters
    return allFilters?.every(filter => {
      const value = submissionData[filter.field];
      return evaluateFilterCondition(value, filter.operator, filter.value);
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
  const handleBarClick = (data: any, index: number, event?: any) => {
    // Open dialog to show matching submissions
    // recharts passes the data point in data.payload or data directly
    const payload = data?.payload || data;
    const dimensionValue = payload?.name || data?.name;
    
    if (dimensionValue) {
      const dimensionField = config.dimensions?.[0] || config.xAxis || '';
      const dimensionLabel = dimensionField ? getFormFieldName(dimensionField) : 'Category';
      
      console.log('Bar clicked:', { dimensionField, dimensionValue, dimensionLabel, data, payload });
      
      setCellSubmissionsDialog({
        open: true,
        dimensionField,
        dimensionValue,
        dimensionLabel,
      });
    }
  };
  const handleChartClick = (data: any, event?: any) => {
    // This will be handled by the drilldown controls instead of direct click
    console.log('Chart clicked, use drilldown controls instead');
  };
  // Generate chart info summary for context
  const getChartInfoSummary = (): { 
    title: string; 
    formName: string;
    dimensionName: string | null;
    metricName: string;
    aggregation: string;
    groupByName: string | null;
    chartType: string;
  } => {
    const formName = config.formId ? getFormName(config.formId) : 'Form';
    const dimensionField = config.dimensions?.[0] || config.xAxis;
    const dimensionName = dimensionField ? getFormFieldName(dimensionField) : null;

    const metricField = config.metrics?.[0];
    const metricName = metricField ? getFormFieldName(metricField) : 'Records';

    // In compare mode, show "Compare" as aggregation type instead of count
    const isCompareMode = config.compareMode && config.metrics && config.metrics.length === 2;
    const aggregation = isCompareMode ? 'compare' : (config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count');
    const groupByName = config.groupByField ? getFormFieldName(config.groupByField) : null;
    const chartType = config.type || config.chartType || 'bar';
    
    let title = '';

    if (config.compareMode && config.metrics && config.metrics.length === 2) {
      const compareField1 = getFormFieldName(config.metrics[0]);
      const compareField2 = getFormFieldName(config.metrics[1]);
      title = dimensionName
        ? `Compare ${compareField1} vs ${compareField2} by ${dimensionName}`
        : `Compare ${compareField1} vs ${compareField2}`;
    } else if (aggregation === 'count') {
      title = dimensionName ? `Count of Records by ${dimensionName}` : 'Count of Records';
    } else {
      const aggLabel = aggregation.charAt(0).toUpperCase() + aggregation.slice(1);
      title = dimensionName 
        ? `${aggLabel} of ${metricName} by ${dimensionName}` 
        : `${aggLabel} of ${metricName}`;
    }
    
    return { title, formName, dimensionName, metricName, aggregation, groupByName, chartType };
  };

  // Generate enhanced tooltip content
  const getEnhancedTooltipContent = (payload: any, label: string): React.ReactNode => {
    if (!payload || payload.length === 0) return null;
    
    const formName = config.formId ? getFormName(config.formId) : 'Form';
    const dimensionField = config.dimensions?.[0] || config.xAxis;
    const dimensionName = dimensionField ? getFormFieldName(dimensionField) : 'Category';

    // In compare mode, we treat values as raw field values (no aggregation)
    const aggregation = config.compareMode
      ? 'value'
      : config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';

    const aggLabel = aggregation === 'count'
      ? 'Count'
      : aggregation === 'value'
        ? 'Value'
        : aggregation.charAt(0).toUpperCase() + aggregation.slice(1);
    
    return (
      <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[200px]">
        <div className="text-xs text-muted-foreground mb-2">
          {formName}
        </div>
        <div className="space-y-2">
          {payload.map((entry: any, idx: number) => {
            const metricName = entry.name || entry.dataKey;

            // For compare mode, the series name IS the display name already
            const fieldDisplayName = config.compareMode
              ? metricName
              : (typeof metricName === 'string' && metricName !== 'value' 
                  ? getFormFieldName(metricName) 
                  : dimensionName);

            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: entry.color || entry.fill }} 
                  />
                  <span className="text-sm text-muted-foreground">Field: <span className="text-foreground">{fieldDisplayName}</span></span>
                </div>
                <div className="pl-5 text-sm">
                  {aggLabel}: <span className="font-semibold">{entry.value}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {dimensionName}: {label}
        </div>
        <div className="text-[11px] text-muted-foreground mt-2 pt-1 border-t border-border">
          Click bar to view records
        </div>
      </div>
    );
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
    // Preserve string values for display fields (xRaw, yRaw, field names, IDs)
    const preserveAsStringKeys = ['name', '_drilldownData', 'xRaw', 'yRaw', 'xFieldName', 'yFieldName', 'submissionId'];
    const sanitizedChartData = chartData.map(item => {
      const sanitized: any = { name: item.name || 'Unknown' };
      Object.keys(item).forEach(key => {
        if (preserveAsStringKeys.includes(key)) {
          sanitized[key] = item[key];
        } else {
          const val = Number(item[key]);
          sanitized[key] = isNaN(val) || !isFinite(val) ? 0 : val;
        }
      });
      return sanitized;
    });

    // Calculate safe domain for Y axis to prevent NaN errors - use 0.5 increments
    const getYAxisDomain = (data: any[], metricKey: string): [number, number] => {
      if (!data || data.length === 0) return [0, 5]; // Safe default with nice 0.5 range
      const values = data.map(item => {
        const val = Number(item[metricKey]);
        return isNaN(val) || !isFinite(val) ? 0 : val;
      }).filter(v => isFinite(v));
      if (values.length === 0) return [0, 5]; // Safe default
      const maxVal = Math.max(...values, 0);
      const minVal = Math.min(...values, 0);
      // Return safe default if all values are 0 or invalid
      if (!isFinite(maxVal) || (maxVal === 0 && minVal === 0)) return [0, 5];
      // Round max up to next 0.5 increment for clean ticks
      const safeMax = Math.ceil((maxVal * 1.1) * 2) / 2;
      const safeMin = Math.floor(Math.min(0, minVal) * 2) / 2;
      return [safeMin, Math.max(safeMax, 0.5)];
    };
    
    // Calculate Y-axis ticks with 0.5 increments
    const getYAxisTicks = (data: any[], metricKey: string): number[] => {
      const [min, max] = getYAxisDomain(data, metricKey);
      const ticks: number[] = [];
      for (let i = min; i <= max; i += 0.5) {
        ticks.push(Math.round(i * 10) / 10); // Avoid floating point precision issues
      }
      return ticks;
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

    // Get all dimension-based data keys (for multi-dimensional charts OR grouped charts OR compare mode)
    let dimensionKeys = sanitizedChartData.length > 0 ? Object.keys(sanitizedChartData[0]).filter(key => key !== 'name' && key !== '_drilldownData' && key !== 'x' && key !== 'y' && key !== 'xFieldName' && key !== 'yFieldName' && typeof sanitizedChartData[0][key] === 'number') : [];
    const isCompareMode = config.compareMode && config.metrics && config.metrics.length === 2;
    const isMultiDimensional = (config.dimensions && config.dimensions.length > 1) || (config.groupByField && dimensionKeys.length > 1);
    
    console.log('📊 Chart rendering - dimensionKeys:', dimensionKeys);
    console.log('📊 Chart rendering - isMultiDimensional:', isMultiDimensional);
    console.log('📊 Chart rendering - groupByField:', config.groupByField);
    console.log('📊 Chart rendering - compareMode:', isCompareMode);

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

    // Compare mode: render with X/Y axis format using selected chart type
    if (isCompareMode) {
      const field1Name = config.metrics ? getFormFieldName(config.metrics[0]) : 'Field 1';
      const field2Name = config.metrics ? getFormFieldName(config.metrics[1]) : 'Field 2';

      // Calculate safe domains for X and Y axes
      const xValues = sanitizedChartData.map(d => Number(d.x)).filter(v => isFinite(v));
      const yValues = sanitizedChartData.map(d => Number(d.y)).filter(v => isFinite(v));
      const xMax = xValues.length > 0 ? Math.max(...xValues) : 10;
      const yMax = yValues.length > 0 ? Math.max(...yValues) : 10;
      const xDomain: [number, number] = [0, Math.ceil(xMax * 1.1) || 10];
      const yDomain: [number, number] = [0, Math.ceil(yMax * 1.1) || 10];

      // Sort data by x value for line/area charts
      const sortedData = [...sanitizedChartData].sort((a, b) => (a.x || 0) - (b.x || 0));

      const compareTooltip = (
        <Tooltip 
          content={({ payload }) => {
            if (!payload || payload.length === 0) return null;
            const data = payload[0]?.payload;
            if (!data) return null;
            return (
              <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                <div className="font-medium mb-2">{data.name}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{data.xFieldName || field1Name}:</span>
                    <span className="font-semibold">{data.x}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{data.yFieldName || field2Name}:</span>
                    <span className="font-semibold">{data.y}</span>
                  </div>
                </div>
              </div>
            );
          }}
        />
      );

      // Render based on selected chart type
      if (chartType === 'line') {
        return (
          <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={sortedData} margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    tick={{ fontSize: 11 }}
                    domain={xDomain}
                    label={{ value: field1Name, position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    tick={{ fontSize: 11 }}
                    domain={yDomain}
                    label={{ value: field2Name, angle: -90, position: 'insideLeft' }}
                  />
                  {compareTooltip}
                  <Line type="monotone" dataKey="y" stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0], r: 4 }} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      if (chartType === 'area') {
        return (
          <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsAreaChart data={sortedData} margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    tick={{ fontSize: 11 }}
                    domain={xDomain}
                    label={{ value: field1Name, position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    tick={{ fontSize: 11 }}
                    domain={yDomain}
                    label={{ value: field2Name, angle: -90, position: 'insideLeft' }}
                  />
                  {compareTooltip}
                  <Area type="monotone" dataKey="y" stroke={colors[0]} fill={colors[0]} fillOpacity={0.3} />
                </RechartsAreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      if (chartType === 'bar') {
        // Bar chart = vertical bars in compare mode (X-axis field on horizontal, Y-axis field determines height)
        const barData = sortedData.map((item, idx) => ({
          ...item,
          xLabel: item.xRaw || item.name || String(item.x), // Use text value from Field 1 for X-axis label
        }));

        return (
          <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 60, bottom: 80 }}>
                  <XAxis 
                    dataKey="xLabel" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    label={{ value: field1Name, position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    domain={yDomain}
                    label={{ value: field2Name, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      return (
                        <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                          <div className="font-medium mb-2">{data.name}</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{field1Name}:</span>
                              <span className="font-semibold">{data.x}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{field2Name}:</span>
                              <span className="font-semibold">{data.y}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    dataKey="y" 
                    name={field2Name} 
                    style={{ cursor: 'pointer' }}
                    onClick={(data, idx) => {
                      const payload = data?.payload || data;
                      const name = payload?.name || payload?.xLabel || `Record ${idx + 1}`;
                      const submissionId = payload?.submissionId;
                      
                      if (submissionId) {
                        // If we have a direct submission ID, open dialog with that
                        setCellSubmissionsDialog({
                          open: true,
                          dimensionField: config.metrics?.[0] || '',
                          dimensionValue: name,
                          dimensionLabel: field1Name,
                        });
                      } else {
                        // Open dialog to show matching record
                        setCellSubmissionsDialog({
                          open: true,
                          dimensionField: config.metrics?.[0] || '',
                          dimensionValue: name,
                          dimensionLabel: field1Name,
                        });
                      }
                    }}
                    activeBar={{ fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                  >
                    {barData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={colors[index % colors.length]} 
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2">
              Click a bar to view the record
            </div>
          </div>
        );
      }

      if (chartType === 'column') {
        // Column chart = vertical bars in compare mode
        const barData = sortedData.map((item, idx) => ({
          ...item,
          xLabel: item.xRaw || item.name || String(item.x), // Use text value from Field 1 for X-axis label
        }));

        return (
          <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 60, bottom: 80 }}>
                  <XAxis 
                    dataKey="xLabel" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    label={{ value: field1Name, position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    domain={yDomain}
                    label={{ value: field2Name, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      return (
                        <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                          <div className="font-medium mb-2">{data.name}</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{field1Name} (X):</span>
                              <span className="font-semibold">{data.x}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{field2Name} (Y):</span>
                              <span className="font-semibold">{data.y}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    dataKey="y" 
                    name={field2Name} 
                    style={{ cursor: 'pointer' }}
                    onClick={(data, idx) => {
                      const payload = data?.payload || data;
                      const name = payload?.name || payload?.xLabel || `Record ${idx + 1}`;
                      
                      setCellSubmissionsDialog({
                        open: true,
                        dimensionField: config.metrics?.[0] || '',
                        dimensionValue: name,
                        dimensionLabel: field1Name,
                      });
                    }}
                    activeBar={{ fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                  >
                    {barData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={colors[index % colors.length]} 
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2">
              Click a bar to view the record
            </div>
          </div>
        );
      }

      // Default to scatter for other chart types in compare mode
      return (
        <div className="relative w-full h-full min-h-[300px]">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsScatterChart margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name={field1Name}
                  tick={{ fontSize: 11 }}
                  domain={xDomain}
                  label={{ value: field1Name, position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name={field2Name}
                  tick={{ fontSize: 11 }}
                  domain={yDomain}
                  label={{ value: field2Name, angle: -90, position: 'insideLeft' }}
                />
                {compareTooltip}
                <Scatter 
                  data={sanitizedChartData} 
                  fill={colors[0]}
                  shape="circle"
                />
              </RechartsScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
    switch (chartType) {
      case 'bar':
        // Bar chart = vertical bars (categories on X-axis, values on Y-axis)
        return <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sanitizedChartData} margin={{
                top: 20,
                right: 30,
                left: 60,
                bottom: 80
              }}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    label={{
                      value: config.xAxisLabel || 'Category',
                      position: 'insideBottom',
                      offset: -5
                    }} 
                  />
                  <YAxis 
                    type="number" 
                    tick={{ fontSize: 11 }}
                    domain={getYAxisDomain(sanitizedChartData, primaryMetric)} 
                    ticks={getYAxisTicks(sanitizedChartData, primaryMetric)} 
                    allowDataOverflow={false}
                    label={{
                      value: config.yAxisLabel || getFormFieldName(primaryMetric),
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10
                    }} 
                  />
                   <Tooltip 
                    content={({ payload, label }) => getEnhancedTooltipContent(payload, label)}
                    contentStyle={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px',
                      padding: 0,
                    }} 
                  />
                   
                   {isMultiDimensional ?
                // Render separate bars for each dimension value
                dimensionKeys.map((key, index) => {
                  const barColor = colors[index % colors.length];
                  return (
                    <Bar 
                      key={key} 
                      dataKey={key} 
                      fill={barColor} 
                      name={key} 
                      style={{ cursor: 'pointer' }} 
                      onClick={(data, idx) => handleBarClick(data, idx)}
                      activeBar={{ fill: barColor, fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                    />
                  );
                }) :
                // Single dimension - render primary metric with multi-colored bars
                <>
                  <Bar 
                    dataKey={primaryMetric} 
                    name={getFormFieldName(primaryMetric)} 
                    style={{ cursor: 'pointer' }} 
                    onClick={(data, idx) => handleBarClick(data, idx)}
                    activeBar={{ fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                  >
                    {sanitizedChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={colors[index % colors.length]} 
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Bar>
                  {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, metricIndex) => (
                    <Bar 
                      key={metric} 
                      dataKey={metric} 
                      name={getFormFieldName(metric)} 
                      style={{ cursor: 'pointer' }} 
                      onClick={(data, idx) => handleBarClick(data, idx)}
                      activeBar={{ fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                    >
                      {sanitizedChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${metric}-${index}`} 
                          fill={colors[(index + metricIndex + 1) % colors.length]} 
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Bar>
                  ))}
                </>}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'column':
        return <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
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
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} ticks={getYAxisTicks(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                  <Tooltip 
                    content={({ payload, label }) => getEnhancedTooltipContent(payload, label)}
                    contentStyle={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px',
                      padding: 0,
                    }} 
                  />
                   
                   {isMultiDimensional ?
                // Render separate bars for each dimension value
                dimensionKeys.map((key, index) => {
                  const barColor = colors[index % colors.length];
                  return (
                    <Bar 
                      key={key} 
                      dataKey={key} 
                      fill={barColor} 
                      name={key} 
                      style={{ cursor: 'pointer' }} 
                      onClick={(data, idx) => handleBarClick(data, idx)}
                      activeBar={{ fill: barColor, fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                    />
                  );
                }) :
                // Single dimension - render primary metric with multi-colored bars
                <>
                  <Bar 
                    dataKey={primaryMetric} 
                    name={getFormFieldName(primaryMetric)} 
                    style={{ cursor: 'pointer' }} 
                    onClick={(data, idx) => handleBarClick(data, idx)}
                    activeBar={{ fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                  >
                    {sanitizedChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={colors[index % colors.length]} 
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Bar>
                  {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, metricIndex) => (
                    <Bar 
                      key={metric} 
                      dataKey={metric} 
                      name={getFormFieldName(metric)} 
                      style={{ cursor: 'pointer' }} 
                      onClick={(data, idx) => handleBarClick(data, idx)}
                      activeBar={{ fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                    >
                      {sanitizedChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${metric}-${index}`} 
                          fill={colors[(index + metricIndex + 1) % colors.length]} 
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Bar>
                  ))}
                </>}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'pie':
        return <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
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
                   
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'donut':
        return <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
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
                   
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'line':
        return <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
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
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} ticks={getYAxisTicks(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                  <Tooltip formatter={(value, name, props) => {
                  const displayName = isMultiDimensional ? name : getFormFieldName(name.toString());
                  return [`${displayName}: ${value}`, `Category: ${props.payload?.name || 'N/A'}`];
                }} labelFormatter={label => `Category: ${label}`} contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }} />
                   
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
        return <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
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
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} ticks={getYAxisTicks(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                  <Tooltip formatter={(value, name, props) => {
                  const displayName = getFormFieldName(name.toString());
                  return [`${displayName}: ${value}`, `Category: ${props.payload?.name || 'N/A'}`];
                }} labelFormatter={label => `Category: ${label}`} contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }} />
                   
                   <Area type="monotone" dataKey={primaryMetric} stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} name={getFormFieldName(primaryMetric)} />
                   {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => <Area key={metric} type="monotone" dataKey={metric} stroke={colors[(index + 1) % colors.length]} fill={colors[(index + 1) % colors.length]} fillOpacity={0.6} name={getFormFieldName(metric)} />)}
                </RechartsAreaChart>
              </ResponsiveContainer>
            </div>
          </div>;
      case 'scatter':
        return <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
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
        return <div className="relative w-full h-full min-h-[300px]">
            <div className="absolute inset-0">
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
  const chartInfo = getChartInfoSummary();
  
  return <div className="h-full flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
      {/* Chart Info Header - Always visible for context */}
      <div className="mb-4 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <h4 className="font-semibold text-lg text-foreground">{config.title || chartInfo.title}</h4>
          {canDrillUp && <Button variant="outline" size="sm" onClick={() => {
            if (onDrilldown && drilldownState?.values) {
              const newValues = [...drilldownState.values];
              newValues.pop();
              const lastLevel = config.drilldownConfig?.drilldownLevels?.[newValues.length - 1] || '';
              const lastValue = newValues[newValues.length - 1] || '';
              onDrilldown(lastLevel, lastValue);
            }
          }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>}
        </div>
        
        {/* Info Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Type Badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {chartInfo.chartType.charAt(0).toUpperCase() + chartInfo.chartType.slice(1)} Chart
          </span>
          
          {/* Aggregation Badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {chartInfo.aggregation === 'compare' ? (
              <>Compare: {config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'Field 1'} - {config.metrics?.[1] ? getFormFieldName(config.metrics[1]) : 'Field 2'}</>
            ) : chartInfo.aggregation === 'count' ? 'Count' : (
              <>{chartInfo.aggregation.charAt(0).toUpperCase() + chartInfo.aggregation.slice(1)}: {config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'Records'}</>
            )}
          </span>
          
          {/* Form Badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Form: {config.formId ? getFormName(config.formId) : 'Form'}
          </span>
          
          {/* Dimension Badge */}
          {(config.dimensions?.[0] || config.xAxis) && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Grouped by: {getFormFieldName(config.dimensions?.[0] || config.xAxis || '')}
            </span>
          )}
          
          {/* Segmented By Badge */}
          {config.groupByField && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              Segmented by: {getFormFieldName(config.groupByField)}
            </span>
          )}
        </div>
        
        {/* Drilldown Active Filter */}
        {drilldownState?.values && drilldownState.values.length > 0 && <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 mt-3">
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
      </div>
        
      {/* Chart Controls */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mb-4">
        
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
      </div>
          
      {config.drilldownConfig?.enabled && showDrilldownPanel && <div className="mb-4 p-3 bg-muted/30 rounded-lg border flex-shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Drilldown Controls</span>
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
          
      {config.drilldownConfig?.enabled && !showDrilldownPanel && <div className="flex items-center gap-2 flex-shrink-0 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
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

      {/* Chart Container - Fills available space */}
      <div className="flex-grow min-h-[300px]">
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
                          {getFormFieldName(key)}
                        </th>
                      ));
                    }
                    
                    // Check for compare mode
                    const isCompareMode = config.compareMode && config.metrics?.length === 2;
                    
                    if (isCompareMode) {
                      // Compare mode: always use getFormFieldName for reliable name resolution
                      const field1Name = getFormFieldName(config.metrics[0]);
                      const field2Name = getFormFieldName(config.metrics[1]);
                      return (
                        <>
                          <th className="border border-border p-2 bg-muted text-left font-semibold">
                            {field1Name}
                          </th>
                          <th className="border border-border p-2 bg-muted text-left font-semibold">
                            {field2Name}
                          </th>
                        </>
                      );
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
                        // Handle different data structures based on mode
                        const isCompareMode = config.compareMode && config.metrics?.length === 2;
                        
                        if (isCompareMode) {
                          // Compare mode: show raw values if available, else numeric values
                          const displayX = item.xRaw !== undefined && item.xRaw !== '' ? item.xRaw : (typeof item.x === 'number' ? item.x.toLocaleString() : (item.x ?? ''));
                          const displayY = item.yRaw !== undefined && item.yRaw !== '' ? item.yRaw : (typeof item.y === 'number' ? item.y.toLocaleString() : (item.y ?? ''));
                          
                          // If we have a direct submission ID, navigate directly; otherwise show dialog
                          const handleCellClick = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (item.submissionId) {
                              navigate(`/submission/${item.submissionId}`);
                            } else {
                              setCellSubmissionsDialog({
                                open: true,
                                dimensionField,
                                dimensionValue: item.name,
                                dimensionLabel,
                              });
                            }
                          };
                          
                          return (
                            <>
                              <td 
                                key="field1" 
                                className="border border-border p-2 cursor-pointer hover:bg-primary/10"
                                onClick={handleCellClick}
                              >
                                {displayX || '-'}
                              </td>
                              <td 
                                key="field2" 
                                className="border border-border p-2 cursor-pointer hover:bg-primary/10"
                                onClick={handleCellClick}
                              >
                                {displayY || '-'}
                              </td>
                            </>
                          );
                        }
                        
                        // Non-compare mode: count or calculate values
                        const metrics = config.metrics && config.metrics.length > 0 
                          ? config.metrics 
                          : config.yAxis 
                          ? [config.yAxis]
                          : ['count'];
                        
                        return metrics.map(metric => {
                          // Get the value - check multiple possible keys
                          let displayValue: number | string = 0;
                          
                          if (metric === 'count') {
                            // Count mode - value is in count or value property
                            displayValue = item.count ?? item.value ?? 0;
                          } else if (item[metric] !== undefined) {
                            // Field ID exists as key (Calculate mode with proper structure)
                            displayValue = item[metric];
                          } else {
                            // Fallback to value property (aggregated result)
                            displayValue = item.value ?? 0;
                          }
                          
                          return (
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
                              {typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full h-full min-h-[300px]">
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