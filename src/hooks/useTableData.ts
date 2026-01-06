import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { evaluateFilterCondition, extractComparableValue } from '@/utils/filterUtils';

interface SubmissionRow {
  id: string;
  form_id: string;
  submission_data: Record<string, any>;
  submitted_at: string;
  submitted_by: string;
  submission_ref_id: string;
  approval_status?: string;
  approved_by?: string;
  approval_timestamp?: string;
}

interface FilterCondition {
  field: string;
  operator: string;
  value: any;
}

interface FilterGroup {
  conditions: FilterCondition[];
  logic?: 'AND' | 'OR';
  logicExpression?: string;
}

interface DrilldownFilter {
  field: string;
  operator: string;
  value: string;
}

interface JoinDefinition {
  id: string;
  secondaryFormId: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  primaryFieldId: string;
  secondaryFieldId: string;
  alias?: string;
}

interface JoinConfig {
  enabled: boolean;
  joins: JoinDefinition[];
}

export function useTableData(
  formId: string, 
  filters: FilterGroup[], 
  pageSize: number = 50, 
  drilldownFilters: DrilldownFilter[] = [],
  joinConfig?: JoinConfig
) {
  const [data, setData] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Use refs to track stable versions of filters/config
  const filtersRef = useRef(JSON.stringify(filters));
  const drilldownFiltersRef = useRef(JSON.stringify(drilldownFilters));
  const joinConfigRef = useRef(JSON.stringify(joinConfig));
  const hasInitialLoad = useRef(false);

  const loadData = useCallback(async (
    currentFilters: FilterGroup[],
    currentDrilldownFilters: DrilldownFilter[],
    currentJoinConfig?: JoinConfig
  ) => {
    if (!formId) {
      setData([]);
      setTotalCount(0);
      return;
    }

    try {
      setLoading(true);

      // Get total count first - simple query
      const countResult = await supabase
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', formId);

      if (countResult.error) {
        console.error('Error counting submissions:', countResult.error);
        return;
      }

      const totalRecords = countResult.count || 0;
      setTotalCount(totalRecords);

      // Get paginated data
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId);

      const dataResult = await dataQuery
        .range(from, to)
        .order('submitted_at', { ascending: false });

      if (dataResult.error) {
        console.error('Error loading submissions:', dataResult.error);
        return;
      }

      // Transform data with explicit typing
      const submissions = dataResult.data || [];
      let transformedData: SubmissionRow[] = submissions.map(row => ({
        id: row.id || '',
        form_id: row.form_id || '',
        submission_data: (typeof row.submission_data === 'object' && row.submission_data !== null) 
          ? row.submission_data as Record<string, any> 
          : {},
        submitted_at: row.submitted_at || '',
        submitted_by: row.submitted_by || '',
        submission_ref_id: row.submission_ref_id || '',
        approval_status: row.approval_status || 'pending',
        approved_by: row.approved_by || '',
        approval_timestamp: row.approval_timestamp || ''
      }));

      // Apply configured filters (from builder / Add Table UI)
      if (currentFilters && currentFilters.length > 0) {
        const matchesCondition = (row: SubmissionRow, condition: FilterCondition): boolean => {
          if (!condition.field) return true;

          const rawValue = row.submission_data?.[condition.field];
          const target = condition.value;
          const targetStr = target !== undefined && target !== null ? target.toString() : '';

          return evaluateFilterCondition(rawValue, condition.operator, targetStr);
        };

        // Helper to evaluate logic expression like "1 AND 2 OR 3", "(1 AND 2) OR 3"
        const evaluateLogicExpression = (expression: string, results: boolean[]): boolean => {
          try {
            // Replace condition numbers with their boolean results
            let expr = expression;
            
            // Replace each number with true/false
            for (let i = results.length; i >= 1; i--) {
              const regex = new RegExp(`\\b${i}\\b`, 'g');
              expr = expr.replace(regex, results[i - 1] ? 'true' : 'false');
            }
            
            // Replace AND/OR with && / ||
            expr = expr.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||').replace(/\bNOT\b/gi, '!');
            
            console.log('Evaluating expression:', expression, '→', expr);
            
            // Safely evaluate the boolean expression
            // eslint-disable-next-line no-new-func
            return new Function(`return ${expr}`)();
          } catch (e) {
            console.error('Failed to evaluate logic expression:', expression, e);
            // Fallback to AND logic
            return results.every(r => r);
          }
        };

        // Evaluate each filter group respecting its logic property or expression
        transformedData = transformedData.filter(row =>
          currentFilters.every(group => {
            if (!group.conditions || group.conditions.length === 0) return true;
            
            // If we have a logicExpression, use it
            if (group.logicExpression) {
              const conditionResults = group.conditions.map(cond => matchesCondition(row, cond));
              return evaluateLogicExpression(group.logicExpression, conditionResults);
            }
            
            // Use the group's logic property (default to AND if not specified)
            const useOrLogic = group.logic === 'OR';
            
            if (useOrLogic) {
              // OR: At least one condition must match
              return group.conditions.some(cond => matchesCondition(row, cond));
            } else {
              // AND: All conditions must match
              return group.conditions.every(cond => matchesCondition(row, cond));
            }
          })
        );
      }

      // Apply joins if configured
      if (currentJoinConfig?.enabled && currentJoinConfig.joins?.length > 0) {
        transformedData = await applyJoins(transformedData, currentJoinConfig.joins);
      }

      // Apply drilldown filters client-side
      if (currentDrilldownFilters && currentDrilldownFilters.length > 0) {
        currentDrilldownFilters.forEach((filter) => {
          if (filter.field && filter.value !== null && filter.value !== undefined) {
            transformedData = transformedData.filter(row => {
              const fieldValue = row.submission_data[filter.field];
              return evaluateFilterCondition(fieldValue, filter.operator || 'equals', filter.value);
            });
          }
        });
      }

      console.log(`Loaded ${transformedData.length} submissions after filtering`);
      setData(transformedData);

    } catch (error) {
      console.error('Error in loadData:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [formId, currentPage, pageSize]);

  // Helper to extract field value with multiple fallback strategies
  const extractFieldValue = (submissionData: Record<string, any>, fieldId: string): any => {
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
      
      // For date objects
      if (value instanceof Date) {
        return value.toISOString().split('T')[0]; // Use date part only for comparison
      }
      
      // For other objects, stringify
      try {
        return JSON.stringify(value).toLowerCase().trim();
      } catch {
        return String(value).toLowerCase().trim();
      }
    }
    
    // Handle numbers - preserve as string for exact matching
    if (typeof value === 'number') {
      // Handle special numeric cases
      if (isNaN(value)) return null;
      if (!isFinite(value)) return null;
      return String(value);
    }
    
    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    
    // Handle string values - normalize but keep original case for text matches
    // Use lowercase for consistent matching
    return String(value).trim().toLowerCase();
  };

  // Check if two normalized values match
  const valuesMatch = (val1: string | null, val2: string | null): boolean => {
    if (val1 === null || val2 === null) return false;
    if (val1 === val2) return true;
    
    // Try numeric comparison for values that look like numbers
    const num1 = parseFloat(val1);
    const num2 = parseFloat(val2);
    if (!isNaN(num1) && !isNaN(num2) && num1 === num2) {
      return true;
    }
    
    // Try partial matching for complex values (multi-select, arrays)
    if (val1.includes('|') || val2.includes('|')) {
      const parts1 = val1.split('|');
      const parts2 = val2.split('|');
      // Check if any part matches
      return parts1.some(p1 => parts2.some(p2 => p1 === p2));
    }
    
    return false;
  };

  // Helper function to apply joins
  const applyJoins = async (primaryData: SubmissionRow[], joins: JoinDefinition[]): Promise<SubmissionRow[]> => {
    let result = [...primaryData];

    for (const join of joins) {
      if (!join.secondaryFormId || !join.primaryFieldId || !join.secondaryFieldId) {
        console.warn('Incomplete join configuration, skipping:', join);
        continue;
      }

      try {
        // Fetch secondary form data
        const { data: secondaryData, error } = await supabase
          .from('form_submissions')
          .select('*')
          .eq('form_id', join.secondaryFormId);

        if (error) {
          console.error('Error fetching secondary form data:', error);
          continue;
        }

        const secondarySubmissions = (secondaryData || []).map(row => ({
          id: row.id || '',
          form_id: row.form_id || '',
          submission_data: (typeof row.submission_data === 'object' && row.submission_data !== null) 
            ? row.submission_data as Record<string, any> 
            : {},
          submitted_at: row.submitted_at || '',
          submitted_by: row.submitted_by || '',
          submission_ref_id: row.submission_ref_id || ''
        }));

        // Perform the join based on join type
        result = performJoin(result, secondarySubmissions, join);
        
      } catch (err) {
        console.error('Error performing join:', err);
      }
    }

    return result;
  };

  // Perform join operation based on type
  const performJoin = (
    primaryData: SubmissionRow[], 
    secondaryData: any[], 
    joinDef: JoinDefinition
  ): SubmissionRow[] => {
    const { joinType, primaryFieldId, secondaryFieldId, secondaryFormId } = joinDef;
    // Use formId as prefix to match what EnhancedDynamicTable expects
    const prefix = `${secondaryFormId}.`;

    // Helper to find ALL matching secondary rows (not just the first one)
    const findAllMatchingSecondary = (primaryRow: SubmissionRow) => {
      const primaryValueRaw = extractFieldValue(primaryRow.submission_data, primaryFieldId);
      const primaryValue = normalizeJoinValue(primaryValueRaw);
      
      return secondaryData.filter(secondaryRow => {
        const secondaryValueRaw = extractFieldValue(secondaryRow.submission_data, secondaryFieldId);
        const secondaryValue = normalizeJoinValue(secondaryValueRaw);
        return valuesMatch(primaryValue, secondaryValue);
      });
    };

    // Helper to find ALL matching primary rows
    const findAllMatchingPrimary = (secondaryRow: any) => {
      const secondaryValueRaw = extractFieldValue(secondaryRow.submission_data, secondaryFieldId);
      const secondaryValue = normalizeJoinValue(secondaryValueRaw);
      
      return primaryData.filter(primaryRow => {
        const primaryValueRaw = extractFieldValue(primaryRow.submission_data, primaryFieldId);
        const primaryValue = normalizeJoinValue(primaryValueRaw);
        return valuesMatch(primaryValue, secondaryValue);
      });
    };

    switch (joinType) {
      case 'inner':
        // Return all combinations of matching records from both tables
        const innerResult: SubmissionRow[] = [];
        primaryData.forEach(primaryRow => {
          const matchingSecondaryRows = findAllMatchingSecondary(primaryRow);
          matchingSecondaryRows.forEach(secondaryRow => {
            innerResult.push(mergeRows(primaryRow, secondaryRow, prefix));
          });
        });
        return innerResult;

      case 'left':
        // Return all primary records; for each, include all matching secondary records
        // If no match, include primary record alone
        const leftResult: SubmissionRow[] = [];
        primaryData.forEach(primaryRow => {
          const matchingSecondaryRows = findAllMatchingSecondary(primaryRow);
          if (matchingSecondaryRows.length > 0) {
            matchingSecondaryRows.forEach(secondaryRow => {
              leftResult.push(mergeRows(primaryRow, secondaryRow, prefix));
            });
          } else {
            leftResult.push(primaryRow);
          }
        });
        return leftResult;

      case 'right':
        // Return all secondary records; for each, include all matching primary records
        // If no match, include secondary record alone
        const rightResult: SubmissionRow[] = [];

        secondaryData.forEach(secondaryRow => {
          const matchingPrimaryRows = findAllMatchingPrimary(secondaryRow);

          if (matchingPrimaryRows.length > 0) {
            matchingPrimaryRows.forEach(primaryRow => {
              rightResult.push(mergeRows(primaryRow, secondaryRow, prefix));
            });
          } else {
            // Create a row with just secondary data
            rightResult.push({
              id: secondaryRow.id,
              form_id: secondaryRow.form_id,
              submission_data: Object.keys(secondaryRow.submission_data || {}).reduce((acc, key) => {
                acc[`${prefix}${key}`] = secondaryRow.submission_data[key];
                return acc;
              }, {} as Record<string, any>),
              submitted_at: secondaryRow.submitted_at,
              submitted_by: secondaryRow.submitted_by,
              submission_ref_id: secondaryRow.submission_ref_id
            });
          }
        });

        return rightResult;

      case 'full':
        // Return all combinations of matching records, plus unmatched from both sides
        const fullResult: SubmissionRow[] = [];
        const matchedSecondaryIds = new Set<string>();

        // First, process all primary records
        primaryData.forEach(primaryRow => {
          const matchingSecondaryRows = findAllMatchingSecondary(primaryRow);

          if (matchingSecondaryRows.length > 0) {
            matchingSecondaryRows.forEach(secondaryRow => {
              matchedSecondaryIds.add(secondaryRow.id);
              fullResult.push(mergeRows(primaryRow, secondaryRow, prefix));
            });
          } else {
            fullResult.push(primaryRow);
          }
        });

        // Then add unmatched secondary records
        secondaryData.forEach(secondaryRow => {
          if (!matchedSecondaryIds.has(secondaryRow.id)) {
            fullResult.push({
              id: secondaryRow.id,
              form_id: secondaryRow.form_id,
              submission_data: Object.keys(secondaryRow.submission_data || {}).reduce((acc, key) => {
                acc[`${prefix}${key}`] = secondaryRow.submission_data[key];
                return acc;
              }, {} as Record<string, any>),
              submitted_at: secondaryRow.submitted_at,
              submitted_by: secondaryRow.submitted_by,
              submission_ref_id: secondaryRow.submission_ref_id
            });
          }
        });

        return fullResult;

      default:
        return primaryData;
    }
  };

  // Merge primary and secondary rows
  const mergeRows = (primaryRow: SubmissionRow, secondaryRow: any, prefix: string): SubmissionRow => {
    const mergedSubmissionData = {
      ...primaryRow.submission_data,
      ...Object.keys(secondaryRow.submission_data || {}).reduce((acc, key) => {
        acc[`${prefix}${key}`] = secondaryRow.submission_data[key];
        return acc;
      }, {} as Record<string, any>)
    };
    return {
      ...primaryRow,
      submission_data: mergedSubmissionData
    };
  };

  // Create a stable refetch function that uses current values
  const refetch = useCallback(() => {
    loadData(filters, drilldownFilters, joinConfig);
  }, [loadData, filters, drilldownFilters, joinConfig]);

  // Only reload when formId, page, or pageSize changes, or when filters/config actually changed
  useEffect(() => {
    if (!formId) return;
    
    const newFiltersStr = JSON.stringify(filters);
    const newDrilldownStr = JSON.stringify(drilldownFilters);
    const newJoinConfigStr = JSON.stringify(joinConfig);
    
    // Check if anything actually changed
    const filtersChanged = filtersRef.current !== newFiltersStr;
    const drilldownChanged = drilldownFiltersRef.current !== newDrilldownStr;
    const joinConfigChanged = joinConfigRef.current !== newJoinConfigStr;
    
    if (!hasInitialLoad.current || filtersChanged || drilldownChanged || joinConfigChanged) {
      hasInitialLoad.current = true;
      filtersRef.current = newFiltersStr;
      drilldownFiltersRef.current = newDrilldownStr;
      joinConfigRef.current = newJoinConfigStr;
      
      loadData(filters, drilldownFilters, joinConfig);
    }
  }, [formId, currentPage, pageSize, filters, drilldownFilters, joinConfig, loadData]);

  return {
    data,
    loading,
    totalCount,
    currentPage,
    setCurrentPage,
    refetch
  };
}
