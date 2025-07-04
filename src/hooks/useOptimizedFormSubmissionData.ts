
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

interface FormSubmission {
  id: string;
  submission_ref_id: string;
  submitted_at: string;
  submitted_by: string;
  approval_status: string;
  form_id: string;
  submission_data: Record<string, any>;
}

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
  logic?: string;
}

interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

interface UseOptimizedFormSubmissionDataProps {
  targetFormId: string;
  displayColumns: string[];
  filters?: FilterCondition[];
  searchTerm?: string;
  sortConditions?: SortCondition[];
  currentPage?: number;
  pageSize?: number;
}

export function useOptimizedFormSubmissionData({
  targetFormId,
  displayColumns,
  filters = [],
  searchTerm = '',
  sortConditions = [],
  currentPage = 1,
  pageSize = 10
}: UseOptimizedFormSubmissionDataProps) {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const [data, setData] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [targetForm, setTargetForm] = useState<{ name: string; reference_id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Helper function to extract field value from submission data
  const getFieldValue = (submissionData: Record<string, any>, fieldId: string): string => {
    if (!submissionData || !fieldId) return '-';
    
    // Direct lookup
    if (submissionData[fieldId] !== undefined) {
      const value = submissionData[fieldId];
      if (typeof value === 'object' && value !== null && 'value' in value) {
        return String(value.value || '-');
      }
      return String(value || '-');
    }
    
    // Case-insensitive lookup
    const keys = Object.keys(submissionData);
    const matchingKey = keys.find(key => key.toLowerCase() === fieldId.toLowerCase());
    if (matchingKey) {
      const value = submissionData[matchingKey];
      if (typeof value === 'object' && value !== null && 'value' in value) {
        return String(value.value || '-');
      }
      return String(value || '-');
    }
    
    return '-';
  };

  const fetchFormFields = async () => {
    if (!targetFormId) return;

    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', targetFormId);

      if (error) throw error;

      setFormFields(fields || []);
    } catch (error) {
      console.error('Error fetching form fields:', error);
    }
  };

  const fetchTargetForm = async () => {
    if (!targetFormId) return;

    try {
      const { data: form, error } = await supabase
        .from('forms')
        .select('name, reference_id')
        .eq('id', targetFormId)
        .single();

      if (error) throw error;

      setTargetForm(form);
    } catch (error) {
      console.error('Error fetching target form:', error);
    }
  };

  const fetchData = async () => {
    if (!targetFormId || !userProfile || !currentProject) return;

    setLoading(true);
    setError(null);

    try {
      // Get total count first
      const { count, error: countError } = await supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('form_id', targetFormId);

      if (countError) throw countError;

      // Get paginated data with basic query
      let query = supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submitted_at, submitted_by, approval_status, form_id, submission_data')
        .eq('form_id', targetFormId);

      // Apply sorting
      if (sortConditions.length > 0) {
        sortConditions.forEach(sort => {
          if (sort.field) {
            query = query.order(`submission_data->${sort.field}`, { ascending: sort.direction === 'asc' });
          }
        });
      } else {
        query = query.order('submitted_at', { ascending: false });
      }

      const offset = (currentPage - 1) * pageSize;
      const { data: submissions, error: queryError } = await query
        .range(offset, offset + pageSize - 1);

      if (queryError) throw queryError;

      // Process submissions data
      const processedData = (submissions || []).map((submission: FormSubmission) => {
        const rowData: any = {
          id: submission.id,
          submission_ref_id: submission.submission_ref_id,
          submitted_at: submission.submitted_at,
          submitted_by: submission.submitted_by,
          approval_status: submission.approval_status,
          form_id: submission.form_id
        };

        // Map display columns to their values
        displayColumns.forEach(fieldId => {
          rowData[fieldId] = getFieldValue(submission.submission_data, fieldId);
        });

        return rowData;
      });

      // Apply frontend filters if any
      let filteredData = processedData;
      if (filters.length > 0) {
        filteredData = processedData.filter(row => {
          return filters.every(filter => {
            if (!filter.field || !filter.value) return true;
            const value = String(row[filter.field] || '').toLowerCase();
            const filterValue = filter.value.toLowerCase();
            
            switch (filter.operator) {
              case '==': return value === filterValue;
              case '!=': return value !== filterValue;
              case 'contains': return value.includes(filterValue);
              case 'startsWith': return value.startsWith(filterValue);
              case 'endsWith': return value.endsWith(filterValue);
              default: return true;
            }
          });
        });
      }

      // Apply search filter
      if (searchTerm) {
        filteredData = filteredData.filter(row => {
          return displayColumns.some(fieldId => {
            const value = String(row[fieldId] || '').toLowerCase();
            return value.includes(searchTerm.toLowerCase());
          });
        });
      }

      setData(filteredData);
      setTotalRecords(count || 0);

    } catch (error) {
      console.error('Error fetching submission data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch form fields and target form info on mount
  useEffect(() => {
    fetchFormFields();
    fetchTargetForm();
  }, [targetFormId]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [
    targetFormId,
    currentPage,
    searchTerm,
    JSON.stringify(filters),
    JSON.stringify(sortConditions),
    JSON.stringify(displayColumns)
  ]);

  return {
    data,
    formFields,
    targetForm,
    loading,
    totalRecords,
    error,
    refetch: fetchData
  };
}
