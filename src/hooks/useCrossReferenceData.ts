import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CrossReferenceRecord {
  id: string;
  submission_ref_id: string;
  form_id: string;
  submission_data: any;
  displayData: string;
}

export function useCrossReferenceData(
  targetFormId?: string,
  submissionRefIds?: string[],
  displayFieldIds?: string | string[]
) {
  // Normalize displayFieldIds to always be an array
  const normalizedDisplayFieldIds = displayFieldIds
    ? Array.isArray(displayFieldIds)
      ? displayFieldIds
      : [displayFieldIds]
    : [];
  const [records, setRecords] = useState<CrossReferenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  console.log('useCrossReferenceData: targetFormId:', targetFormId);
  console.log('useCrossReferenceData: displayFieldIds (raw):', displayFieldIds);
  console.log('useCrossReferenceData: normalizedDisplayFieldIds:', normalizedDisplayFieldIds);

  useEffect(() => {
    const fetchCrossReferenceData = async () => {
      if (!targetFormId || !submissionRefIds || submissionRefIds.length === 0) {
        setLoading(false);
        setRecords([]);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch submissions from the TARGET form that match the reference IDs
        const { data: submissions, error: submissionsError } = await supabase
          .from('form_submissions')
          .select('id, submission_ref_id, form_id, submission_data')
          .eq('form_id', targetFormId)
          .in('submission_ref_id', submissionRefIds);

        if (submissionsError) {
          throw submissionsError;
        }

        // Also fetch the form fields to get their labels
        const { data: formFields, error: fieldsError } = await supabase
          .from('form_fields')
          .select('id, label, field_type')
          .eq('form_id', targetFormId);

        if (fieldsError) {
          throw fieldsError;
        }

        const fieldMap = new Map(formFields?.map(f => [f.id, { label: f.label, type: f.field_type }]) || []);

        const formattedRecords: CrossReferenceRecord[] = (submissions || []).map(sub => {
          // Build display data from selected fields
          let displayParts: string[] = [];
          
          if (normalizedDisplayFieldIds && normalizedDisplayFieldIds.length > 0) {
            displayParts = normalizedDisplayFieldIds
              .map(fieldId => {
                const fieldInfo = fieldMap.get(fieldId);
                const value = sub.submission_data?.[fieldId];
                
                if (value !== null && value !== undefined && value !== '') {
                  const label = fieldInfo?.label || fieldId;
                  return `${label}: ${formatFieldValue(value, fieldInfo?.type)}`;
                }
                return null;
              })
              .filter(Boolean) as string[];
          }

          return {
            id: sub.id,
            submission_ref_id: sub.submission_ref_id || sub.id.slice(0, 8),
            form_id: sub.form_id,
            submission_data: sub.submission_data,
            displayData: displayParts.length > 0 
              ? displayParts.join(' | ') 
              : sub.submission_ref_id || sub.id.slice(0, 8)
          };
        });

        setRecords(formattedRecords);
        setError(null);
      } catch (err) {
        console.error('Error fetching cross-reference data:', err);
        setError('Failed to fetch cross-reference data');
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCrossReferenceData();
  }, [targetFormId, JSON.stringify(submissionRefIds), JSON.stringify(normalizedDisplayFieldIds)]);

  return {
    records,
    loading,
    error
  };
}

function formatFieldValue(value: any, fieldType?: string): string {
  if (value === null || value === undefined) return 'N/A';
  
  // Handle objects (like currency, address, etc.)
  if (typeof value === 'object') {
    if (fieldType === 'currency' && value.amount) {
      return `${value.currency || ''} ${value.amount}`;
    }
    if (fieldType === 'address') {
      return [value.street, value.city, value.state, value.postal, value.country]
        .filter(Boolean)
        .join(', ');
    }
    return JSON.stringify(value);
  }
  
  // Handle dates
  if (fieldType === 'date' || fieldType === 'datetime') {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  
  return String(value);
}
