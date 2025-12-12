import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const loadData = useCallback(async () => {
    if (!formId) {
      setData([]);
      setTotalCount(0);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading table data for form:', formId, 'with drilldown filters:', drilldownFilters);

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
      if (filters && filters.length > 0) {
        console.log('Applying configured filters:', filters);

        const matchesCondition = (row: SubmissionRow, condition: FilterCondition): boolean => {
          if (!condition.field) return true;

          const rawValue = row.submission_data?.[condition.field];
          const valueStr = rawValue !== undefined && rawValue !== null ? rawValue.toString() : '';
          const target = condition.value;
          const targetStr = target !== undefined && target !== null ? target.toString() : '';

          switch (condition.operator) {
            case 'equals':
              return valueStr === targetStr;
            case 'not_equals':
              return valueStr !== targetStr;
            case 'contains':
              return valueStr.toLowerCase().includes(targetStr.toLowerCase());
            case 'starts_with':
              return valueStr.startsWith(targetStr);
            case 'ends_with':
              return valueStr.endsWith(targetStr);
            case 'greater_than':
              return parseFloat(valueStr) > parseFloat(targetStr);
            case 'less_than':
              return parseFloat(valueStr) < parseFloat(targetStr);
            case 'greater_equal':
              return parseFloat(valueStr) >= parseFloat(targetStr);
            case 'less_equal':
              return parseFloat(valueStr) <= parseFloat(targetStr);
            case 'is_empty':
              return valueStr === '' || valueStr === undefined;
            case 'is_not_empty':
              return valueStr !== '' && valueStr !== undefined;
            case 'in': {
              const parts = targetStr.split(',').map(p => p.trim()).filter(Boolean);
              return parts.length === 0 ? true : parts.includes(valueStr);
            }
            case 'not_in': {
              const parts = targetStr.split(',').map(p => p.trim()).filter(Boolean);
              return parts.length === 0 ? true : !parts.includes(valueStr);
            }
            default:
              return true;
          }
        };

        transformedData = transformedData.filter(row =>
          filters.every(group =>
            (group.conditions || []).every(cond => matchesCondition(row, cond))
          )
        );
      }

      // Apply joins if configured
      if (joinConfig?.enabled && joinConfig.joins?.length > 0) {
        console.log('Applying joins:', joinConfig.joins);
        transformedData = await applyJoins(transformedData, joinConfig.joins);
      }

      // Apply drilldown filters client-side
      if (drilldownFilters && drilldownFilters.length > 0) {
        console.log('Applying client-side drilldown filters:', drilldownFilters);
        drilldownFilters.forEach((filter) => {
          if (filter.field && filter.value !== null && filter.value !== undefined) {
            console.log(`Filtering by ${filter.field} = ${filter.value}`);
            transformedData = transformedData.filter(row => {
              const fieldValue = row.submission_data[filter.field];
              return fieldValue && fieldValue.toString() === filter.value;
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
  }, [formId, currentPage, pageSize, filters, drilldownFilters, joinConfig]);

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

        console.log(`Loaded ${secondarySubmissions.length} records from secondary form for join`);

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
    const prefix = `${secondaryFormId}.`;

    switch (joinType) {
      case 'inner':
        // Only return records that have matches in both tables
        return primaryData
          .map(primaryRow => {
            const primaryValue = primaryRow.submission_data?.[primaryFieldId];
            const matchingSecondary = secondaryData.find(secondaryRow => 
              secondaryRow.submission_data?.[secondaryFieldId] === primaryValue
            );

            if (matchingSecondary) {
              return mergeRows(primaryRow, matchingSecondary, prefix);
            }
            return null;
          })
          .filter((row): row is SubmissionRow => row !== null);

      case 'left':
        // Return all primary records, with secondary data where matches exist
        return primaryData.map(primaryRow => {
          const primaryValue = primaryRow.submission_data?.[primaryFieldId];
          const matchingSecondary = secondaryData.find(secondaryRow => 
            secondaryRow.submission_data?.[secondaryFieldId] === primaryValue
          );

          if (matchingSecondary) {
            return mergeRows(primaryRow, matchingSecondary, prefix);
          }
          return primaryRow;
        });

      case 'right':
        // Return all secondary records, with primary data where matches exist
        const rightResult: SubmissionRow[] = [];
        const matchedPrimaryIds = new Set<string>();

        secondaryData.forEach(secondaryRow => {
          const secondaryValue = secondaryRow.submission_data?.[secondaryFieldId];
          const matchingPrimary = primaryData.find(primaryRow => 
            primaryRow.submission_data?.[primaryFieldId] === secondaryValue
          );

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
          const primaryValue = primaryRow.submission_data?.[primaryFieldId];
          const matchingSecondary = secondaryData.find(secondaryRow => 
            secondaryRow.submission_data?.[secondaryFieldId] === primaryValue
          );

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

  // Force reload when drilldown filters or joinConfig change
  useEffect(() => {
    if (formId) {
      console.log('Filters/joins changed, reloading data');
      loadData();
    }
  }, [drilldownFilters, formId, loadData, joinConfig?.enabled, JSON.stringify(joinConfig?.joins)]);

  return {
    data,
    loading,
    totalCount,
    currentPage,
    setCurrentPage,
    refetch: loadData
  };
}
