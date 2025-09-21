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

export function useTableData(formId: string, filters: FilterGroup[], pageSize: number = 50, drilldownFilters: DrilldownFilter[] = []) {
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

      // Get paginated data with drilldown filters
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId);

      // Note: Drilldown filters will be applied client-side for now due to Supabase JSON querying limitations

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

      // Apply drilldown filters client-side
      if (drilldownFilters && drilldownFilters.length > 0) {
        console.log('Applying client-side drilldown filters:', drilldownFilters);
        drilldownFilters.forEach((filter, index) => {
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
  }, [formId, currentPage, pageSize, drilldownFilters]);

  // Force reload when drilldown filters change
  useEffect(() => {
    if (formId) {
      console.log('Drilldown filters changed, reloading data:', drilldownFilters);
      loadData();
    }
  }, [drilldownFilters, formId, loadData]);

  return {
    data,
    loading,
    totalCount,
    currentPage,
    setCurrentPage,
    refetch: loadData
  };
}