import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CrossReferenceRecord {
  id: string;
  submission_ref_id: string;
  form_id: string;
  displayData: string;
}

export function useCrossReferenceData(formId?: string) {
  const [records, setRecords] = useState<CrossReferenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCrossReferenceData = async () => {
      if (!formId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch all submissions for cross-reference
        const { data: submissions, error: submissionsError } = await supabase
          .from('form_submissions')
          .select('id, submission_ref_id, form_id, submission_data')
          .eq('form_id', formId);

        if (submissionsError) {
          throw submissionsError;
        }

        const formattedRecords: CrossReferenceRecord[] = (submissions || []).map(sub => ({
          id: sub.id,
          submission_ref_id: sub.submission_ref_id || sub.id.slice(0, 8),
          form_id: sub.form_id,
          displayData: `${sub.submission_ref_id || sub.id.slice(0, 8)} - Record`
        }));

        setRecords(formattedRecords);
        setError(null);
      } catch (err) {
        console.error('Error fetching cross-reference data:', err);
        setError('Failed to fetch cross-reference data');
      } finally {
        setLoading(false);
      }
    };

    fetchCrossReferenceData();
  }, [formId]);

  return {
    records,
    loading,
    error
  };
}