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

        transformedData = transformedData.filter(row =>
          currentFilters.every(group =>
            (group.conditions || []).every(cond => matchesCondition(row, cond))
          )
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

  // Helper function to apply joins
  const applyJoins = async (primaryData: SubmissionRow[], joins: JoinDefinition[]): Promise<SubmissionRow[]> => {
    let result = [...primaryData];

    console.log('📌 applyJoins - primaryData length:', primaryData.length);

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

        console.log(`📌 applyJoins - loaded ${secondarySubmissions.length} records from secondary form for join`);

        // Debug: show distinct join key values before performing join
        const primaryKeys = Array.from(
          new Set(
            primaryData.map(p => p.submission_data?.[join.primaryFieldId]).filter(v => v !== undefined && v !== null)
          )
        );
        const secondaryKeys = Array.from(
          new Set(
            secondarySubmissions.map(s => s.submission_data?.[join.secondaryFieldId]).filter(v => v !== undefined && v !== null)
          )
        );
        
        // Debug: show all keys in submission_data to verify field ID exists
        if (primaryData.length > 0) {
          console.log('📌 applyJoins - primary submission_data keys:', Object.keys(primaryData[0].submission_data || {}));
        }
        if (secondarySubmissions.length > 0) {
          console.log('📌 applyJoins - secondary submission_data keys:', Object.keys(secondarySubmissions[0].submission_data || {}));
        }
        
        console.log('📌 applyJoins - primaryFieldId:', join.primaryFieldId);
        console.log('📌 applyJoins - secondaryFieldId:', join.secondaryFieldId);
        console.log('📌 applyJoins - primary join values:', primaryKeys);
        console.log('📌 applyJoins - secondary join values:', secondaryKeys);
        
        // Check for matching values
        const normalizedPrimaryKeys = primaryKeys.map(k => normalizeJoinValue(k));
        const normalizedSecondaryKeys = secondaryKeys.map(k => normalizeJoinValue(k));
        const matchingValues = normalizedPrimaryKeys.filter(pk => normalizedSecondaryKeys.includes(pk));
        console.log('📌 applyJoins - potential matches:', matchingValues.length > 0 ? matchingValues : 'NONE - values do not match between forms');

        // Perform the join based on join type
        result = performJoin(result, secondarySubmissions, join);
        console.log('📌 applyJoins - result length after join:', result.length, '(join type:', join.joinType, ')');
        
      } catch (err) {
        console.error('Error performing join:', err);
      }
    }

    return result;
  };

  // Helper to normalize join values for comparison
  const normalizeJoinValue = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    
    // Handle objects (like submission-access fields or arrays)
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).toLowerCase().trim();
      } catch {
        return String(value).toLowerCase().trim();
      }
    }
    
    return String(value).toLowerCase().trim();
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
    
    let matchCount = 0;

    switch (joinType) {
      case 'inner':
        // Only return records that have matches in both tables
        const innerResult = primaryData
          .map(primaryRow => {
            const primaryValueRaw = primaryRow.submission_data?.[primaryFieldId];
            const primaryValue = normalizeJoinValue(primaryValueRaw);
            const matchingSecondary = secondaryData.find(secondaryRow => {
              const secondaryValueRaw = secondaryRow.submission_data?.[secondaryFieldId];
              const secondaryValue = normalizeJoinValue(secondaryValueRaw);
              return primaryValue !== null && secondaryValue !== null && secondaryValue === primaryValue;
            });

            if (matchingSecondary) {
              matchCount++;
              return mergeRows(primaryRow, matchingSecondary, prefix);
            }
            return null;
          })
          .filter((row): row is SubmissionRow => row !== null);
        
        console.log(`📌 INNER join: ${matchCount} matches found out of ${primaryData.length} primary records`);
        return innerResult;

      case 'left':
        let leftMatchCount = 0;
        const leftResult = primaryData.map(primaryRow => {
          const primaryValueRaw = primaryRow.submission_data?.[primaryFieldId];
          const primaryValue = normalizeJoinValue(primaryValueRaw);
          const matchingSecondary = secondaryData.find(secondaryRow => {
            const secondaryValueRaw = secondaryRow.submission_data?.[secondaryFieldId];
            const secondaryValue = normalizeJoinValue(secondaryValueRaw);
            return primaryValue !== null && secondaryValue !== null && secondaryValue === primaryValue;
          });

          if (matchingSecondary) {
            leftMatchCount++;
            return mergeRows(primaryRow, matchingSecondary, prefix);
          }
          return primaryRow;
        });
        console.log(`📌 LEFT join: ${leftMatchCount} matches found out of ${primaryData.length} primary records`);
        return leftResult;

      case 'right':
        // Return all secondary records, with primary data where matches exist
        const rightResult: SubmissionRow[] = [];
        const matchedPrimaryIds = new Set<string>();

        secondaryData.forEach(secondaryRow => {
          const secondaryValueRaw = secondaryRow.submission_data?.[secondaryFieldId];
          const secondaryValue = normalizeJoinValue(secondaryValueRaw);
          const matchingPrimary = primaryData.find(primaryRow => {
            const primaryValueRaw = primaryRow.submission_data?.[primaryFieldId];
            const primaryValue = normalizeJoinValue(primaryValueRaw);
            return primaryValue !== null && secondaryValue !== null && primaryValue === secondaryValue;
          });

          if (matchingPrimary) {
            matchedPrimaryIds.add(matchingPrimary.id);
            rightResult.push(mergeRows(matchingPrimary, secondaryRow, prefix));
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
        // Return all records from both tables
        const fullResult: SubmissionRow[] = [];
        const matchedSecondaryIds = new Set<string>();

        // First, process all primary records
        primaryData.forEach(primaryRow => {
          const primaryValueRaw = primaryRow.submission_data?.[primaryFieldId];
          const primaryValue = normalizeJoinValue(primaryValueRaw);
          const matchingSecondary = secondaryData.find(secondaryRow => {
            const secondaryValueRaw = secondaryRow.submission_data?.[secondaryFieldId];
            const secondaryValue = normalizeJoinValue(secondaryValueRaw);
            return primaryValue !== null && secondaryValue !== null && primaryValue === secondaryValue;
          });

          if (matchingSecondary) {
            matchedSecondaryIds.add(matchingSecondary.id);
            fullResult.push(mergeRows(primaryRow, matchingSecondary, prefix));
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
