
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SubmissionRow {
  id: string;
  form_id: string;
  submission_data: Record<string, any>;
  submitted_at: string;
  submitted_by: string;
  submission_ref_id: string;
}

interface FilterCondition {
  field: string;
  operator: string;
  value: any;
}

interface FilterGroup {
  conditions: FilterCondition[];
}

export function useTableData(formId: string, filters: FilterGroup[], pageSize: number = 50) {
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
      console.log('Loading table data for form:', formId);

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

      // Get paginated data - simple query
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const dataResult = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId)
        .range(from, to)
        .order('submitted_at', { ascending: false });

      if (dataResult.error) {
        console.error('Error loading submissions:', dataResult.error);
        return;
      }

      // Transform data with explicit typing
      const submissions = dataResult.data || [];
      const transformedData: SubmissionRow[] = submissions.map(row => ({
        id: row.id || '',
        form_id: row.form_id || '',
        submission_data: (typeof row.submission_data === 'object' && row.submission_data !== null) 
          ? row.submission_data as Record<string, any> 
          : {},
        submitted_at: row.submitted_at || '',
        submitted_by: row.submitted_by || '',
        submission_ref_id: row.submission_ref_id || ''
      }));

      console.log('Loaded submissions:', transformedData.length);
      setData(transformedData);

    } catch (error) {
      console.error('Error in loadData:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [formId, currentPage, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    totalCount,
    currentPage,
    setCurrentPage,
    refetch: loadData
  };
}
