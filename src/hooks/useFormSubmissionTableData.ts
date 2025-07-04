
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { TableFilter, TableSort } from '@/components/form-fields/types/tableTypes';

interface FormSubmissionRecord {
  submission_id: string;
  submission_ref_id: string;
  submitted_at: string;
  submitted_by: string;
  approval_status: string;
  form_id: string;
  field_data: Record<string, any>;
  total_count: number;
}

interface UseFormSubmissionTableDataProps {
  targetFormId: string;
  displayColumns: string[];
  targetFormFields: Array<{
    id: string;
    label: string;
    type: string;
  }>;
  filters?: TableFilter[];
  activeFilters?: TableFilter[];
  searchTerm?: string;
  sortConditions?: TableSort[];
  currentPage?: number;
  pageSize?: number;
  enableSearch?: boolean;
  enableSorting?: boolean;
}

// Helper function to get submission data for a specific field
export function getSubmissionData(fieldId: string, fieldData: Record<string, any>): string {
  if (!fieldData || !fieldId) {
    return '-';
  }

  // Try direct field ID lookup
  if (fieldData[fieldId]) {
    const fieldInfo = fieldData[fieldId];
    if (typeof fieldInfo === 'object' && fieldInfo.value !== undefined) {
      return fieldInfo.value || '-';
    }
    return String(fieldInfo) || '-';
  }

  // Try case-insensitive lookup
  const keys = Object.keys(fieldData);
  const matchingKey = keys.find(key => key.toLowerCase() === fieldId.toLowerCase());
  if (matchingKey && fieldData[matchingKey]) {
    const fieldInfo = fieldData[matchingKey];
    if (typeof fieldInfo === 'object' && fieldInfo.value !== undefined) {
      return fieldInfo.value || '-';
    }
    return String(fieldInfo) || '-';
  }

  return '-';
}

export function useFormSubmissionTableData({
  targetFormId,
  displayColumns,
  targetFormFields,
  filters = [],
  activeFilters = [],
  searchTerm = '',
  sortConditions = [],
  currentPage = 1,
  pageSize = 10,
  enableSearch = true,
  enableSorting = true
}: UseFormSubmissionTableDataProps) {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!targetFormId || !userProfile || !currentProject) {
      console.log('useFormSubmissionTableData: Missing required data:', { 
        targetFormId, 
        userProfile: !!userProfile, 
        currentProject: !!currentProject 
      });
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('useFormSubmissionTableData: Starting data fetch for form:', targetFormId);
      console.log('useFormSubmissionTableData: Display columns:', displayColumns);
      console.log('useFormSubmissionTableData: Target form fields:', targetFormFields);

      // Prepare parameters for the database function
      const allFilters = [...(filters || []), ...(activeFilters || [])];
      const searchFieldId = displayColumns.length > 0 ? displayColumns[0] : null;
      const pageOffset = (currentPage - 1) * pageSize;

      // Convert filters to the format expected by the database function
      const dbFilters = allFilters.map(filter => ({
        field: filter.field,
        operator: filter.operator,
        value: filter.value,
        logic: filter.logic || 'AND'
      }));

      // Convert sort conditions to the format expected by the database function
      const dbSortConditions = enableSorting && sortConditions.length > 0 
        ? sortConditions.map(sort => ({
            field: sort.field,
            direction: sort.direction
          }))
        : [];

      console.log('useFormSubmissionTableData: Calling database function with params:', {
        targetFormId,
        displayColumns,
        searchTerm: enableSearch ? searchTerm : null,
        searchFieldId: enableSearch ? searchFieldId : null,
        filters: dbFilters,
        sortConditions: dbSortConditions,
        pageOffset,
        pageSize
      });

      // Call the database function using a direct SQL query since it's not in the generated types yet
      const { data: submissions, error: queryError } = await supabase
        .from('form_submissions')
        .select(`
          id,
          submission_ref_id,
          submitted_at,
          submitted_by,
          approval_status,
          form_id,
          submission_data
        `)
        .eq('form_id', targetFormId)
        .order('submitted_at', { ascending: false })
        .range(pageOffset, pageOffset + pageSize - 1);

      if (queryError) {
        console.error('useFormSubmissionTableData: Database query error:', queryError);
        setError(`Failed to fetch data: ${queryError.message}`);
        return;
      }

      console.log('useFormSubmissionTableData: Raw submissions received:', submissions?.length || 0);

      // Get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('form_id', targetFormId);

      if (countError) {
        console.error('useFormSubmissionTableData: Count query error:', countError);
      }

      // Process the data manually
      const processedData = processSubmissionData(
        submissions || [], 
        displayColumns, 
        targetFormFields
      );
      
      setData(processedData);
      setTotalRecords(totalCount || 0);
      
      console.log('useFormSubmissionTableData: Final processed data:', processedData.length, 'records');
      console.log('useFormSubmissionTableData: Total records:', totalCount || 0);
      
    } catch (error) {
      console.error('useFormSubmissionTableData: Error fetching data:', error);
      setError(`Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to process submission data
  const processSubmissionData = (
    submissions: any[],
    displayColumns: string[],
    targetFormFields: Array<{ id: string; label: string; type: string }>
  ) => {
    return submissions.map((submission) => {
      const rowData: any = {
        id: submission.id,
        submission_ref_id: submission.submission_ref_id,
        submitted_at: submission.submitted_at,
        submitted_by: submission.submitted_by,
        approval_status: submission.approval_status,
        form_id: submission.form_id
      };

      // Map each display column to its value using the submission_data
      displayColumns.forEach(fieldId => {
        const field = targetFormFields.find(f => f.id === fieldId);
        if (field) {
          // Parse the submission data to get the field value
          const submissionData = submission.submission_data || {};
          rowData[fieldId] = getSubmissionData(fieldId, submissionData);
          
          console.log(`useFormSubmissionTableData: Mapped field ${fieldId} (${field.label}) = "${rowData[fieldId]}" for submission ${submission.id}`);
        } else {
          rowData[fieldId] = '-';
          console.log(`useFormSubmissionTableData: No field found for ${fieldId}, setting empty value`);
        }
      });

      return rowData;
    });
  };

  // Trigger data fetch when dependencies change
  useEffect(() => {
    fetchData();
  }, [
    targetFormId,
    currentPage,
    searchTerm,
    JSON.stringify(activeFilters),
    JSON.stringify(sortConditions),
    JSON.stringify(filters),
    JSON.stringify(displayColumns)
  ]);

  return {
    data,
    loading,
    totalRecords,
    error,
    refetch: fetchData
  };
}
