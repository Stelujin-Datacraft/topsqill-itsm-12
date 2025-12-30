import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Edit, ArrowLeft, ChevronRight, Filter, RotateCcw, Layers, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, PieChart as RechartsPieChart, Pie, Cell, LineChart as RechartsLineChart, Line, AreaChart as RechartsAreaChart, Area, ScatterChart as RechartsScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, FunnelChart, Funnel, Treemap, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useReports } from '@/hooks/useReports';
import { useFormsData } from '@/hooks/useFormsData';
import { ChartConfig } from '@/types/reports';
import { colorSchemes } from './ChartColorThemes';
import { TableCellSubmissionsDialog } from './TableCellSubmissionsDialog';
import { HeatmapCell } from './HeatmapCell';
import { evaluateFilterCondition, evaluateSubmissionFilters } from '@/utils/filterUtils';
import { ChartExportButton } from './ChartExportButton';
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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormFields, setShowFormFields] = useState(false);
  
  const [showDrilldownPanel, setShowDrilldownPanel] = useState(false);
  
  // Drilldown mode toggle: when ON, clicking chart performs drilldown; when OFF, shows records
  const [isDrilldownModeActive, setIsDrilldownModeActive] = useState(true);
  
  const [cellSubmissionsDialog, setCellSubmissionsDialog] = useState<{
    open: boolean;
    dimensionField: string;
    dimensionValue: string;
    groupField?: string;
    groupValue?: string;
    dimensionLabel?: string;
    groupLabel?: string;
    submissionId?: string;
    // Cross-reference drilldown support
    crossRefTargetFormId?: string;
    crossRefDisplayFields?: string[];
    crossRefLinkedIds?: string[];
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
          }
        } catch (error) {
          console.error('ChartPreview: Error fetching fields directly:', error);
        }
      }
    };
    fetchFieldsDirectly();
  }, [config.formId, currentForm?.fields, getFormFields]);

  // Memoized lookup maps for form and field names (performance optimization)
  const formNameCache = useMemo(() => {
    const cache = new Map<string, string>();
    forms.forEach(f => cache.set(f.id, f.name));
    return cache;
  }, [forms]);

  const fieldNameCache = useMemo(() => {
    const cache = new Map<string, string>();
    // Add fields from current form
    formFields.forEach(f => cache.set(f.id, f.label || f.id));
    // Add fields from all forms
    forms.forEach(form => {
      form.fields?.forEach((f: any) => {
        if (!cache.has(f.id)) {
          cache.set(f.id, f.label || f.id);
        }
      });
    });
    return cache;
  }, [formFields, forms]);

  // Helper functions to get form and field names with caching
  const getFormName = (formId: string): string => {
    return formNameCache.get(formId) || formId;
  };

  const getFormFieldName = (fieldId: string): string => {
    // Handle prefixed field IDs from joined forms (e.g., "[FormName].fieldId")
    const prefixMatch = fieldId.match(/^\[(.+?)\]\.(.+)$/);
    if (prefixMatch) {
      const [, formName, originalFieldId] = prefixMatch;
      const fieldLabel = fieldNameCache.get(originalFieldId) || originalFieldId;
      return `${formName}: ${fieldLabel}`;
    }
    
    return fieldNameCache.get(fieldId) || fieldId;
  };

  const getFieldName = (fieldId: string): string => {
    return getFormFieldName(fieldId);
  };

  // Apply join to chart data - merges data from secondary form
  // Helper to normalize join values for comparison - handles all field types
  const normalizeJoinValue = (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null;
    
    // Handle arrays - extract first element or join
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      // For single-element arrays, use the element directly
      if (value.length === 1) {
        return normalizeJoinValue(value[0]);
      }
      // For multi-element, create a sorted string for consistent comparison
      return value.map(v => normalizeJoinValue(v)).filter(Boolean).sort().join('|');
    }
    
    // Handle objects (like submission-access, cross-reference, address, etc.)
    if (typeof value === 'object') {
      // Check for common patterns in order of likelihood
      if (value.value !== undefined) return normalizeJoinValue(value.value);
      if (value.label !== undefined) return normalizeJoinValue(value.label);
      if (value.id !== undefined) return normalizeJoinValue(value.id);
      if (value.name !== undefined) return normalizeJoinValue(value.name);
      if (value.email !== undefined) return normalizeJoinValue(value.email);
      if (value.submission_ref_id !== undefined) return normalizeJoinValue(value.submission_ref_id);
      
      // For other objects, stringify
      try {
        return JSON.stringify(value).toLowerCase().trim();
      } catch {
        return String(value).toLowerCase().trim();
      }
    }
    
    // Handle numbers - convert to string for comparison
    if (typeof value === 'number') {
      return String(value);
    }
    
    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    
    // Handle dates
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    return String(value).toLowerCase().trim();
  };

  // Check if two normalized values match
  const valuesMatch = (val1: string | null, val2: string | null): boolean => {
    if (val1 === null || val2 === null) return false;
    if (val1 === val2) return true;
    
    // Try partial matching for complex values (multi-select, arrays)
    if (val1.includes('|') || val2.includes('|')) {
      const parts1 = val1.split('|');
      const parts2 = val2.split('|');
      // Check if any part matches
      return parts1.some(p1 => parts2.some(p2 => p1 === p2));
    }
    
    return false;
  };

  // Extract field value with multiple fallback strategies
  const extractJoinFieldValue = (submissionData: Record<string, any>, fieldId: string): any => {
    if (!submissionData || !fieldId) return undefined;
    
    // Direct lookup
    if (submissionData[fieldId] !== undefined) {
      return submissionData[fieldId];
    }
    
    // Try without any prefix (in case fieldId has a prefix)
    if (fieldId.includes('.')) {
      const rawFieldId = fieldId.split('.').pop();
      if (rawFieldId && submissionData[rawFieldId] !== undefined) {
        return submissionData[rawFieldId];
      }
    }
    
    // Try to find by partial match (for cases where keys might have prefixes)
    const keys = Object.keys(submissionData);
    const matchingKey = keys.find(k => k === fieldId || k.endsWith(`.${fieldId}`) || fieldId.endsWith(`.${k}`));
    if (matchingKey) {
      return submissionData[matchingKey];
    }
    
    return undefined;
  };

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

      // Helper to find matching secondary row with normalized comparison
      const findMatchingSecondary = (primaryRow: any) => {
        const primaryValueRaw = extractJoinFieldValue(primaryRow.submission_data, primaryFieldId);
        const primaryValue = normalizeJoinValue(primaryValueRaw);
        
        return secondaryData.find(secondaryRow => {
          const submissionData = (typeof secondaryRow.submission_data === 'object' && secondaryRow.submission_data !== null) 
            ? secondaryRow.submission_data as Record<string, any> 
            : {};
          const secondaryValueRaw = extractJoinFieldValue(submissionData, secondaryFieldId);
          const secondaryValue = normalizeJoinValue(secondaryValueRaw);
          return valuesMatch(primaryValue, secondaryValue);
        });
      };

      // Helper to find matching primary row with normalized comparison
      const findMatchingPrimary = (secondaryRow: any) => {
        const submissionData = (typeof secondaryRow.submission_data === 'object' && secondaryRow.submission_data !== null) 
          ? secondaryRow.submission_data as Record<string, any> 
          : {};
        const secondaryValueRaw = extractJoinFieldValue(submissionData, secondaryFieldId);
        const secondaryValue = normalizeJoinValue(secondaryValueRaw);
        
        return primaryData.find(primaryRow => {
          const primaryValueRaw = extractJoinFieldValue(primaryRow.submission_data, primaryFieldId);
          const primaryValue = normalizeJoinValue(primaryValueRaw);
          return valuesMatch(primaryValue, secondaryValue);
        });
      };

      console.log(`📊 Applying ${joinType} join between ${primaryFieldId} and ${secondaryFieldId}`);

      switch (joinType) {
        case 'inner':
          // Only return records that have matches in BOTH forms
          const innerResult = primaryData
            .map(primaryRow => {
              const matchingSecondary = findMatchingSecondary(primaryRow);
              if (matchingSecondary) {
                return mergeRows(primaryRow, matchingSecondary);
              }
              return null;
            })
            .filter((row): row is any => row !== null);
          console.log(`📊 Inner join: ${primaryData.length} primary + ${secondaryData.length} secondary = ${innerResult.length} matched`);
          return innerResult;

        case 'left':
          // Return ALL primary records, with secondary data where matches exist
          const leftResult = primaryData.map(primaryRow => {
            const matchingSecondary = findMatchingSecondary(primaryRow);
            if (matchingSecondary) {
              return mergeRows(primaryRow, matchingSecondary);
            }
            return primaryRow;
          });
          console.log(`📊 Left join: ${primaryData.length} primary records (all kept)`);
          return leftResult;

        case 'right':
          // Return ALL secondary records, with primary data where matches exist
          const rightResult: any[] = [];
          secondaryData.forEach(secondaryRow => {
            const matchingPrimary = findMatchingPrimary(secondaryRow);
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
          console.log(`📊 Right join: ${secondaryData.length} secondary records (all kept)`);
          return rightResult;

        case 'full':
          // Return ALL records from BOTH forms
          const fullResult: any[] = [];
          const matchedSecondaryIds = new Set<string>();

          // First, process all primary records
          primaryData.forEach(primaryRow => {
            const matchingSecondary = findMatchingSecondary(primaryRow);
            if (matchingSecondary) {
              matchedSecondaryIds.add(matchingSecondary.id);
              fullResult.push(mergeRows(primaryRow, matchingSecondary));
            } else {
              fullResult.push(primaryRow);
            }
          });

          // Then add unmatched secondary records
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
          console.log(`📊 Full join: ${primaryData.length} primary + ${secondaryData.length} secondary = ${fullResult.length} total (${matchedSecondaryIds.size} matched)`);
          return fullResult;

        default:
          return primaryData;
      }
    } catch (error) {
      console.error('Error applying chart join:', error);
      return primaryData;
    }
  };

  // Process cross-reference data for charts
  const processCrossReferenceData = async (
    submissions: any[],
    crossRefConfig: {
      enabled: boolean;
      crossRefFieldId: string;
      targetFormId: string;
      mode: 'count' | 'aggregate' | 'compare';
      targetMetricFieldId?: string;
      targetAggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
      targetDimensionFieldId?: string;
      sourceLabelFieldId?: string;
      compareXFieldId?: string; // X-axis field for compare mode
      compareYFieldId?: string; // Y-axis field for compare mode
      sourceGroupByFieldId?: string;
      drilldownEnabled?: boolean;
      drilldownLevels?: string[];
      drilldownDisplayFields?: string[];
      _drilldownState?: {
        currentLevel: number;
        values: string[];
        currentDimensionField?: string;
      };
    }
  ): Promise<any[]> => {
    if (!crossRefConfig.crossRefFieldId || !crossRefConfig.targetFormId) {
      console.warn('Incomplete cross-reference configuration');
      return [];
    }

    try {
      // Fetch all submissions from the target form
      const targetSubmissions = await getFormSubmissionData(crossRefConfig.targetFormId);
      console.log(`📊 Cross-ref: Loaded ${targetSubmissions?.length || 0} records from target form`);
      
      // Also fetch target form fields for proper label resolution and option colors
      const targetFormFields = await getFormFields(crossRefConfig.targetFormId);
      const targetFieldLookup = new Map<string, string>();
      const targetFieldOptionsLookup = new Map<string, Map<string, { label: string; color?: string; image?: string }>>();
      
      targetFormFields?.forEach((field: any) => {
        targetFieldLookup.set(field.id, field.label || field.id);
        
        // Build options lookup for fields with options (select, radio, multi-select, etc.)
        if (field.options && Array.isArray(field.options)) {
          const optionsMap = new Map<string, { label: string; color?: string; image?: string }>();
          field.options.forEach((opt: any) => {
            const optValue = opt.value || opt.label || '';
            optionsMap.set(optValue, {
              label: opt.label || opt.value || optValue,
              color: opt.color,
              image: opt.image
            });
          });
          targetFieldOptionsLookup.set(field.id, optionsMap);
        }
      });

      if (!targetSubmissions || targetSubmissions.length === 0) {
        console.log('📊 Cross-ref: No target submissions found');
        return [];
      }

      // Get drilldown state if available
      const drilldownState = crossRefConfig._drilldownState;
      const drilldownLevels = crossRefConfig.drilldownLevels || [];
      const currentLevel = drilldownState?.currentLevel || 0;
      const drilldownValues = drilldownState?.values || [];
      const currentDimensionField = drilldownLevels[currentLevel];
      
      // Determine if drilldown is actively being used (has levels and at least started drilling)
      const isDrilldownActive = crossRefConfig.drilldownEnabled && drilldownLevels.length > 0;
      
      console.log('📊 Cross-ref drilldown processing:', {
        drilldownEnabled: crossRefConfig.drilldownEnabled,
        isDrilldownActive,
        currentLevel,
        currentDimensionField,
        drilldownValues,
        totalLevels: drilldownLevels.length
      });

      // Build a lookup map: submission_ref_id -> target submissions
      const targetByRefId = new Map<string, any[]>();
      targetSubmissions.forEach(sub => {
        const refId = sub.submission_ref_id;
        if (refId) {
          if (!targetByRefId.has(refId)) {
            targetByRefId.set(refId, []);
          }
          targetByRefId.get(refId)!.push(sub);
        }
      });

      // Process each parent submission
      const result: any[] = [];
      
      // Collect ALL linked submissions across all parents for drilldown grouping
      let allLinkedSubmissions: any[] = [];

      submissions.forEach(parentSub => {
        const crossRefValue = parentSub.submission_data?.[crossRefConfig.crossRefFieldId];
        
        // Normalize cross-reference value to array of ref IDs
        let linkedRefIds: string[] = [];
        if (typeof crossRefValue === 'string') {
          linkedRefIds = crossRefValue.split(',').map(s => s.trim()).filter(Boolean);
        } else if (Array.isArray(crossRefValue)) {
          linkedRefIds = crossRefValue.flatMap(v => {
            if (typeof v === 'string') return v.split(',').map(s => s.trim());
            if (v?.submission_ref_id) return [v.submission_ref_id];
            return [];
          }).filter(Boolean);
        } else if (crossRefValue?.submission_ref_id) {
          linkedRefIds = [crossRefValue.submission_ref_id];
        }

        // Get all linked target submissions
        let linkedSubmissions: any[] = [];
        linkedRefIds.forEach(refId => {
          const matches = targetByRefId.get(refId) || [];
          linkedSubmissions.push(...matches);
        });
        
        // Apply drilldown filters to linked submissions if drilldown is active
        if (isDrilldownActive && drilldownValues.length > 0) {
          linkedSubmissions = linkedSubmissions.filter(sub => {
            // Check each drilldown level's filter
            for (let i = 0; i < drilldownValues.length; i++) {
              const levelFieldId = drilldownLevels[i];
              const expectedValue = drilldownValues[i];
              if (!levelFieldId || !expectedValue) continue;
              
              const fieldValue = sub.submission_data?.[levelFieldId];
              const normalizedFieldValue = typeof fieldValue === 'object' 
                ? JSON.stringify(fieldValue) 
                : String(fieldValue || '');
              
              if (normalizedFieldValue !== expectedValue) {
                return false; // Filter out records that don't match
              }
            }
            return true;
          });
        }
        
        // Add to all linked submissions for drilldown grouping
        allLinkedSubmissions.push(...linkedSubmissions.map(sub => ({
          ...sub,
          _parentId: parentSub.id,
          _parentRefId: parentSub.submission_ref_id
        })));

        if (crossRefConfig.mode === 'count') {
          // Count mode: count linked records
          const dimensionValue = crossRefConfig.targetDimensionFieldId
            ? linkedSubmissions.reduce((acc, sub) => {
                const dimVal = sub.submission_data?.[crossRefConfig.targetDimensionFieldId!] || 'Unknown';
                const key = typeof dimVal === 'object' ? JSON.stringify(dimVal) : String(dimVal);
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            : { count: linkedSubmissions.length };

          if (crossRefConfig.targetDimensionFieldId) {
            // Multiple data points per parent (grouped by dimension)
            // Get options lookup for the dimension field
            const dimFieldOptions = targetFieldOptionsLookup.get(crossRefConfig.targetDimensionFieldId);
            
            Object.entries(dimensionValue).forEach(([dimVal, count]) => {
              // Look up option color if available
              const optionInfo = dimFieldOptions?.get(dimVal);
              
              result.push({
                name: optionInfo?.label || dimVal,
                value: count,
                count: count,
                parentId: parentSub.id,
                parentRefId: parentSub.submission_ref_id,
                _linkedSubmissionIds: linkedSubmissions.map(s => s.id),
                _optionColor: optionInfo?.color,
                _optionImage: optionInfo?.image
              });
            });
          } else {
            // Single data point per parent - use sourceLabelFieldId if available
            const labelValue = crossRefConfig.sourceLabelFieldId 
              ? parentSub.submission_data?.[crossRefConfig.sourceLabelFieldId]
              : null;
            const displayName = labelValue 
              ? (typeof labelValue === 'object' ? JSON.stringify(labelValue) : String(labelValue))
              : (parentSub.submission_ref_id || parentSub.id.slice(0, 8));
            
            result.push({
              name: displayName,
              value: linkedSubmissions.length,
              count: linkedSubmissions.length,
              parentId: parentSub.id,
              parentRefId: parentSub.submission_ref_id,
              _linkedSubmissionIds: linkedSubmissions.map(s => s.id)
            });
          }
        } else if (crossRefConfig.mode === 'compare') {
          // Compare mode: X/Y axis style comparison like normal compare mode
          if (!crossRefConfig.compareXFieldId || !crossRefConfig.compareYFieldId) {
            console.warn('Compare mode requires both compareXFieldId and compareYFieldId');
            return;
          }

          // Get field labels from target form lookup
          const xFieldLabel = targetFieldLookup.get(crossRefConfig.compareXFieldId) || crossRefConfig.compareXFieldId;
          const yFieldLabel = targetFieldLookup.get(crossRefConfig.compareYFieldId) || crossRefConfig.compareYFieldId;

          // Use sourceLabelFieldId if available for better labels
          const labelValue = crossRefConfig.sourceLabelFieldId 
            ? parentSub.submission_data?.[crossRefConfig.sourceLabelFieldId]
            : null;
          const displayName = labelValue 
            ? (typeof labelValue === 'object' ? JSON.stringify(labelValue) : String(labelValue))
            : (parentSub.submission_ref_id || parentSub.id.slice(0, 8));

          // Process each linked submission as a separate data point for text compare
          linkedSubmissions.forEach((sub) => {
            const xVal = sub.submission_data?.[crossRefConfig.compareXFieldId!];
            const yVal = sub.submission_data?.[crossRefConfig.compareYFieldId!];
            
            // Check if X and Y are text types
            const isXText = typeof xVal === 'string' && isNaN(Number(xVal));
            const isYText = typeof yVal === 'string' && isNaN(Number(yVal));
            
            // Get display values (text or number)
            const xDisplay = isXText ? String(xVal || 'Unknown') : 
              (typeof xVal === 'number' ? xVal : 
                (typeof xVal === 'object' && xVal?.amount ? Number(xVal.amount) : Number(xVal) || 0));
            
            const yDisplay = isYText ? String(yVal || 'Unknown') : 
              (typeof yVal === 'number' ? yVal : 
                (typeof yVal === 'object' && yVal?.amount ? Number(yVal.amount) : Number(yVal) || 0));
            
            // Get option colors for X and Y values if they're from option fields
            const xFieldOptions = targetFieldOptionsLookup.get(crossRefConfig.compareXFieldId!);
            const yFieldOptions = targetFieldOptionsLookup.get(crossRefConfig.compareYFieldId!);
            const xOptionInfo = xFieldOptions?.get(String(xVal));
            const yOptionInfo = yFieldOptions?.get(String(yVal));
            
            result.push({
              name: xOptionInfo?.label || String(xDisplay), // Use option label if available
              xRaw: xOptionInfo?.label || String(xDisplay),
              yRaw: yOptionInfo?.label || String(yDisplay),
              x: isXText ? 0 : Number(xDisplay) || 0,
              y: isYText ? 0 : Number(yDisplay) || 0,
              value: isYText ? 1 : (Number(yDisplay) || 0), // For text Y, use count of 1
              xFieldId: crossRefConfig.compareXFieldId,
              yFieldId: crossRefConfig.compareYFieldId,
              xFieldLabel: xFieldLabel, // Include resolved field labels
              yFieldLabel: yFieldLabel,
              parentId: String(parentSub.id),
              parentRefId: String(parentSub.submission_ref_id || ''),
              linkedSubmissionId: sub.id,
              _isCrossRefCompare: true,
              _hasTextX: isXText,
              _hasTextY: isYText,
              _linkedSubmissionIds: [sub.id],
              _xOptionColor: xOptionInfo?.color,
              _yOptionColor: yOptionInfo?.color,
              _xOptionImage: xOptionInfo?.image,
              _yOptionImage: yOptionInfo?.image
            });
          });
        } else {
          // Aggregate mode
          if (!crossRefConfig.targetMetricFieldId) {
            console.warn('Aggregate mode requires targetMetricFieldId');
            return;
          }

          const aggregation = crossRefConfig.targetAggregation || 'sum';
          
          // Extract numeric values from linked submissions
          const values = linkedSubmissions
            .map(sub => {
              const val = sub.submission_data?.[crossRefConfig.targetMetricFieldId!];
              if (typeof val === 'number') return val;
              if (typeof val === 'object' && val?.amount) return Number(val.amount) || 0;
              return Number(val) || 0;
            })
            .filter(v => !isNaN(v));

          let aggregatedValue = 0;
          if (values.length > 0) {
            switch (aggregation) {
              case 'sum':
                aggregatedValue = values.reduce((a, b) => a + b, 0);
                break;
              case 'avg':
                aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
                break;
              case 'min':
                aggregatedValue = Math.min(...values);
                break;
              case 'max':
                aggregatedValue = Math.max(...values);
                break;
              case 'count':
                aggregatedValue = values.length;
                break;
            }
          }

          if (crossRefConfig.targetDimensionFieldId) {
            // Group by dimension in target form
            const groupedValues: Record<string, number[]> = {};
            linkedSubmissions.forEach(sub => {
              const dimVal = sub.submission_data?.[crossRefConfig.targetDimensionFieldId!] || 'Unknown';
              const key = typeof dimVal === 'object' ? JSON.stringify(dimVal) : String(dimVal);
              const val = sub.submission_data?.[crossRefConfig.targetMetricFieldId!];
              const numVal = typeof val === 'number' ? val : (typeof val === 'object' && val?.amount ? Number(val.amount) : Number(val)) || 0;
              
              if (!groupedValues[key]) groupedValues[key] = [];
              groupedValues[key].push(numVal);
            });

            Object.entries(groupedValues).forEach(([dimVal, vals]) => {
              let aggVal = 0;
              if (vals.length > 0) {
                switch (aggregation) {
                  case 'sum':
                    aggVal = vals.reduce((a, b) => a + b, 0);
                    break;
                  case 'avg':
                    aggVal = vals.reduce((a, b) => a + b, 0) / vals.length;
                    break;
                  case 'min':
                    aggVal = Math.min(...vals);
                    break;
                  case 'max':
                    aggVal = Math.max(...vals);
                    break;
                  case 'count':
                    aggVal = vals.length;
                    break;
                }
              }
              result.push({
                name: dimVal,
                value: aggVal,
                [crossRefConfig.targetMetricFieldId!]: aggVal,
                parentId: parentSub.id,
                parentRefId: parentSub.submission_ref_id,
                _linkedSubmissionIds: linkedSubmissions.map(s => s.id)
              });
            });
          } else {
            // Use sourceLabelFieldId if available for better labels
            const labelValue = crossRefConfig.sourceLabelFieldId 
              ? parentSub.submission_data?.[crossRefConfig.sourceLabelFieldId]
              : null;
            const displayName = labelValue 
              ? (typeof labelValue === 'object' ? JSON.stringify(labelValue) : String(labelValue))
              : (parentSub.submission_ref_id || parentSub.id.slice(0, 8));
            
            result.push({
              name: displayName,
              value: aggregatedValue,
              [crossRefConfig.targetMetricFieldId!]: aggregatedValue,
              parentId: parentSub.id,
              parentRefId: parentSub.submission_ref_id,
              _linkedSubmissionIds: linkedSubmissions.map(s => s.id)
            });
          }
        }
      });

      // DRILLDOWN GROUPING: Only group by drilldown field AFTER user has clicked (drilldownValues.length > 0)
      // At level 0 (initial view), show normal chart. Drilldown grouping starts at level 1+
      const hasStartedDrilling = drilldownValues.length > 0;
      if (isDrilldownActive && currentDimensionField && hasStartedDrilling && currentLevel < drilldownLevels.length) {
        console.log('📊 Cross-ref drilldown: Grouping by level field', currentDimensionField, 'at level', currentLevel);
        
        // Get field options for the current drilldown field
        const dimFieldOptions = targetFieldOptionsLookup.get(currentDimensionField);
        
        // Group all linked submissions by the current drilldown field
        const groupedByDrilldownField: Record<string, { 
          count: number;
          value: number;
          linkedSubmissionIds: string[];
          parentIds: string[];
          parentRefIds: string[];
        }> = {};
        
        allLinkedSubmissions.forEach(sub => {
          const fieldVal = sub.submission_data?.[currentDimensionField] || 'Unknown';
          const key = typeof fieldVal === 'object' ? JSON.stringify(fieldVal) : String(fieldVal);
          
          if (!groupedByDrilldownField[key]) {
            groupedByDrilldownField[key] = {
              count: 0,
              value: 0,
              linkedSubmissionIds: [],
              parentIds: [],
              parentRefIds: []
            };
          }
          
          groupedByDrilldownField[key].count += 1;
          groupedByDrilldownField[key].linkedSubmissionIds.push(sub.id);
          if (sub._parentId) groupedByDrilldownField[key].parentIds.push(String(sub._parentId));
          if (sub._parentRefId) groupedByDrilldownField[key].parentRefIds.push(String(sub._parentRefId));
          
          // For aggregate mode, also accumulate metric values
          if (crossRefConfig.mode === 'aggregate' && crossRefConfig.targetMetricFieldId) {
            const metricVal = sub.submission_data?.[crossRefConfig.targetMetricFieldId];
            const numVal = typeof metricVal === 'number' ? metricVal : 
              (typeof metricVal === 'object' && metricVal?.amount ? Number(metricVal.amount) : Number(metricVal)) || 0;
            groupedByDrilldownField[key].value += numVal;
          } else {
            // For count mode, value equals count
            groupedByDrilldownField[key].value = groupedByDrilldownField[key].count;
          }
        });
        
        // Convert to result array
        const drilldownResult = Object.entries(groupedByDrilldownField).map(([name, data]) => {
          const optionInfo = dimFieldOptions?.get(name);
          return {
            name: optionInfo?.label || name,
            value: data.value,
            count: data.count,
            parentId: data.parentIds[0] || '',
            parentRefId: data.parentRefIds[0] || '',
            _linkedSubmissionIds: [...new Set(data.linkedSubmissionIds)],
            _allParentIds: data.parentIds,
            _allParentRefIds: data.parentRefIds,
            _optionColor: optionInfo?.color,
            _optionImage: optionInfo?.image,
            _drilldownField: currentDimensionField,
            _drilldownValue: name // Store the raw value for filtering on next click
          };
        });
        
        console.log(`📊 Cross-ref drilldown: Grouped into ${drilldownResult.length} values`);
        return drilldownResult;
      }

      // If grouped by dimension, aggregate across all parents - preserve IDs for drilldown
      if (crossRefConfig.targetDimensionFieldId && result.length > 0) {
        const aggregatedByDimension: Record<string, { 
          value: number; 
          count: number; 
          parentIds: string[];
          parentRefIds: string[];
          linkedSubmissionIds: string[];
        }> = {};
        result.forEach(item => {
          if (!aggregatedByDimension[item.name]) {
            aggregatedByDimension[item.name] = { 
              value: 0, 
              count: 0,
              parentIds: [],
              parentRefIds: [],
              linkedSubmissionIds: []
            };
          }
          aggregatedByDimension[item.name].value += item.value;
          aggregatedByDimension[item.name].count += 1;
          // Collect all parent and linked IDs for drilldown
          if (item.parentId) aggregatedByDimension[item.name].parentIds.push(String(item.parentId));
          if (item.parentRefId) aggregatedByDimension[item.name].parentRefIds.push(String(item.parentRefId));
          if (item._linkedSubmissionIds) {
            aggregatedByDimension[item.name].linkedSubmissionIds.push(...item._linkedSubmissionIds);
          }
        });

        return Object.entries(aggregatedByDimension).map(([name, data]) => ({
          name,
          value: data.value,
          count: data.count,
          // Use first parentId for drilldown reference, store all for potential future use
          parentId: data.parentIds[0] || '',
          parentRefId: data.parentRefIds[0] || '',
          _linkedSubmissionIds: [...new Set(data.linkedSubmissionIds)], // Deduplicate
          _allParentIds: data.parentIds,
          _allParentRefIds: data.parentRefIds
        }));
      }

      console.log(`📊 Cross-ref: Processed ${result.length} data points`);
      return result;
    } catch (error) {
      console.error('Error processing cross-reference data:', error);
      return [];
    }
  };

  // Transform cross-reference data to match the expected format for each chart type
  const transformCrossRefDataForChartType = (crossRefData: any[], chartType: string): any[] => {
    if (!crossRefData || crossRefData.length === 0) return [];
    
    // Check if this is cross-ref compare mode with text fields - apply encoded legend transformation
    const hasTextCompare = crossRefData.some(item => item._isCrossRefCompare && (item._hasTextX || item._hasTextY));
    
    if (hasTextCompare) {
      console.log('📊 Cross-ref: Applying text compare transformation (encoded legend mode)');
      
      // Get X/Y field names from pre-resolved labels in data
      const xFieldName = crossRefData[0]?.xFieldLabel || 'X Field';
      const yFieldName = crossRefData[0]?.yFieldLabel || 'Y Field';
      
      // Build unique legend mapping for Y text values with option colors
      const yColorLookup = new Map<string, string | undefined>();
      crossRefData.forEach(item => {
        if (item.yRaw && item._yOptionColor) {
          yColorLookup.set(String(item.yRaw), item._yOptionColor);
        }
      });
      
      const uniqueYValues = new Set<string>();
      crossRefData.forEach(item => {
        if (item.yRaw) uniqueYValues.add(String(item.yRaw));
      });
      const legendMapping = Array.from(uniqueYValues).map((label, index) => ({
        number: index + 1,
        label: label,
        color: yColorLookup.get(label) // Include option color if available
      }));
      
      // Create legend lookup for encoding
      const legendLookup = new Map<string, number>();
      legendMapping.forEach(({ number, label }) => {
        legendLookup.set(label, number);
      });
      
      // Transform data to encoded format
      return crossRefData.map(item => ({
        name: item.name || item.xRaw || 'Unknown',
        xRaw: item.xRaw,
        yRaw: item.yRaw,
        rawYValue: item.yRaw,
        rawSecondaryValue: item.yRaw,
        encodedValue: legendLookup.get(String(item.yRaw)) || 0,
        value: legendLookup.get(String(item.yRaw)) || 0,
        xFieldName: xFieldName,
        yFieldName: yFieldName,
        parentId: item.parentId,
        parentRefId: item.parentRefId,
        _linkedSubmissionIds: item._linkedSubmissionIds,
        _legendMapping: legendMapping,
        _isCompareEncoded: true,
        _isCrossRefCompare: true,
        _yOptionColor: item._yOptionColor,
        _xOptionColor: item._xOptionColor
      }));
    }
    
    switch (chartType) {
      case 'bar':
      case 'column':
      case 'pie':
      case 'donut':
        // These chart types work with { name, value } format - no transformation needed
        return crossRefData;
      
      case 'line':
      case 'area':
        // Line/Area charts use the same { name, value } format for single series
        // The data is already in the correct format
        return crossRefData;
      
      case 'scatter':
      case 'bubble':
        // Scatter/Bubble charts need { x, y, name } format
        // Transform by assigning index as x coordinate and value as y coordinate
        return crossRefData.map((item, index) => ({
          ...item,
          x: index + 1, // Use sequential index as X coordinate
          y: item.value || 0,
          name: item.name || `Point ${index + 1}`,
          xFieldName: 'Record',
          yFieldName: 'Value'
        }));
      
      case 'heatmap':
        // Heatmap needs special handling - if we only have { name, value }, 
        // create a simple row/column structure
        // Group by name as rows and use a single column
        const uniqueNames = [...new Set(crossRefData.map(item => item.name))];
        return crossRefData.map((item, index) => ({
          ...item,
          row: item.name || `Row ${index + 1}`,
          column: 'Value',
          intensity: item.value || 0
        }));
      
      default:
        return crossRefData;
    }
  };

  useEffect(() => {
    const loadChartData = async () => {
      // Use sample data if provided, otherwise fetch from form
      if ((config as any).data) {
        setChartData((config as any).data);
        setLoading(false);
        return;
      }

      // Check if we have minimum required configuration
      if (!config.formId) {
        setChartData([]);
        setLoading(false);
        return;
      }
      try {

        // Get drilldown levels - support both property names for compatibility
        const drilldownLevels = config.drilldownConfig?.drilldownLevels || config.drilldownConfig?.levels || [];

        // Use server-side RPC function for drilldown-enabled charts
        if (config.drilldownConfig?.enabled && drilldownLevels.length > 0) {
          // Determine the current dimension based on drilldown state
          const currentDrilldownLevel = drilldownState?.values?.length || 0;
          const currentDimension = drilldownLevels[currentDrilldownLevel] || drilldownLevels[0];

          // Use the current dimension for the chart - show the NEXT level after current drilldown
          const chartDimensions = [currentDimension];
          // Get aggregation from metricAggregations if available, otherwise use config.aggregation
          const effectiveAggregation = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
          const serverData: any[] = await getChartData(config.formId, chartDimensions, config.metrics || [], effectiveAggregation, config.filters || [], drilldownLevels, drilldownState?.values || [], config.metricAggregations || [], config.groupByField);

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
          
          // Apply cross-reference data processing if configured
          if (config.crossRefConfig?.enabled && config.crossRefConfig?.crossRefFieldId) {
            console.log('📊 Processing cross-reference data');
            
            // Get cross-ref drilldown configuration
            const crossRefDrilldownLevels = config.crossRefConfig.drilldownLevels || [];
            const crossRefDrilldownEnabled = config.crossRefConfig.drilldownEnabled && crossRefDrilldownLevels.length > 0;
            const currentDrilldownLevel = drilldownState?.values?.length || 0;
            
            console.log('📊 Cross-ref drilldown config:', {
              enabled: crossRefDrilldownEnabled,
              levels: crossRefDrilldownLevels,
              currentLevel: currentDrilldownLevel,
              drilldownValues: drilldownState?.values
            });
            
            // Pass drilldown state to processCrossReferenceData
            const crossRefData = await processCrossReferenceData(submissions, {
              ...config.crossRefConfig,
              _drilldownState: crossRefDrilldownEnabled ? {
                currentLevel: currentDrilldownLevel,
                values: drilldownState?.values || [],
                currentDimensionField: crossRefDrilldownLevels[currentDrilldownLevel]
              } : undefined
            });
            console.log('📊 Cross-reference data processed:', crossRefData?.length || 0);
            
            // Transform cross-reference data based on chart type
            const currentChartType = config.type || config.chartType || 'bar';
            const transformedData = transformCrossRefDataForChartType(crossRefData, currentChartType);
            console.log('📊 Cross-reference data transformed for', currentChartType, ':', transformedData?.length || 0);
            
            setChartData(transformedData);
            setLoading(false);
            return;
          }
          
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
  }, [config.formId, config.dimensions, config.metrics, config.filters, config.xAxis, config.yAxis, config.aggregation, config.aggregationType, config.groupByField, config.drilldownConfig?.enabled, config.drilldownConfig?.drilldownLevels, drilldownState?.values, (config as any).data, config.joinConfig?.enabled, config.joinConfig?.secondaryFormId, config.crossRefConfig?.enabled, config.crossRefConfig?.crossRefFieldId, config.crossRefConfig?.mode, config.crossRefConfig?.targetMetricFieldId, config.crossRefConfig?.targetDimensionFieldId, config.crossRefConfig?.drilldownEnabled, config.crossRefConfig?.drilldownLevels, getFormSubmissionData, getChartData]);
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

    // Get the current chart type
    const currentChartType = config.type || config.chartType || 'bar';

    console.log('Processing with dimensions:', dimensionFields, 'metrics:', metricFields, 'groupBy:', effectiveGroupByField, 'compareMode:', config.compareMode, 'chartType:', currentChartType);

    // Heatmap: special processing for 2 dimensions + intensity
    // Use config.dimensions directly since dimensionFields may only have first dimension
    const heatmapDimensions = config.dimensions || [];
    if (currentChartType === 'heatmap' && heatmapDimensions.length >= 2) {
      console.log('📊 Processing heatmap with row/column dimensions:', heatmapDimensions[0], heatmapDimensions[1]);
      return processHeatmapData(submissions, heatmapDimensions[0], heatmapDimensions[1], config.heatmapIntensityField || metricFields[0]);
    }

    // Scatter/Bubble charts: use compare mode processing with x/y coordinates
    if ((currentChartType === 'scatter' || currentChartType === 'bubble') && config.metrics && config.metrics.length >= 2) {
      console.log('📊 Processing scatter/bubble chart with metrics:', config.metrics);
      return processCompareData(submissions, dimensionFields, config.metrics);
    }

    // Compare mode: require exactly two metrics and ignore aggregation/count semantics
    if (config.compareMode) {
      if (!config.metrics || config.metrics.length !== 2) {
        console.warn('Compare mode requires exactly two metric fields. Current metrics:', config.metrics);
        return [];
      }
      
      // Check if Y-axis field (second metric) is a text type - auto enable encoded legend
      const yAxisFieldId = config.metrics[1];
      const yAxisField = formFields.find(f => f.id === yAxisFieldId);
      const yAxisFieldType = (yAxisField as any)?.field_type || (yAxisField as any)?.type || '';
      const textFieldTypes = ['text', 'short-text', 'long-text', 'textarea', 'select', 'radio', 'dropdown', 'status', 'country', 'email', 'tags', 'address', 'multi-select', 'checkbox'];
      let isYAxisTextType = textFieldTypes.includes(yAxisFieldType);
      
      // Fallback: if field not found in formFields, detect from actual data values
      if (!yAxisField && submissions.length > 0) {
        const sampleValue = submissions[0]?.submission_data?.[yAxisFieldId];
        // If the sample value is a string and not a pure number, treat as text
        if (typeof sampleValue === 'string' && isNaN(Number(sampleValue))) {
          isYAxisTextType = true;
          console.log('🔍 Compare mode - Detected text type from data value:', sampleValue);
        }
      }
      
      console.log('🔍 Compare mode - Y-axis field:', yAxisFieldId, 'field found:', !!yAxisField, 'type:', yAxisFieldType, 'Is text type:', isYAxisTextType);
      
      if (isYAxisTextType) {
        console.log('🔍 Using encoded legend mode for compare (auto-detected text Y-axis field)');
        return processCompareEncodedData(submissions, config.metrics[0], config.metrics[1]);
      }
      
      return processCompareData(submissions, dimensionFields, config.metrics);
    }

    // If groupByField is specified, use grouped processing
    if (config.groupByField) {
      return processGroupedData(submissions, dimensionFields, metricFields, config.groupByField);
    }
    
    // For Count mode with 2 dimensions: first is X-axis, second is Stack/Color
    // Auto-detect if secondary field is text type and use encoded legend mode
    if (dimensionFields.length > 1 && !config.aggregationEnabled && !config.compareMode) {
      console.log('🔍 Count mode with stacking: X-axis =', dimensionFields[0], 'Stack =', dimensionFields[1]);
      
      // Check if secondary field is a text type - auto enable encoded legend mode
      const secondaryFieldId = dimensionFields[1];
      const secondaryField = formFields.find(f => f.id === secondaryFieldId);
      const secondaryFieldType = (secondaryField as any)?.field_type || (secondaryField as any)?.type || '';
      const textFieldTypes = ['text', 'short-text', 'long-text', 'textarea', 'select', 'radio', 'dropdown', 'status', 'country', 'email', 'tags', 'address', 'multi-select', 'checkbox'];
      const isTextType = textFieldTypes.includes(secondaryFieldType);
      
      console.log('🔍 Secondary field type:', secondaryFieldType, 'Is text type:', isTextType);
      
      // Use encoded legend mode for text fields OR if explicitly enabled
      if (isTextType || config.encodedLegendMode) {
        console.log('🔍 Using encoded legend mode (auto-detected text field)');
        return processEncodedLegendData(submissions, dimensionFields[0], dimensionFields[1]);
      }
      
      return processGroupedData(submissions, [dimensionFields[0]], metricFields, dimensionFields[1]);
    }
    
    // For multiple dimensions in other modes, we need to create a cross-product structure
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
    
    // Get size field for bubble charts
    const sizeField = config.sizeField;

    const hasDimension = dimensionFields.length > 0 && dimensionFields[0] !== '_default';

    // If dimension is selected, group data by dimension and sum values
    if (hasDimension) {
      console.log('📊 Compare mode WITH dimension grouping:', dimensionFields[0]);
      
      // Group submissions by dimension value and sum both metrics
      const groupedData: { [key: string]: { x: number; y: number; count: number; sizeSum: number } } = {};
      
      submissions
        .filter(submission => passesFilters(submission.submission_data))
        .forEach(submission => {
          const submissionData = submission.submission_data;
          const dimensionKey = getDimensionKey(submissionData, dimensionFields);
          const xValue = getRawMetricValue(submissionData, metricField1);
          const yValue = getRawMetricValue(submissionData, metricField2);
          const sizeValue = sizeField ? getRawMetricValue(submissionData, sizeField) : 1;
          
          if (!groupedData[dimensionKey]) {
            groupedData[dimensionKey] = { x: 0, y: 0, count: 0, sizeSum: 0 };
          }
          
          groupedData[dimensionKey].x += xValue;
          groupedData[dimensionKey].y += yValue;
          groupedData[dimensionKey].sizeSum += sizeValue;
          groupedData[dimensionKey].count += 1;
        });
      
      // Convert to array format - include size field value
      const points = Object.entries(groupedData).map(([name, values]) => {
        const point: any = {
          name,
          x: values.x,
          y: values.y,
          xFieldName: field1Name,
          yFieldName: field2Name,
        };
        if (sizeField) {
          point[sizeField] = values.sizeSum;
        }
        return point;
      });
      
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
        
        // Get size value for bubble charts
        const sizeValue = sizeField ? getRawMetricValue(submissionData, sizeField) : 1;

        const point: any = {
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
        
        // Include size field value for bubble charts
        if (sizeField) {
          point[sizeField] = sizeValue;
        }
        
        return point;
      });

    console.log('📊 Compare scatter data:', points);
    return points;
  };

  // Process encoded legend mode - X-axis shows primary field values, Y-axis shows encoded numeric values for secondary field
  // Returns chart data plus a legend mapping object
  const processEncodedLegendData = (submissions: any[], primaryField: string, secondaryField: string) => {
    console.log('📊 Processing encoded legend mode - Primary:', primaryField, 'Secondary:', secondaryField);
    
    // First, collect all unique values of the secondary field to create the encoding
    const uniqueSecondaryValues = new Set<string>();
    submissions
      .filter(submission => passesFilters(submission.submission_data))
      .forEach(submission => {
        const value = getDimensionValue(submission.submission_data, secondaryField);
        if (value && value !== 'Unknown') {
          uniqueSecondaryValues.add(value);
        }
      });
    
    // Create encoding map: value -> number (1, 2, 3, ...)
    const encodingMap: { [value: string]: number } = {};
    const legendMapping: { number: number; label: string }[] = [];
    let encodingNumber = 1;
    
    Array.from(uniqueSecondaryValues).sort().forEach(value => {
      encodingMap[value] = encodingNumber;
      legendMapping.push({ number: encodingNumber, label: value });
      encodingNumber++;
    });
    
    console.log('📊 Encoding map:', encodingMap);
    console.log('📊 Legend mapping:', legendMapping);
    
    // Now create chart data with primary field as X-axis and encoded value as Y-axis
    const chartData = submissions
      .filter(submission => passesFilters(submission.submission_data))
      .map((submission, index) => {
        const submissionData = submission.submission_data;
        const primaryValue = getDimensionValue(submissionData, primaryField);
        const secondaryValue = getDimensionValue(submissionData, secondaryField);
        const encodedValue = encodingMap[secondaryValue] || 0;
        
        return {
          name: primaryValue || `Record ${index + 1}`,
          value: encodedValue,
          encodedValue,
          rawSecondaryValue: secondaryValue,
          submissionId: submission.id,
          _legendMapping: legendMapping, // Store legend for rendering
        };
      });
    
    console.log('📊 Encoded legend chart data:', chartData);
    return chartData;
  };

  // Process compare mode with encoded legend - X-axis shows first field values, Y-axis shows encoded numeric values for second field
  // Now also supports grouping by dimension field
  const processCompareEncodedData = (submissions: any[], xAxisField: string, yAxisField: string) => {
    // Check if there's a dimension field selected for grouping
    const dimensionFields = config.dimensions || [];
    const hasDimension = dimensionFields.length > 0 && dimensionFields[0] !== '_default';
    
    console.log('📊 Processing compare encoded mode - X:', xAxisField, 'Y:', yAxisField, 'Dimension:', hasDimension ? dimensionFields[0] : 'none');
    
    const xFieldName = getFormFieldName(xAxisField);
    const yFieldName = getFormFieldName(yAxisField);
    
    // Collect all unique Y-axis values to create encoding
    const uniqueYValues = new Set<string>();
    submissions
      .filter(submission => passesFilters(submission.submission_data))
      .forEach(submission => {
        const value = getDimensionValue(submission.submission_data, yAxisField);
        if (value && value !== 'Unknown') {
          uniqueYValues.add(value);
        }
      });
    
    // Create encoding map: value -> number (1, 2, 3, ...)
    const encodingMap: { [value: string]: number } = {};
    const legendMapping: { number: number; label: string }[] = [];
    let encodingNumber = 1;
    
    Array.from(uniqueYValues).sort().forEach(value => {
      encodingMap[value] = encodingNumber;
      legendMapping.push({ number: encodingNumber, label: value });
      encodingNumber++;
    });
    
    console.log('📊 Compare encoding map:', encodingMap);
    console.log('📊 Compare legend mapping:', legendMapping);
    
    // If dimension is selected, group by dimension and show aggregated data
    if (hasDimension) {
      const dimensionField = dimensionFields[0];
      const groupedData: { [key: string]: { yValues: string[]; count: number } } = {};
      
      submissions
        .filter(submission => passesFilters(submission.submission_data))
        .forEach(submission => {
          const submissionData = submission.submission_data;
          const dimensionValue = getDimensionValue(submissionData, dimensionField);
          const yValue = getDimensionValue(submissionData, yAxisField);
          
          if (!groupedData[dimensionValue]) {
            groupedData[dimensionValue] = { yValues: [], count: 0 };
          }
          
          groupedData[dimensionValue].yValues.push(yValue);
          groupedData[dimensionValue].count += 1;
        });
      
      // Convert to chart data - use most frequent Y value for each group
      const chartData = Object.entries(groupedData).map(([dimensionValue, data]) => {
        // Find most frequent Y value in this group
        const valueCounts: { [key: string]: number } = {};
        data.yValues.forEach(v => {
          valueCounts[v] = (valueCounts[v] || 0) + 1;
        });
        const mostFrequentY = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const encodedValue = encodingMap[mostFrequentY] || 0;
        
        return {
          name: dimensionValue,
          value: encodedValue,
          encodedValue,
          rawYValue: mostFrequentY,
          xFieldName: getFormFieldName(dimensionField),
          yFieldName,
          count: data.count,
          _legendMapping: legendMapping,
          _isCompareEncoded: true,
        };
      });
      
      console.log('📊 Compare encoded grouped chart data:', chartData);
      return chartData;
    }
    
    // No dimension - create chart data with X field as labels and encoded Y values
    const chartData = submissions
      .filter(submission => passesFilters(submission.submission_data))
      .map((submission, index) => {
        const submissionData = submission.submission_data;
        const xValue = getDimensionValue(submissionData, xAxisField);
        const yValue = getDimensionValue(submissionData, yAxisField);
        const encodedValue = encodingMap[yValue] || 0;
        
        return {
          name: xValue || `Record ${index + 1}`,
          value: encodedValue,
          encodedValue,
          rawYValue: yValue,
          xFieldName,
          yFieldName,
          submissionId: submission.id,
          _legendMapping: legendMapping,
          _isCompareEncoded: true, // Flag to identify this mode
        };
      });
    
    console.log('📊 Compare encoded chart data:', chartData);
    return chartData;
  };
  
  const processGroupedData = (submissions: any[], dimensionFields: string[], metricFields: string[], groupByField: string) => {
    console.log('🔍 Processing grouped data with groupBy:', groupByField);
    console.log('🔍 Dimension fields:', dimensionFields);
    console.log('🔍 Metric fields:', metricFields);
    
    // Get effective aggregation from metricAggregations or config
    const effectiveAggregation = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
    const isCountMode = metricFields.length === 0 || effectiveAggregation === 'count';
    
    console.log('🔍 Is Count mode:', isCountMode, 'Aggregation:', effectiveAggregation);
    
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
      
      // In Count mode (no metrics), push 1 for each record to count
      if (isCountMode) {
        rawGroupedData[dimensionKey][groupValue].push(1);
      } else {
        // Collect raw metric values
        metricFields.forEach(metric => {
          const metricValue = getRawMetricValue(submissionData, metric);
          rawGroupedData[dimensionKey][groupValue].push(metricValue);
        });
      }
    });
    
    // Apply aggregation and convert to chart-friendly format
    const result: any[] = [];
    Object.entries(rawGroupedData).forEach(([dimensionValue, groups]) => {
      const dataPoint: any = { name: dimensionValue };
      
      // Add each group value as a separate property with aggregated value
      allGroupValues.forEach(groupValue => {
        const values = groups[groupValue] || [];
        // In count mode, just count the records (array length)
        dataPoint[groupValue] = isCountMode ? values.length : applyAggregation(values, effectiveAggregation);
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
    return result;
  };

  // Process heatmap data with row/column dimensions and intensity value
  const processHeatmapData = (submissions: any[], rowField: string, colField: string, intensityField?: string) => {
    const effectiveAggregation = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
    
    // Structure: collect raw values per row-col combination
    const rawData: { [key: string]: { row: string; col: string; values: number[] } } = {};
    
    submissions.forEach(submission => {
      const submissionData = submission.submission_data;
      
      // Apply filters
      if (!passesFilters(submissionData)) return;
      
      const rowValue = getDimensionValue(submissionData, rowField);
      const colValue = getDimensionValue(submissionData, colField);
      const key = `${rowValue}||${colValue}`;
      
      if (!rawData[key]) {
        rawData[key] = { row: rowValue, col: colValue, values: [] };
      }
      
      // Get intensity value (or count)
      if (intensityField && intensityField !== 'count') {
        const metricValue = getRawMetricValue(submissionData, intensityField);
        rawData[key].values.push(metricValue);
      } else {
        rawData[key].values.push(1); // Count
      }
    });
    
    // Apply aggregation and convert to chart format
    const result = Object.values(rawData).map(item => {
      const aggregatedValue = applyAggregation(item.values, effectiveAggregation);
      return {
        name: item.row,
        rowValue: item.row,
        colValue: item.col,
        value: aggregatedValue,
        [intensityField || 'count']: aggregatedValue
      };
    });
    
    console.log('📊 Heatmap processed data:', result);
    return result;
  };

  // Build field types map for proper filter evaluation
  const fieldTypesMap = useMemo(() => {
    const map: Record<string, string> = {};
    formFields.forEach((field: any) => {
      const fieldId = field.id;
      const fieldType = field.field_type || field.type || '';
      if (fieldId && fieldType) {
        map[fieldId] = fieldType;
      }
    });
    return map;
  }, [formFields]);

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
        config.filterLogicExpression,
        fieldTypesMap
      );
      // Drilldown filters must all pass (AND)
      const drilldownResult = drilldownFilters.length === 0 || drilldownFilters.every(filter => {
        const value = submissionData[filter.field];
        const fieldType = fieldTypesMap[filter.field] || '';
        return evaluateFilterCondition(value, filter.operator, filter.value, fieldType);
      });
      return configResult && drilldownResult;
    }
    
    // Default: AND logic for all filters with field type support
    return allFilters?.every(filter => {
      const value = submissionData[filter.field];
      const fieldType = fieldTypesMap[filter.field] || '';
      return evaluateFilterCondition(value, filter.operator, filter.value, fieldType);
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
    if (event) {
      event.stopPropagation();
    }
    
    const clickedValue = data?.name || data;
    if (!clickedValue || clickedValue === 'Not Specified') return;
    
    // Check if this is a cross-reference chart - use parentId for direct record lookup
    // Check for parentId OR _linkedSubmissionIds to identify cross-ref data
    if (config.crossRefConfig?.enabled && (data?.parentId || data?._linkedSubmissionIds)) {
      const crossRefConfig = config.crossRefConfig;
      
      // Compare mode doesn't support drilldown - always show records directly
      // Also show records directly if drilldown mode is OFF or not enabled
      if (crossRefConfig.mode === 'compare' || !isDrilldownModeActive || !crossRefConfig.drilldownEnabled) {
        setCellSubmissionsDialog({
          open: true,
          dimensionField: '',
          dimensionValue: clickedValue,
          dimensionLabel: 'Record',
          submissionId: String(data.parentId),
          crossRefTargetFormId: crossRefConfig.targetFormId,
          crossRefDisplayFields: crossRefConfig.drilldownDisplayFields,
          crossRefLinkedIds: data._linkedSubmissionIds,
        });
        return;
      }
      
      // Drilldown mode is ON - handle hierarchical drilldown
      if (crossRefConfig.drilldownLevels && crossRefConfig.drilldownLevels.length > 0) {
        const drilldownLevels = crossRefConfig.drilldownLevels;
        const currentLevel = drilldownState?.values?.length || 0;
        
        console.log('📊 Cross-ref pie drilldown click:', {
          currentLevel,
          totalLevels: drilldownLevels.length,
          clickedValue,
          drilldownValue: data?._drilldownValue
        });
        
        if (currentLevel >= drilldownLevels.length) {
          setCellSubmissionsDialog({
            open: true,
            dimensionField: '',
            dimensionValue: clickedValue,
            dimensionLabel: 'Record',
            submissionId: String(data.parentId),
            crossRefTargetFormId: crossRefConfig.targetFormId,
            crossRefDisplayFields: crossRefConfig.drilldownDisplayFields,
            crossRefLinkedIds: data._linkedSubmissionIds,
          });
          return;
        }
        
        // Use _drilldownValue if available (raw value for filtering)
        const nextLevel = drilldownLevels[currentLevel];
        const valueToPass = data?._drilldownValue || clickedValue;
        
        if (nextLevel && onDrilldown) {
          console.log('📊 Cross-ref pie drilldown: Drilling into level', currentLevel, 'with value', valueToPass);
          onDrilldown(nextLevel, valueToPass);
          return;
        }
      }
      
      // Fallback - show records
      setCellSubmissionsDialog({
        open: true,
        dimensionField: '',
        dimensionValue: clickedValue,
        dimensionLabel: 'Record',
        submissionId: String(data.parentId),
        crossRefTargetFormId: crossRefConfig.targetFormId,
        crossRefDisplayFields: crossRefConfig.drilldownDisplayFields,
        crossRefLinkedIds: data._linkedSubmissionIds,
      });
      return;
    }
    
    // Get dimension field for the pie chart
    const dimensionField = config.dimensions?.[0] || '';
    const dimensionLabel = dimensionField ? getFormFieldName(dimensionField) : 'Category';
    
    // Check if drilldown is enabled and drilldown mode toggle is ON
    const drilldownLevels = getDrilldownLevels();
    if (config.drilldownConfig?.enabled && onDrilldown && drilldownLevels.length > 0 && isDrilldownModeActive) {
      const currentLevel = drilldownState?.values?.length || 0;
      
      if (currentLevel >= drilldownLevels.length) {
        // At final level - show submissions dialog
        setCellSubmissionsDialog({
          open: true,
          dimensionField,
          dimensionValue: clickedValue,
          dimensionLabel,
        });
        return;
      }
      
      const nextLevel = drilldownLevels[currentLevel];
      if (nextLevel) {
        console.log('🥧 Pie click drilldown:', {
          nextLevel,
          clickedValue,
          currentLevel,
          fieldName: getFormFieldName(nextLevel),
          totalLevels: drilldownLevels.length
        });
        onDrilldown(nextLevel, clickedValue);
        return;
      }
    }
    
    // Drilldown mode is OFF or not enabled - open submissions dialog
    setCellSubmissionsDialog({
      open: true,
      dimensionField,
      dimensionValue: clickedValue,
      dimensionLabel,
    });
  };
  const handleBarClick = (data: any, index: number, event?: any) => {
    // recharts passes the data point in data.payload or data directly
    const payload = data?.payload || data;
    const dimensionValue = payload?.name || data?.name;
    
    if (!dimensionValue) return;
    
    // Check if this is a cross-reference chart - handle drilldown to linked records
    // Check for parentId OR _linkedSubmissionIds to identify cross-ref data
    if (config.crossRefConfig?.enabled && (payload?.parentId || payload?._linkedSubmissionIds)) {
      const crossRefConfig = config.crossRefConfig;
      
      console.log('📊 Cross-ref bar click:', {
        mode: crossRefConfig.mode,
        drilldownEnabled: crossRefConfig.drilldownEnabled,
        isDrilldownModeActive,
        drilldownLevels: crossRefConfig.drilldownLevels,
        currentDrilldownValues: drilldownState?.values,
        payload: { parentId: payload.parentId, _linkedSubmissionIds: payload._linkedSubmissionIds }
      });
      
      // Compare mode doesn't support drilldown - always show records directly
      // Also show records directly if drilldown mode is OFF or not enabled
      if (crossRefConfig.mode === 'compare' || !isDrilldownModeActive || !crossRefConfig.drilldownEnabled) {
        setCellSubmissionsDialog({
          open: true,
          dimensionField: '',
          dimensionValue: dimensionValue,
          dimensionLabel: 'Linked Records',
          submissionId: String(payload.parentId),
          crossRefTargetFormId: crossRefConfig.targetFormId,
          crossRefDisplayFields: crossRefConfig.drilldownDisplayFields,
          crossRefLinkedIds: payload._linkedSubmissionIds,
        });
        return;
      }
      
      // Drilldown mode is ON and drilldown is enabled with levels
      if (crossRefConfig.drilldownLevels && crossRefConfig.drilldownLevels.length > 0) {
        const drilldownLevels = crossRefConfig.drilldownLevels;
        const currentLevel = drilldownState?.values?.length || 0;
        
        console.log('📊 Cross-ref drilldown click:', {
          currentLevel,
          totalLevels: drilldownLevels.length,
          dimensionValue,
          drilldownValue: payload?._drilldownValue,
          payload
        });
        
        if (currentLevel >= drilldownLevels.length) {
          // At final level - show submissions dialog with all linked records
          setCellSubmissionsDialog({
            open: true,
            dimensionField: '',
            dimensionValue: dimensionValue,
            dimensionLabel: 'Linked Records',
            submissionId: String(payload.parentId),
            crossRefTargetFormId: crossRefConfig.targetFormId,
            crossRefDisplayFields: crossRefConfig.drilldownDisplayFields,
            crossRefLinkedIds: payload._linkedSubmissionIds,
          });
          return;
        }
        
        // Drill into the next level - use _drilldownValue if available (raw value for filtering)
        // Otherwise fall back to dimensionValue (display name)
        const nextLevel = drilldownLevels[currentLevel];
        const valueToPass = payload?._drilldownValue || dimensionValue;
        
        if (nextLevel && onDrilldown) {
          console.log('📊 Cross-ref drilldown: Drilling into level', currentLevel, 'with value', valueToPass);
          onDrilldown(nextLevel, valueToPass);
          return;
        }
      }
      
      // No levels configured - show linked records directly
      setCellSubmissionsDialog({
        open: true,
        dimensionField: '',
        dimensionValue: dimensionValue,
        dimensionLabel: 'Linked Records',
        submissionId: String(payload.parentId),
        crossRefTargetFormId: crossRefConfig.targetFormId,
        crossRefDisplayFields: crossRefConfig.drilldownDisplayFields,
        crossRefLinkedIds: payload._linkedSubmissionIds,
      });
      return;
    }
    
    // Get dimensionField from the data payload (xFieldName) or fallback to config
    const dimensionField = payload?.xFieldName || config.dimensions?.[0] || config.xAxis || '';
    const dimensionLabel = dimensionField ? getFormFieldName(dimensionField) : 'Field';
    
    // Check if drilldown is enabled and drilldown mode toggle is ON
    const drilldownLevels = getDrilldownLevels();
    if (config.drilldownConfig?.enabled && onDrilldown && drilldownLevels.length > 0 && isDrilldownModeActive) {
      if (event) {
        event.stopPropagation();
      }
      const currentLevel = drilldownState?.values?.length || 0;
      if (currentLevel >= drilldownLevels.length) {
        // At final level - show submissions dialog (always show list with view button)
        setCellSubmissionsDialog({
          open: true,
          dimensionField,
          dimensionValue,
          dimensionLabel,
        });
        return;
      }
      
      const nextLevel = drilldownLevels[currentLevel];
      if (nextLevel && dimensionValue !== 'Not Specified') {
        onDrilldown(nextLevel, dimensionValue);
        return;
      }
    }
    
    // Drilldown mode is OFF or not enabled - open submissions dialog (always show list with view button)
    setCellSubmissionsDialog({
      open: true,
      dimensionField,
      dimensionValue,
      dimensionLabel,
    });
  };
  const handleChartClick = (data: any, event?: any) => {
    // This will be handled by the drilldown controls instead of direct click
    console.log('Chart clicked, use drilldown controls instead');
  };
  
  // Handle heatmap cell click - shows submissions for the row/column intersection
  const handleHeatmapCellClick = (rowValue: string, colValue: string, rowField?: string, colField?: string) => {
    console.log('🔥 handleHeatmapCellClick called with:', { rowValue, colValue, rowField, colField });
    
    const dimensionField = rowField || config.dimensions?.[0] || '';
    const dimensionLabel = dimensionField ? getFormFieldName(dimensionField) : 'Row';
    
    // Only set group field if we have an actual second dimension (not for 1D heatmaps)
    const hasSecondDimension = !!(colField || config.dimensions?.[1]);
    const groupFieldId = hasSecondDimension ? (colField || config.dimensions?.[1] || '') : '';
    const groupLabel = groupFieldId ? getFormFieldName(groupFieldId) : 'Column';
    
    // For 1D heatmaps (colValue is "Default"), don't pass groupValue to avoid filtering issues
    const effectiveGroupValue = hasSecondDimension && colValue !== 'Default' ? colValue : undefined;
    
    console.log('🔥 Setting dialog state:', { 
      dimensionField, 
      dimensionValue: rowValue, 
      groupField: groupFieldId, 
      groupValue: effectiveGroupValue,
      hasSecondDimension
    });
    
    // For heatmap, we want to filter by both row and column values
    // We'll use the row as the primary dimension and add column info to the dialog
    setCellSubmissionsDialog({
      open: true,
      dimensionField,
      dimensionValue: rowValue,
      dimensionLabel,
      groupField: groupFieldId,
      groupValue: effectiveGroupValue,
      groupLabel,
    });
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
    // Also handle cross-reference mode
    let aggregation: string;
    if (config.crossRefConfig?.enabled) {
      aggregation = config.crossRefConfig.mode || 'count';
    } else {
      const isCompareMode = config.compareMode && config.metrics && config.metrics.length === 2;
      aggregation = isCompareMode ? 'compare' : (config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count');
    }
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

  // Generate cross-reference specific tooltip content
  const getCrossRefTooltipContent = (payload: any, label: string): React.ReactNode => {
    if (!payload || payload.length === 0) return null;
    
    const crossRefConfig = config.crossRefConfig;
    const mode = crossRefConfig?.mode;
    const isCountMode = mode === 'count';
    const isCompareMode = mode === 'compare';
    
    // Get source and target form names
    const sourceFormName = config.formId ? getFormName(config.formId) : 'Source Form';
    const targetFormName = crossRefConfig?.targetFormId ? getFormName(crossRefConfig.targetFormId) : 'Referenced Form';
    
    // Get field names for better labels
    const sourceLabelFieldName = crossRefConfig?.sourceLabelFieldId 
      ? getFormFieldName(crossRefConfig.sourceLabelFieldId) 
      : 'Record';
    const targetMetricFieldName = crossRefConfig?.targetMetricFieldId 
      ? getFormFieldName(crossRefConfig.targetMetricFieldId) 
      : 'Value';
    
    const aggregation = crossRefConfig?.targetAggregation || 'sum';
    const aggLabel = aggregation.charAt(0).toUpperCase() + aggregation.slice(1);
    
    const data = payload[0]?.payload;
    const value = payload[0]?.value;
    
    return (
      <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[220px]">
        {/* Header - Source record */}
        <div className="font-medium text-sm mb-2 pb-2 border-b border-border">
          {label}
        </div>
        
        {/* Value display based on mode */}
        <div className="space-y-2">
          {isCountMode ? (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Linked Records:</span>
              <span className="font-semibold text-lg">{value?.toLocaleString()}</span>
            </div>
          ) : isCompareMode ? (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{data?.xFieldLabel || 'X-Axis'}:</span>
                <span className="font-semibold">{data?.xRaw || data?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{data?.yFieldLabel || 'Y-Axis'}:</span>
                <span className="font-semibold">{data?.yRaw || data?.rawYValue || value}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{aggLabel} of {targetMetricFieldName}:</span>
                <span className="font-semibold text-lg">{typeof value === 'number' ? value.toLocaleString() : value}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Context info */}
        <div className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border space-y-1">
          <div>From: <span className="text-foreground">{sourceFormName}</span></div>
          <div>Linked to: <span className="text-foreground">{targetFormName}</span></div>
        </div>
        
        <div className="text-[11px] text-muted-foreground mt-2 pt-1 border-t border-border">
          Click to view linked records
        </div>
      </div>
    );
  };

  // Generate enhanced tooltip content
  const getEnhancedTooltipContent = (payload: any, label: string): React.ReactNode => {
    if (!payload || payload.length === 0) return null;
    
    // Use cross-reference tooltip if in cross-ref mode
    if (config.crossRefConfig?.enabled) {
      return getCrossRefTooltipContent(payload, label);
    }
    
    const formName = config.formId ? getFormName(config.formId) : 'Form';
    const dimensionField = config.dimensions?.[0] || config.xAxis;
    const dimensionName = dimensionField ? getFormFieldName(dimensionField) : (config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'Field');

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
    // Preserve string values for display fields (xRaw, yRaw, field names, IDs, cross-ref parent IDs)
    const preserveAsStringKeys = ['name', '_drilldownData', 'xRaw', 'yRaw', 'xFieldName', 'yFieldName', 'xFieldLabel', 'yFieldLabel', 'submissionId', '_legendMapping', 'rawSecondaryValue', 'rawYValue', '_isCompareEncoded', '_isCrossRefCompare', '_hasTextX', '_hasTextY', 'parentId', 'parentRefId', 'linkedSubmissionId', '_linkedSubmissionIds', '_allParentIds', '_allParentRefIds', '_optionColor', '_optionImage', '_xOptionColor', '_yOptionColor', '_xOptionImage', '_yOptionImage'];
    let sanitizedChartData = chartData.map(item => {
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

    // Apply maxDataPoints limit if configured
    if (config.maxDataPoints && config.maxDataPoints > 0) {
      sanitizedChartData = sanitizedChartData.slice(0, config.maxDataPoints);
    }

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
    // Also check for encoded legend data (text compare mode) which has encodedValue field
    const hasEncodedData = sanitizedChartData.some(item => item._legendMapping && item.encodedValue > 0);
    const hasValidNumericData = hasEncodedData || sanitizedChartData.some(item => {
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

    // Get ALL dimension-based data keys from ALL data items (for multi-dimensional charts OR grouped charts OR compare mode)
    // Important: Must scan all items because different records may have different keys (e.g., John has Canada, George has Finland)
    const allNumericKeys = new Set<string>();
    // Keys to exclude from dimension detection (internal keys and duplicates)
    const excludedKeys = new Set(['name', '_drilldownData', 'x', 'y', 'xFieldName', 'yFieldName', 'xRaw', 'yRaw', 'submissionId', 'value', '_isCompareEncoded', 'rawYValue', 'encodedValue']);
    sanitizedChartData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!excludedKeys.has(key) && typeof item[key] === 'number') {
          allNumericKeys.add(key);
        }
      });
    });
    let dimensionKeys = Array.from(allNumericKeys);
    
    const isCompareMode = config.compareMode && config.metrics && config.metrics.length === 2;
    // For Calculate Values mode (single metric, no groupBy), treat as single-dimensional even if dimensionKeys > 1
    const isCalculateMode = !config.compareMode && config.metrics?.length === 1 && !config.groupByField;
    const isMultiDimensional = !isCalculateMode && ((config.dimensions && config.dimensions.length > 1) || (config.groupByField && dimensionKeys.length > 1) || dimensionKeys.length > 1);

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
    // Skip standard compare rendering if using encoded legend mode (data has _legendMapping)
    const hasEncodedLegend = sanitizedChartData.length > 0 && sanitizedChartData[0]._legendMapping;
    if (isCompareMode && !hasEncodedLegend) {
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
          <div className="w-full h-[350px]">
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
                  <Line type="monotone" dataKey="y" stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0], r: 4, cursor: 'pointer', onClick: (props: any) => handleBarClick(props, 0) }} activeDot={{ r: 8, stroke: colors[0], strokeWidth: 2, cursor: 'pointer', onClick: (props: any) => handleBarClick(props, 0) }} />
                </RechartsLineChart>
              </ResponsiveContainer>
          </div>
        );
      }

      if (chartType === 'area') {
        return (
          <div className="w-full h-[350px]">
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
                  <Area type="monotone" dataKey="y" stroke={colors[0]} fill={colors[0]} fillOpacity={0.3} dot={{ r: 4, cursor: 'pointer', onClick: (props: any) => handleBarClick(props, 0) }} activeDot={{ r: 8, stroke: colors[0], strokeWidth: 2, cursor: 'pointer', onClick: (props: any) => handleBarClick(props, 0) }} />
                </RechartsAreaChart>
              </ResponsiveContainer>
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
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span className="text-foreground">{value}</span>}
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
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span className="text-foreground">{value}</span>}
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
                  style={{ cursor: 'pointer' }}
                  onClick={(data: any) => handleBarClick(data?.payload || data, 0)}
                />
              </RechartsScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
    
    // Encoded Legend Mode: special rendering with legend sidebar (for both Count and Compare modes)
    // Auto-detect by checking if data has _legendMapping property
    if (sanitizedChartData.length > 0 && sanitizedChartData[0]._legendMapping) {
      const legendMapping = sanitizedChartData[0]._legendMapping as { number: number; label: string; color?: string }[];
      const maxEncodedValue = Math.max(...sanitizedChartData.map(d => d.encodedValue || 0), 1);
      const isCompareEncoded = sanitizedChartData[0]._isCompareEncoded;
      
      // Get field names for labels - handle both count and compare modes
      // Resolve field names properly - if stored names look like IDs (contain hyphens with UUID pattern), re-resolve them
      const resolveFieldName = (storedName: string, fieldId: string | undefined): string => {
        // Check if stored name looks like a UUID (field ID) - 8-4-4-4-12 hex pattern
        const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
        if (storedName && !uuidPattern.test(storedName)) {
          return storedName; // Already a proper name
        }
        // Try to resolve from fieldId
        if (fieldId) {
          const resolved = getFormFieldName(fieldId);
          if (resolved && !uuidPattern.test(resolved)) {
            return resolved;
          }
        }
        return storedName || 'Unknown';
      };
      
      const xAxisFieldName = isCompareEncoded 
        ? resolveFieldName(sanitizedChartData[0].xFieldName, config.metrics?.[0])
        : (config.dimensions?.[0] ? getFormFieldName(config.dimensions[0]) : (config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'Field'));
      const yAxisFieldName = isCompareEncoded
        ? resolveFieldName(sanitizedChartData[0].yFieldName, config.metrics?.[1])
        : (config.dimensions?.[1] ? getFormFieldName(config.dimensions[1]) : 'Value');
      
      return (
        <div className="relative w-full h-full min-h-[300px] flex gap-4">
          {/* Chart Area */}
          <div className="flex-1 relative min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={sanitizedChartData} 
                margin={{ top: 20, right: 20, left: 60, bottom: 80 }}
              >
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  label={{
                    value: xAxisFieldName,
                    position: 'insideBottom',
                    offset: -5
                  }} 
                />
                <YAxis 
                  type="number" 
                  tick={{ fontSize: 11 }}
                  domain={[0, maxEncodedValue + 0.5]}
                  ticks={Array.from({ length: maxEncodedValue }, (_, i) => i + 1)}
                  allowDecimals={false}
                  label={{
                    value: yAxisFieldName,
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10
                  }}
                />
                <Tooltip 
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    // Handle both count mode (rawSecondaryValue) and compare mode (rawYValue)
                    const rawValue = data.rawSecondaryValue || data.rawYValue || '';
                    return (
                      <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                        <div className="font-medium mb-2">{data.name}</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{yAxisFieldName}:</span>
                            <span className="font-semibold">{rawValue}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Code:</span>
                            <span className="font-semibold">{data.encodedValue}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar 
                  dataKey="encodedValue" 
                  name="Encoded Value"
                  style={{ cursor: 'pointer' }}
                  onClick={(data, idx) => handleBarClick(data, idx)}
                  activeBar={{ fillOpacity: 0.8, stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
                >
                  {sanitizedChartData.map((entry, index) => {
                    // Use Y-axis option color if available, otherwise fallback to default colors
                    const barColor = entry._yOptionColor || colors[index % colors.length];
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={barColor} 
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend Sidebar */}
          <div className="w-40 shrink-0 border-l border-border pl-4">
            <div className="text-sm font-semibold mb-3 text-foreground">{yAxisFieldName} Legend</div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {legendMapping.map(({ number, label, color }) => (
                <div key={number} className="flex items-center gap-2 text-sm">
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
                      {number}
                    </div>
                  )}
                  <span className="text-foreground truncate" title={label}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    
    switch (chartType) {
      case 'bar':
        // Bar chart = vertical bars (categories on X-axis, values on Y-axis)
        return <div className="w-full h-[350px]">
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
                      value: config.xAxisLabel || getFormFieldName(primaryMetric),
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
                      value: config.yAxisLabel || 'Value',
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
          </div>;
      case 'column':
        return <div className="w-full h-[350px]">
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
                  value: config.xAxisLabel || getFormFieldName(primaryMetric),
                  position: 'insideBottom',
                  offset: -5
                }} />
                  <YAxis tick={{
                  fontSize: 11
                }} label={{
                  value: config.yAxisLabel || 'Value',
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
          </div>;
      case 'pie':
        return <div className="w-full h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={sanitizedChartData} cx="50%" cy="50%" outerRadius={120} fill="#8884d8" dataKey={primaryMetric} label={({
                  name,
                  value,
                  percent
                }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`} style={{
                  cursor: 'pointer'
                }} onClick={(data, idx) => config.drilldownConfig?.enabled ? handlePieClick(data) : handleBarClick(data, idx)}>
                    {sanitizedChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} style={{
                    cursor: 'pointer'
                  }} />)}
                  </Pie>
                  <Tooltip 
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      const numValue = Number(data[primaryMetric]) || 0;
                      const total = sanitizedChartData.reduce((sum, item) => sum + (Number(item[primaryMetric]) || 0), 0);
                      const percentage = total > 0 ? ((numValue / total) * 100).toFixed(1) : '0';
                      return (
                        <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                          <div className="font-medium mb-2">{data.name || 'Unknown'}</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Value:</span>
                              <span className="font-semibold">{numValue}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Percentage:</span>
                              <span className="font-semibold">{percentage}%</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-2 pt-1 border-t border-border">
                            Click slice to view records
                          </div>
                        </div>
                      );
                    }}
                  />
                   
              </RechartsPieChart>
              </ResponsiveContainer>
          </div>;
      case 'donut':
        return <div className="w-full h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={sanitizedChartData} cx="50%" cy="50%" innerRadius={config.innerRadius || 60} outerRadius={120} fill="#8884d8" dataKey={primaryMetric} label={({
                  name,
                  value,
                  percent
                }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`} style={{ cursor: 'pointer' }} onClick={(data, idx) => handleBarClick(data, idx)}>
                    {sanitizedChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} style={{ cursor: 'pointer' }} />)}
                  </Pie>
                   <Tooltip 
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      const numValue = Number(data[primaryMetric]) || 0;
                      const total = sanitizedChartData.reduce((sum, item) => sum + (Number(item[primaryMetric]) || 0), 0);
                      const percentage = total > 0 ? ((numValue / total) * 100).toFixed(1) : '0';
                      return (
                        <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                          <div className="font-medium mb-2">{data.name || 'Unknown'}</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Value:</span>
                              <span className="font-semibold">{numValue}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Percentage:</span>
                              <span className="font-semibold">{percentage}%</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-2 pt-1 border-t border-border">
                            Click slice to view records
                          </div>
                        </div>
                      );
                    }}
                  />
                   
                </RechartsPieChart>
              </ResponsiveContainer>
          </div>;
      case 'line':
        return <div className="w-full h-[350px]">
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
                  value: config.xAxisLabel || getFormFieldName(primaryMetric),
                  position: 'insideBottom',
                  offset: -5
                }} />
                  <YAxis tick={{
                  fontSize: 11
                }} label={{
                  value: config.yAxisLabel || 'Value',
                  angle: -90,
                  position: 'insideLeft'
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} ticks={getYAxisTicks(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                  <Tooltip 
                    content={({ payload, label }) => {
                      if (!payload || payload.length === 0) return null;
                      return (
                        <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                          <div className="font-medium mb-2">{label || 'Data Point'}</div>
                          <div className="space-y-1 text-sm">
                            {payload.map((entry: any, idx: number) => {
                              const displayName = isMultiDimensional ? entry.name : getFormFieldName(entry.dataKey || entry.name);
                              return (
                                <div key={idx} className="flex justify-between gap-4">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    {displayName}:
                                  </span>
                                  <span className="font-semibold">{entry.value}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-2 pt-1 border-t border-border">
                            Click point to view records
                          </div>
                        </div>
                      );
                    }}
                  />
                   
                   {isMultiDimensional ?
                // Render separate lines for each dimension value
                dimensionKeys.map((key, index) => <Line key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} strokeWidth={3} name={key} dot={{
                  fill: colors[index % colors.length],
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2,
                  r: 5,
                  cursor: 'pointer',
                  onClick: (props: any) => handleBarClick(props, index)
                }} activeDot={(props: any) => (
                  <circle 
                    cx={props.cx} 
                    cy={props.cy} 
                    r={8} 
                    fill={colors[index % colors.length]} 
                    stroke="hsl(var(--background))" 
                    strokeWidth={2} 
                    cursor="pointer"
                    onClick={() => handleBarClick(props, index)}
                  />
                )} />) :
                // Single dimension - render primary metric and additional metrics if any
                <>
                        <Line type="monotone" dataKey={primaryMetric} stroke={colors[0]} strokeWidth={3} name={getFormFieldName(primaryMetric)} dot={{
                    fill: colors[0],
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                    r: 5,
                    cursor: 'pointer',
                    onClick: (props: any) => handleBarClick(props, 0)
                  }} activeDot={(props: any) => (
                    <circle 
                      cx={props.cx} 
                      cy={props.cy} 
                      r={8} 
                      fill={colors[0]} 
                      stroke="hsl(var(--background))" 
                      strokeWidth={2} 
                      cursor="pointer"
                      onClick={() => handleBarClick(props, 0)}
                    />
                  )} />
                        {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => <Line key={metric} type="monotone" dataKey={metric} stroke={colors[(index + 1) % colors.length]} strokeWidth={3} name={getFormFieldName(metric)} dot={{
                    fill: colors[(index + 1) % colors.length],
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                    r: 5,
                    cursor: 'pointer',
                    onClick: (props: any) => handleBarClick(props, index + 1)
                  }} activeDot={(props: any) => (
                    <circle 
                      cx={props.cx} 
                      cy={props.cy} 
                      r={8} 
                      fill={colors[(index + 1) % colors.length]} 
                      stroke="hsl(var(--background))" 
                      strokeWidth={2} 
                      cursor="pointer"
                      onClick={() => handleBarClick(props, index + 1)}
                    />
                  )} />)}
                     </>}
                </RechartsLineChart>
              </ResponsiveContainer>
          </div>;
      case 'area':
        return <div className="w-full h-[350px]">
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
                  value: config.xAxisLabel || getFormFieldName(primaryMetric),
                  position: 'insideBottom',
                  offset: -5
                }} />
                  <YAxis tick={{
                  fontSize: 11
                }} label={{
                  value: config.yAxisLabel || 'Value',
                  angle: -90,
                  position: 'insideLeft'
                }} domain={getYAxisDomain(sanitizedChartData, primaryMetric)} ticks={getYAxisTicks(sanitizedChartData, primaryMetric)} allowDataOverflow={false} />
                  <Tooltip 
                    content={({ payload, label }) => {
                      if (!payload || payload.length === 0) return null;
                      return (
                        <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                          <div className="font-medium mb-2">{label || 'Data Point'}</div>
                          <div className="space-y-1 text-sm">
                            {payload.map((entry: any, idx: number) => {
                              const displayName = getFormFieldName(entry.dataKey || entry.name);
                              return (
                                <div key={idx} className="flex justify-between gap-4">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                                    {displayName}:
                                  </span>
                                  <span className="font-semibold">{entry.value}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-2 pt-1 border-t border-border">
                            Click point to view records
                          </div>
                        </div>
                      );
                    }}
                  />
                   
                   <Area type="monotone" dataKey={primaryMetric} stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} name={getFormFieldName(primaryMetric)} dot={{ r: 5, fill: colors[0], stroke: 'hsl(var(--background))', strokeWidth: 2, cursor: 'pointer', onClick: (props: any) => handleBarClick(props, 0) }} activeDot={(props: any) => (
                    <circle 
                      cx={props.cx} 
                      cy={props.cy} 
                      r={8} 
                      fill={colors[0]} 
                      stroke="hsl(var(--background))" 
                      strokeWidth={2} 
                      cursor="pointer"
                      onClick={() => handleBarClick(props, 0)}
                    />
                  )} />
                   {config.metrics && config.metrics.length > 1 && config.metrics.slice(1).map((metric, index) => <Area key={metric} type="monotone" dataKey={metric} stroke={colors[(index + 1) % colors.length]} fill={colors[(index + 1) % colors.length]} fillOpacity={0.6} name={getFormFieldName(metric)} dot={{ r: 5, fill: colors[(index + 1) % colors.length], stroke: 'hsl(var(--background))', strokeWidth: 2, cursor: 'pointer', onClick: (props: any) => handleBarClick(props, index + 1) }} activeDot={(props: any) => (
                    <circle 
                      cx={props.cx} 
                      cy={props.cy} 
                      r={8} 
                      fill={colors[(index + 1) % colors.length]} 
                      stroke="hsl(var(--background))" 
                      strokeWidth={2} 
                      cursor="pointer"
                      onClick={() => handleBarClick(props, index + 1)}
                    />
                )} />)}
                </RechartsAreaChart>
              </ResponsiveContainer>
          </div>;
      case 'scatter':
        // Scatter plot always uses x and y from processCompareData
        const scatterXLabel = config.xAxisLabel || (config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'X-Axis');
        const scatterYLabel = config.yAxisLabel || (config.metrics?.[1] ? getFormFieldName(config.metrics[1]) : 'Y-Axis');
        
        return <div className="w-full h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsScatterChart margin={{
                top: 20,
                right: 30,
                left: 60,
                bottom: 80
              }}>
                  <XAxis 
                    type="number"
                    dataKey="x" 
                    tick={{ fontSize: 11 }} 
                    name={scatterXLabel}
                    label={{
                      value: scatterXLabel,
                      position: 'insideBottom',
                      offset: -5
                    }} 
                    domain={['auto', 'auto']}
                  />
                  <YAxis 
                    type="number"
                    dataKey="y" 
                    tick={{ fontSize: 11 }} 
                    name={scatterYLabel}
                    label={{
                      value: scatterYLabel,
                      angle: -90,
                      position: 'insideLeft'
                    }} 
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      return (
                        <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                          <div className="font-medium mb-2">{data.name || 'Data Point'}</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{scatterXLabel}:</span>
                              <span className="font-semibold">{data.x}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{scatterYLabel}:</span>
                              <span className="font-semibold">{data.y}</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-2 pt-1 border-t border-border">
                            Click point to view records
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter 
                    data={sanitizedChartData} 
                    fill={colors[0]} 
                    style={{ cursor: 'pointer' }} 
                    onClick={(data: any) => handleBarClick(data, 0)}
                  />
                </RechartsScatterChart>
              </ResponsiveContainer>
          </div>;
      case 'bubble':
        // Bubble chart uses x, y from processCompareData and sizeField for bubble size
        const bubbleSizeField = config.sizeField;
        const bubbleXLabel = config.xAxisLabel || (config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'X-Axis');
        const bubbleYLabel = config.yAxisLabel || (config.metrics?.[1] ? getFormFieldName(config.metrics[1]) : 'Y-Axis');
        const bubbleSizeLabel = bubbleSizeField ? getFormFieldName(bubbleSizeField) : 'Size';
        
        const bubbleData = sanitizedChartData.map(item => {
          const sizeValue = bubbleSizeField ? (item[bubbleSizeField] || 10) : 10;
          return {
            ...item,
            size: typeof sizeValue === 'number' ? sizeValue : 10
          };
        });
        
        // Calculate size scale
        const maxSize = Math.max(...bubbleData.map(d => d.size), 1);
        const minSize = Math.min(...bubbleData.map(d => d.size), 0);
        const sizeScale = (size: number) => {
          const normalized = maxSize === minSize ? 0.5 : (size - minSize) / (maxSize - minSize);
          return 5 + normalized * 25; // Size range from 5 to 30
        };
        
        return <div className="w-full h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsScatterChart margin={{ top: 20, right: 30, left: 60, bottom: 80 }}>
                    <XAxis 
                      type="number" 
                      dataKey="x"
                      tick={{ fontSize: 11 }}
                      name={bubbleXLabel}
                      label={{ value: bubbleXLabel, position: 'insideBottom', offset: -5 }}
                      domain={['auto', 'auto']}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y"
                      tick={{ fontSize: 11 }}
                      name={bubbleYLabel}
                      label={{ value: bubbleYLabel, angle: -90, position: 'insideLeft' }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ payload }) => {
                        if (!payload || payload.length === 0) return null;
                        const data = payload[0]?.payload;
                        if (!data) return null;
                        return (
                          <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3 min-w-[180px]">
                            <div className="font-medium mb-2">{data.name || 'Data Point'}</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">{bubbleXLabel}:</span>
                                <span className="font-semibold">{data.x}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">{bubbleYLabel}:</span>
                                <span className="font-semibold">{data.y}</span>
                              </div>
                              {bubbleSizeField && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">{bubbleSizeLabel}:</span>
                                  <span className="font-semibold">{data.size}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-2 pt-1 border-t border-border">
                              Click bubble to view records
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Scatter 
                      data={bubbleData} 
                      fill={colors[0]}
                      style={{ cursor: 'pointer' }}
                    >
                      {bubbleData.map((entry, index) => (
                        <Cell 
                          key={`bubble-${index}`}
                          fill={colors[index % colors.length]}
                          onClick={() => handleBarClick(entry, index)}
                        />
                      ))}
                    </Scatter>
                </RechartsScatterChart>
              </ResponsiveContainer>
          </div>;
      case 'heatmap':
        // Heatmap uses two dimensions (rows and columns) and an intensity value
        const rowDimension = config.dimensions?.[0];
        const colDimension = config.dimensions?.[1];
        const intensityField = config.heatmapIntensityField || primaryMetric || 'value';
        
        // Get unique row and column values
        const uniqueRows = [...new Set(sanitizedChartData.map(d => d.rowValue || d.name || 'Unknown'))];
        const uniqueCols = [...new Set(sanitizedChartData.map(d => d.colValue || 'Default'))];
        
        // If data doesn't have row/col structure, use simple grid fallback
        const hasProperStructure = sanitizedChartData.length > 0 && (sanitizedChartData[0].rowValue || sanitizedChartData[0].colValue);
        
        if (!hasProperStructure) {
          // Fallback: simple grid based on index
          const gridCols = config.gridColumns || Math.ceil(Math.sqrt(sanitizedChartData.length));
          const heatmapDataSimple = sanitizedChartData.map((item, index) => {
            const rawValue = item[intensityField] || item.value || 0;
            const safeValue = typeof rawValue === 'number' && isFinite(rawValue) ? rawValue : 0;
            return {
              ...item,
              x: index % gridCols,
              y: Math.floor(index / gridCols),
              value: safeValue
            };
          });
          const maxValueSimple = Math.max(...heatmapDataSimple.map(d => d.value), 1);
          const minValueSimple = Math.min(...heatmapDataSimple.map(d => d.value).filter(v => v > 0), 0);
          const dimensionLabel = getFormFieldName(config.dimensions?.[0] || 'Category');
          const intensityLabel = intensityField ? getFormFieldName(intensityField) : 'Value';
          const effectiveAgg = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
          
          return <div className="relative w-full h-full flex flex-col">
              <div className="text-sm text-muted-foreground mb-3">
                <span className="font-medium">{dimensionLabel}</span>
                <span className="text-xs ml-2">(Intensity: {intensityLabel}, Aggregation: {effectiveAgg})</span>
              </div>
              <div className="flex-1 min-h-0 grid gap-1" style={{
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${Math.ceil(heatmapDataSimple.length / gridCols)}, 1fr)`
              }}>
                {heatmapDataSimple.map((cell, index) => {
                  const intensity = cell.value / maxValueSimple;
                  const intensityPercent = (intensity * 100).toFixed(1);
                  const colorIndex = Math.floor(intensity * (colors.length - 1));
                  const safeColorIndex = Math.max(0, Math.min(colors.length - 1, isNaN(colorIndex) ? 0 : colorIndex));
                  
                  return (
                    <HeatmapCell
                      key={index}
                      rowLabel={dimensionLabel}
                      colLabel="Category"
                      rowValue={cell.name}
                      colValue="Default"
                      cellValue={cell.value}
                      cellCount={1}
                      intensityLabel={intensityLabel}
                      aggregation={effectiveAgg}
                      intensityPercent={intensityPercent}
                      maxValue={maxValueSimple}
                      backgroundColor={colors[safeColorIndex]}
                      textColor={intensity > 0.5 ? 'white' : 'black'}
                      onClick={() => handleHeatmapCellClick(cell.name, 'Default', config.dimensions?.[0], config.dimensions?.[1])}
                    />
                  );
                })}
              </div>
              {/* Color scale legend */}
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Low</span>
                <div className="flex h-3 rounded overflow-hidden flex-1 max-w-[200px]">
                  {colors.map((color, idx) => (
                    <div key={idx} style={{ backgroundColor: color, flex: 1 }} />
                  ))}
                </div>
                <span>High</span>
                <span className="ml-2 text-muted-foreground/70">({minValueSimple.toLocaleString()} - {maxValueSimple.toLocaleString()})</span>
              </div>
            </div>;
        }
        
        // Proper heatmap with row/column structure
        const heatmapMatrix: { [key: string]: { [key: string]: { value: number; count: number } } } = {};
        sanitizedChartData.forEach(item => {
          const row = item.rowValue || item.name || 'Unknown';
          const col = item.colValue || 'Default';
          const val = item[intensityField] || item.value || 0;
          if (!heatmapMatrix[row]) heatmapMatrix[row] = {};
          if (!heatmapMatrix[row][col]) {
            heatmapMatrix[row][col] = { value: 0, count: 0 };
          }
          heatmapMatrix[row][col].value += val;
          heatmapMatrix[row][col].count += 1;
        });
        
        const allValues = Object.values(heatmapMatrix).flatMap(row => 
          Object.values(row).map(cell => cell.value)
        );
        const maxValue = Math.max(...allValues, 1);
        const minValue = Math.min(...allValues.filter(v => v > 0), 0);
        const rowLabels = Object.keys(heatmapMatrix);
        const colLabels = [...new Set(sanitizedChartData.map(d => d.colValue || 'Default'))];
        
        const rowLabel = rowDimension ? getFormFieldName(rowDimension) : 'Rows';
        const colLabel = colDimension ? getFormFieldName(colDimension) : 'Columns';
        const intensityLabel = intensityField ? getFormFieldName(intensityField) : 'Value';
        const effectiveAgg = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
        
        // Calculate dynamic cell size to fill container
        const numRows = rowLabels.length;
        const numCols = colLabels.length;
        
        return <div className="relative w-full h-full flex flex-col overflow-auto">
            {/* Header with title and color scale legend */}
            <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{rowLabel}</span> × <span className="font-medium">{colLabel}</span>
                <span className="text-xs ml-2">(Intensity: {intensityLabel}, Aggregation: {effectiveAgg})</span>
              </div>
              {/* Color scale legend - moved to top */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Low</span>
                <div className="flex h-3 rounded overflow-hidden w-[120px]">
                  {colors.map((color, idx) => (
                    <div key={idx} style={{ backgroundColor: color, flex: 1 }} />
                  ))}
                </div>
                <span>High</span>
                <span className="ml-1 text-muted-foreground/70 text-[10px]">({minValue.toLocaleString()}-{maxValue.toLocaleString()})</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <div className="w-full h-full" style={{ display: 'grid', gridTemplateColumns: `minmax(120px, max-content) repeat(${numCols}, 1fr)`, gridTemplateRows: `auto repeat(${numRows}, 1fr)`, gap: '2px' }}>
                {/* Empty corner cell */}
                <div className="flex items-end justify-end p-1 text-[10px] font-medium text-muted-foreground max-w-[180px]">
                  <span className="truncate">{rowLabel} ↓</span>
                </div>
                {/* Column Headers */}
                {colLabels.map((col, idx) => (
                  <div key={idx} className="flex items-center justify-center p-1 text-xs font-medium text-center truncate bg-muted/30 rounded-t" title={col}>
                    {col}
                  </div>
                ))}
                {/* Rows with data cells */}
                {rowLabels.map((row, rowIdx) => (
                  <React.Fragment key={rowIdx}>
                    {/* Row label */}
                    <div className="flex items-center justify-end pr-2 text-xs font-medium bg-muted/30 rounded-l max-w-[180px] min-w-[120px]" title={row}>
                      <span className="truncate">{row}</span>
                    </div>
                    {/* Data cells */}
                    {colLabels.map((col, colIdx) => {
                      const cellData = heatmapMatrix[row]?.[col] || { value: 0, count: 0 };
                      const cellValue = cellData.value;
                      const cellCount = cellData.count;
                      const intensity = cellValue / maxValue;
                      const intensityPercent = (intensity * 100).toFixed(1);
                      const colorIndex = Math.floor(intensity * (colors.length - 1));
                      const safeColorIndex = Math.max(0, Math.min(colors.length - 1, isNaN(colorIndex) ? 0 : colorIndex));
                      
                      return (
                        <HeatmapCell
                          key={colIdx}
                          rowLabel={rowLabel}
                          colLabel={colLabel}
                          rowValue={row}
                          colValue={col}
                          cellValue={cellValue}
                          cellCount={cellCount}
                          intensityLabel={intensityLabel}
                          aggregation={effectiveAgg}
                          intensityPercent={intensityPercent}
                          maxValue={maxValue}
                          backgroundColor={colors[safeColorIndex]}
                          textColor={intensity > 0.5 ? 'white' : 'black'}
                          onClick={() => handleHeatmapCellClick(row, col, rowDimension, colDimension)}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>;
      case 'table': {
        // Get chart info for display
        const tableChartInfo = getChartInfoSummary();
        const effectiveAggregation = config.metricAggregations?.[0]?.aggregation || config.aggregation || 'count';
        const isCompareMode = config.compareMode && config.metrics && config.metrics.length === 2;
        const isCountMode = effectiveAggregation === 'count' && !isCompareMode;
        
        // Get dimension label
        const dimensionField = config.dimensions?.[0] || config.xAxis;
        const dimensionLabel = dimensionField ? getFormFieldName(dimensionField) : 'Category';
        
        // Determine all column keys from data (for grouped/stacked charts)
        const allKeys = new Set<string>();
        sanitizedChartData.forEach(row => {
          Object.keys(row).forEach(key => {
            if (key !== 'name' && key !== 'value' && key !== 'submissionId' && 
                key !== 'encodedValue' && key !== 'rawSecondaryValue' && key !== 'rawYValue' &&
                key !== '_legendMapping' && key !== '_isCompareEncoded' &&
                key !== 'x' && key !== 'y' && key !== 'xRaw' && key !== 'yRaw' &&
                key !== 'xFieldName' && key !== 'yFieldName' && key !== 'count') {
              allKeys.add(key);
            }
          });
        });
        const dataKeys = Array.from(allKeys);
        const hasGroupedData = dataKeys.length > 0 && !dataKeys.includes(primaryMetric);
        
        // Calculate totals for each column
        const columnTotals: { [key: string]: number } = {};
        let grandTotal = 0;
        
        if (hasGroupedData) {
          dataKeys.forEach(key => {
            columnTotals[key] = sanitizedChartData.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
            grandTotal += columnTotals[key];
          });
        } else {
          // For single metric charts
          const metricsToUse = config.metrics && config.metrics.length > 0 ? config.metrics : [primaryMetric];
          metricsToUse.forEach(metric => {
            columnTotals[metric] = sanitizedChartData.reduce((sum, row) => sum + (Number(row[metric]) || Number(row.value) || 0), 0);
            grandTotal += columnTotals[metric];
          });
        }
        
        // Get aggregation label
        const getAggregationLabel = (agg: string): string => {
          const labels: { [key: string]: string } = {
            count: 'Count',
            sum: 'Sum',
            avg: 'Average',
            min: 'Minimum',
            max: 'Maximum',
            median: 'Median'
          };
          return labels[agg] || agg.charAt(0).toUpperCase() + agg.slice(1);
        };
        
        // Compare mode table
        if (isCompareMode) {
          const field1 = config.metrics?.[0] || '';
          const field2 = config.metrics?.[1] || '';
          const field1Name = getFormFieldName(field1);
          const field2Name = getFormFieldName(field2);
          
          return (
            <div className="overflow-auto">
              {/* Table Header Info */}
              <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Compare Mode
                  </span>
                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    X-Axis: {field1Name}
                  </span>
                  <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    Y-Axis: {field2Name}
                  </span>
                  {dimensionField && (
                    <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                      Grouped by: {dimensionLabel}
                    </span>
                  )}
                </div>
              </div>
              
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                      {dimensionLabel || 'Record'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                      {field1Name} (X)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                      {field2Name} (Y)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {sanitizedChartData.map((row, index) => (
                    <tr key={index} className="hover:bg-muted/50 cursor-pointer" onClick={() => {
                      setCellSubmissionsDialog({
                        open: true,
                        dimensionField: field1,
                        dimensionValue: row.name || String(row.x),
                        dimensionLabel: field1Name,
                      });
                    }}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                        {row.name || `Record ${index + 1}`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums">
                        {typeof row.x === 'number' ? row.x.toLocaleString() : (row.xRaw || row.x)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums">
                        {typeof row.y === 'number' ? row.y.toLocaleString() : (row.yRaw || row.y)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        
        // Grouped/Stacked data table (when groupByField is used)
        if (hasGroupedData) {
          return (
            <div className="overflow-auto">
              {/* Table Header Info */}
              <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {getAggregationLabel(effectiveAggregation)}
                  </span>
                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Grouped by: {dimensionLabel}
                  </span>
                  {config.groupByField && (
                    <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Segmented by: {getFormFieldName(config.groupByField)}
                    </span>
                  )}
                  {config.dimensions?.[1] && (
                    <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Stacked by: {getFormFieldName(config.dimensions[1])}
                    </span>
                  )}
                </div>
              </div>
              
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                      {dimensionLabel}
                    </th>
                    {dataKeys.map(key => (
                      <th key={key} className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider bg-muted/80">
                      Row Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider bg-muted/80">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {sanitizedChartData.map((row, index) => {
                    const rowTotal = dataKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
                    const rowPercentage = grandTotal > 0 ? ((rowTotal / grandTotal) * 100).toFixed(1) : '0.0';
                    
                    return (
                      <tr 
                        key={index} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          const dimField = config.dimensions?.[0] || config.xAxis || '';
                          setCellSubmissionsDialog({
                            open: true,
                            dimensionField: dimField,
                            dimensionValue: row.name,
                            dimensionLabel: dimensionLabel,
                          });
                        }}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                          {row.name}
                        </td>
                        {dataKeys.map(key => (
                          <td key={key} className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums">
                            {typeof row[key] === 'number' 
                              ? (effectiveAggregation === 'avg' || effectiveAggregation === 'median' 
                                  ? row[key].toFixed(2) 
                                  : row[key].toLocaleString())
                              : (row[key] ?? '-')}
                          </td>
                        ))}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums font-semibold bg-muted/30">
                          {effectiveAggregation === 'avg' || effectiveAggregation === 'median' 
                            ? rowTotal.toFixed(2) 
                            : rowTotal.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums bg-muted/30">
                          {rowPercentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer with column totals */}
                <tfoot className="bg-muted/70">
                  <tr className="font-semibold">
                    <td className="px-4 py-3 text-sm text-foreground">
                      Total
                    </td>
                    {dataKeys.map(key => (
                      <td key={key} className="px-4 py-3 text-sm text-right tabular-nums">
                        {effectiveAggregation === 'avg' || effectiveAggregation === 'median' 
                          ? columnTotals[key]?.toFixed(2) 
                          : columnTotals[key]?.toLocaleString()}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm text-right tabular-nums bg-primary/10 font-bold">
                      {effectiveAggregation === 'avg' || effectiveAggregation === 'median' 
                        ? grandTotal.toFixed(2) 
                        : grandTotal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums bg-primary/10 font-bold">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        }
        
        // Standard single-metric table
        const metricsToDisplay = config.metrics && config.metrics.length > 0 ? config.metrics : [primaryMetric];
        const singleMetricTotal = sanitizedChartData.reduce((sum, row) => {
          return sum + metricsToDisplay.reduce((mSum, m) => mSum + (Number(row[m]) || Number(row.value) || 0), 0);
        }, 0);
        
        return (
          <div className="overflow-auto">
            {/* Table Header Info */}
            <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {getAggregationLabel(effectiveAggregation)}
                  {!isCountMode && metricsToDisplay[0] && `: ${getFormFieldName(metricsToDisplay[0])}`}
                </span>
                <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Grouped by: {dimensionLabel}
                </span>
                <span className="px-2 py-1 rounded bg-muted text-muted-foreground border border-border">
                  {sanitizedChartData.length} categories
                </span>
              </div>
            </div>
            
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    {dimensionLabel}
                  </th>
                  {metricsToDisplay.map(metric => (
                    <th key={metric} className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                      {isCountMode ? 'Count' : `${getAggregationLabel(effectiveAggregation)} of ${getFormFieldName(metric)}`}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider bg-muted/80">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {sanitizedChartData.map((row, index) => {
                  const rowValue = metricsToDisplay.reduce((sum, m) => sum + (Number(row[m]) || Number(row.value) || 0), 0);
                  const percentage = singleMetricTotal > 0 ? ((rowValue / singleMetricTotal) * 100).toFixed(1) : '0.0';
                  
                  return (
                    <tr 
                      key={index} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        const dimField = config.dimensions?.[0] || config.xAxis || '';
                        setCellSubmissionsDialog({
                          open: true,
                          dimensionField: dimField,
                          dimensionValue: row.name,
                          dimensionLabel: dimensionLabel,
                        });
                      }}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                        {row.name}
                      </td>
                      {metricsToDisplay.map(metric => {
                        const value = Number(row[metric]) || Number(row.value) || 0;
                        return (
                          <td key={metric} className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums">
                            {effectiveAggregation === 'avg' || effectiveAggregation === 'median' 
                              ? value.toFixed(2) 
                              : value.toLocaleString()}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums bg-muted/30">
                        {percentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer with total */}
              <tfoot className="bg-muted/70">
                <tr className="font-semibold">
                  <td className="px-4 py-3 text-sm text-foreground">
                    Total
                  </td>
                  {metricsToDisplay.map(metric => (
                    <td key={metric} className="px-4 py-3 text-sm text-right tabular-nums">
                      {effectiveAggregation === 'avg' || effectiveAggregation === 'median' 
                        ? singleMetricTotal.toFixed(2) 
                        : singleMetricTotal.toLocaleString()}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-right tabular-nums bg-primary/10 font-bold">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      }
      default:
        return <div className="flex items-center justify-center h-64 text-muted-foreground">
            Chart type "{chartType}" not implemented yet
          </div>;
    }
  };
  const canDrillUp = drilldownState?.values && drilldownState.values.length > 0;
  const chartInfo = getChartInfoSummary();
  
  return <div ref={chartContainerRef} className="h-full flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 bg-background">
      {/* Chart Info Header - Always visible for context */}
      <div className="mb-4 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <h4 className="font-semibold text-lg text-foreground">{config.title || chartInfo.title}</h4>
          <div className="flex items-center gap-2">
            {/* Export Button */}
            <ChartExportButton
              chartRef={chartContainerRef}
              filename={`${config.title || 'chart'}-${new Date().toISOString().split('T')[0]}`}
              title={config.title || chartInfo.title}
            />
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
        </div>
        
        {/* Info Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Type Badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {chartInfo.chartType.charAt(0).toUpperCase() + chartInfo.chartType.slice(1)} Chart
          </span>
          
          {/* Aggregation Badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {config.crossRefConfig?.enabled ? (
              // Cross-reference mode badges
              chartInfo.aggregation === 'compare' ? (
                <>Compare: {config.crossRefConfig?.compareXFieldId ? getFormFieldName(config.crossRefConfig.compareXFieldId) : 'X'} vs {config.crossRefConfig?.compareYFieldId ? getFormFieldName(config.crossRefConfig.compareYFieldId) : 'Y'}</>
              ) : chartInfo.aggregation === 'count' ? (
                'Count Linked Records'
              ) : chartInfo.aggregation === 'aggregate' ? (
                <>{(config.crossRefConfig?.targetAggregation || 'Sum').charAt(0).toUpperCase() + (config.crossRefConfig?.targetAggregation || 'sum').slice(1)}: {config.crossRefConfig?.targetMetricFieldId ? getFormFieldName(config.crossRefConfig.targetMetricFieldId) : 'Value'}</>
              ) : (
                chartInfo.aggregation.charAt(0).toUpperCase() + chartInfo.aggregation.slice(1)
              )
            ) : (
              // Regular mode badges
              chartInfo.aggregation === 'compare' ? (
                <>Compare: {config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'Field 1'} - {config.metrics?.[1] ? getFormFieldName(config.metrics[1]) : 'Field 2'}</>
              ) : chartInfo.aggregation === 'count' ? 'Count' : (
                <>{chartInfo.aggregation.charAt(0).toUpperCase() + chartInfo.aggregation.slice(1)}: {config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'Records'}</>
              )
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
        
        {/* Drilldown Mode Toggle - shown when drilldown is enabled (not for Compare mode) */}
        {(config.drilldownConfig?.enabled || (config.crossRefConfig?.drilldownEnabled && config.crossRefConfig?.mode !== 'compare')) && (
          <div className="flex items-center gap-3 mt-3 p-2 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Switch
                id="drilldown-mode-toggle"
                checked={isDrilldownModeActive}
                onCheckedChange={setIsDrilldownModeActive}
              />
              <Label htmlFor="drilldown-mode-toggle" className="text-sm font-medium cursor-pointer">
                {isDrilldownModeActive ? (
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Drilldown Mode
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    View Records Mode
                  </span>
                )}
              </Label>
            </div>
            <span className="text-xs text-muted-foreground">
              {isDrilldownModeActive 
                ? 'Click chart to filter data by hierarchy' 
                : 'Click chart to view underlying records'}
            </span>
          </div>
        )}
        
        {/* Drilldown Active Filter - supports both normal and cross-reference drilldown */}
        {drilldownState?.values && drilldownState.values.length > 0 && <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 mt-3">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Filtered by:</span>
            <div className="flex items-center gap-1 flex-wrap">
              {drilldownState.values.map((value, index) => {
                // Support both normal drilldownConfig and crossRefConfig drilldown levels
                const drilldownLevels = config.drilldownConfig?.drilldownLevels || config.crossRefConfig?.drilldownLevels || [];
                const fieldName = getFormFieldName(drilldownLevels[index] || '');
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
        
        {/* Show drilldown button for both normal and cross-ref drilldown */}
        {(config.drilldownConfig?.enabled || (config.crossRefConfig?.enabled && config.crossRefConfig?.drilldownEnabled)) && <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setShowDrilldownPanel(!showDrilldownPanel)}>
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
          
      {/* Drilldown Panel - supports both normal and cross-reference drilldown */}
      {(config.drilldownConfig?.enabled || (config.crossRefConfig?.enabled && config.crossRefConfig?.drilldownEnabled)) && showDrilldownPanel && <div className="mb-4 p-3 bg-muted/30 rounded-lg border flex-shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {config.crossRefConfig?.enabled ? 'Cross-Reference Drilldown' : 'Drilldown Controls'}
                  </span>
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
                
                {/* Drilldown Level Selector - only for normal drilldown */}
                {!config.crossRefConfig?.enabled && currentLevelInfo && <div className="flex items-center gap-2">
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
                
                {/* Cross-ref drilldown info */}
                {config.crossRefConfig?.enabled && config.crossRefConfig?.drilldownLevels && (
                  <div className="text-sm text-muted-foreground">
                    <span>Click chart bars to drill down through: </span>
                    {config.crossRefConfig.drilldownLevels.map((levelId, idx) => (
                      <span key={levelId}>
                        {idx > 0 && ' → '}
                        <span className="font-medium">{getFormFieldName(levelId)}</span>
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Reset Drilldown Button */}
                {drilldownState?.values?.length > 0 && <Button size="sm" variant="outline" onClick={resetDrilldown}>
                    Reset to All Records
                  </Button>}
              </div>
            </div>}
          
      {/* Collapsed drilldown breadcrumb - supports both normal and cross-reference drilldown */}
      {(config.drilldownConfig?.enabled || (config.crossRefConfig?.enabled && config.crossRefConfig?.drilldownEnabled)) && !showDrilldownPanel && <div className="flex items-center gap-2 flex-shrink-0 mb-4">
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
          
          {/* Reset button in collapsed view */}
          {drilldownState?.values?.length > 0 && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={resetDrilldown}>
              Reset
            </Button>
          )}
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
                      : config.metrics?.[0] ? getFormFieldName(config.metrics[0]) : 'Name')}
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
                          // Compare mode: handle both regular compare and encoded compare data
                          // For encoded compare mode: use 'name' as X value and 'rawYValue' as Y value
                          // For regular compare mode: use 'xRaw'/'x' as X and 'yRaw'/'y' as Y
                          const isEncodedCompare = item._isCompareEncoded;
                          
                          let displayX: string | number;
                          let displayY: string | number;
                          
                          if (isEncodedCompare) {
                            // Encoded compare mode: name is the X value, rawYValue is the Y value
                            displayX = item.name || '';
                            displayY = item.rawYValue || '';
                          } else {
                            // Regular compare mode
                            displayX = item.xRaw !== undefined && item.xRaw !== '' ? item.xRaw : (typeof item.x === 'number' ? item.x.toLocaleString() : (item.x ?? ''));
                            displayY = item.yRaw !== undefined && item.yRaw !== '' ? item.yRaw : (typeof item.y === 'number' ? item.y.toLocaleString() : (item.y ?? ''));
                          }
                          
                          // Always show dialog first with View button
                          const handleCellClick = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setCellSubmissionsDialog({
                              open: true,
                              dimensionField,
                              dimensionValue: item.name,
                              dimensionLabel,
                              submissionId: item.submissionId, // Pass submissionId to show just this record
                            });
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
        submissionId={cellSubmissionsDialog.submissionId}
        displayFields={config.displayFields || []}
        fieldLabels={formFields.reduce((acc, field) => {
          acc[field.id] = field.label || field.id;
          return acc;
        }, {} as Record<string, string>)}
        crossRefTargetFormId={cellSubmissionsDialog.crossRefTargetFormId}
        crossRefDisplayFields={cellSubmissionsDialog.crossRefDisplayFields}
        crossRefLinkedIds={cellSubmissionsDialog.crossRefLinkedIds}
      />
    </div>;
}