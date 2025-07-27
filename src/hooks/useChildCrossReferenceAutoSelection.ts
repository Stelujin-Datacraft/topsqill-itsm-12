import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AutoSelectedRecord {
  id: string;
  submission_ref_id: string;
  displayData: Record<string, any>;
}

interface UseChildCrossReferenceAutoSelectionProps {
  currentFormId: string;
  currentSubmissionId?: string;
  parentFormId?: string;
  crossReferenceFieldId?: string;
  displayColumns?: string[];
  enabled?: boolean;
}

export function useChildCrossReferenceAutoSelection({
  currentFormId,
  currentSubmissionId,
  parentFormId,
  crossReferenceFieldId,
  displayColumns = [],
  enabled = true
}: UseChildCrossReferenceAutoSelectionProps) {
  const [autoSelectedRecords, setAutoSelectedRecords] = useState<AutoSelectedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !currentFormId || !parentFormId || !currentSubmissionId) {
      setAutoSelectedRecords([]);
      return;
    }

    const fetchAutoSelectedRecords = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Fetching auto-selected records for:', {
          currentFormId,
          currentSubmissionId,
          parentFormId,
          crossReferenceFieldId
        });

        // Query all submissions from the parent form
        const { data: parentSubmissions, error: submissionsError } = await supabase
          .from('form_submissions')
          .select('id, submission_ref_id, submission_data')
          .eq('form_id', parentFormId);

        if (submissionsError) {
          throw submissionsError;
        }

        console.log('Found parent submissions:', parentSubmissions?.length);

        // Find submissions that have selected the current record
        const matchingSubmissions: AutoSelectedRecord[] = [];

        if (parentSubmissions) {
          for (const submission of parentSubmissions) {
            const submissionData = submission.submission_data as Record<string, any>;
            
            // Look for cross-reference field in submission data
            let foundCurrentRecord = false;
            
            // Check all fields in submission data for cross-reference arrays
            for (const [fieldKey, fieldValue] of Object.entries(submissionData)) {
              if (Array.isArray(fieldValue)) {
                // Check if this array contains our current submission
                const containsCurrentRecord = fieldValue.some(item => {
                  if (typeof item === 'object' && item !== null) {
                    // Handle object format {id, submission_ref_id, displayData}
                    return item.id === currentSubmissionId || 
                           item.submission_ref_id === currentSubmissionId;
                  } else {
                    // Handle simple ID format
                    return item === currentSubmissionId;
                  }
                });

                if (containsCurrentRecord) {
                  foundCurrentRecord = true;
                  break;
                }
              }
            }

            if (foundCurrentRecord) {
              // Create display data from submission data
              const displayData: Record<string, any> = {};
              
              if (displayColumns.length > 0) {
                for (const column of displayColumns) {
                  displayData[column] = submissionData[column] || '-';
                }
              } else {
                // If no display columns specified, include basic submission data
                displayData.submission_data = submissionData;
              }

              matchingSubmissions.push({
                id: submission.id,
                submission_ref_id: submission.submission_ref_id || `SUB-${submission.id.slice(0, 8)}`,
                displayData
              });
            }
          }
        }

        console.log('Auto-selected records found:', matchingSubmissions.length);
        setAutoSelectedRecords(matchingSubmissions);

      } catch (err) {
        console.error('Error fetching auto-selected records:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch auto-selected records');
        setAutoSelectedRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAutoSelectedRecords();
  }, [currentFormId, currentSubmissionId, parentFormId, crossReferenceFieldId, displayColumns, enabled]);

  const refetch = () => {
    if (enabled && currentFormId && parentFormId && currentSubmissionId) {
      // Re-trigger the effect by updating a dependency
      setError(null);
    }
  };

  return {
    autoSelectedRecords,
    loading,
    error,
    refetch
  };
}