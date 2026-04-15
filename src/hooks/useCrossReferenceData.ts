import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CrossReferenceRecord {
  id: string;
  submission_ref_id: string;
  form_id: string;
  submission_data: any;
  displayData: string;
}

// ── In-memory caches shared across all hook instances ──
const formNameCache = new Map<string, { name: string; ts: number }>();
const formFieldsCache = new Map<string, { fields: any[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Deduplication: coalesce concurrent fetches for the same key ──
const inflightFormName = new Map<string, Promise<string | null>>();
const inflightFormFields = new Map<string, Promise<any[]>>();

async function getCachedFormName(formId: string): Promise<string | null> {
  const cached = formNameCache.get(formId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.name;

  let promise = inflightFormName.get(formId);
  if (!promise) {
    promise = (async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('name')
        .eq('id', formId)
        .single();
      const name = !error && data ? data.name : null;
      if (name) formNameCache.set(formId, { name, ts: Date.now() });
      inflightFormName.delete(formId);
      return name;
    })();
    inflightFormName.set(formId, promise);
  }
  return promise;
}

async function getCachedFormFields(formId: string): Promise<any[]> {
  const cached = formFieldsCache.get(formId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.fields;

  let promise = inflightFormFields.get(formId);
  if (!promise) {
    promise = (async () => {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type, options')
        .eq('form_id', formId);
      const fields = !error && data ? data : [];
      formFieldsCache.set(formId, { fields, ts: Date.now() });
      inflightFormFields.delete(formId);
      return fields;
    })();
    inflightFormFields.set(formId, promise);
  }
  return promise;
}

export function useCrossReferenceData(
  targetFormId?: string,
  submissionRefIds?: string[],
  displayFieldIds?: string | string[]
) {
  const normalizedDisplayFieldIds = displayFieldIds
    ? Array.isArray(displayFieldIds)
      ? displayFieldIds
      : [displayFieldIds]
    : [];
  const [records, setRecords] = useState<CrossReferenceRecord[]>([]);
  const [targetFormName, setTargetFormName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  useEffect(() => {
    const generation = ++abortRef.current;

    const fetchCrossReferenceData = async () => {
      if (!targetFormId || !submissionRefIds || submissionRefIds.length === 0) {
        setLoading(false);
        setRecords([]);
        return;
      }

      try {
        setLoading(true);

        // Run all three fetches in parallel, with caching for form name & fields
        const [formName, formFields, submissionsResult] = await Promise.all([
          getCachedFormName(targetFormId),
          getCachedFormFields(targetFormId),
          supabase
            .from('form_submissions')
            .select('id, submission_ref_id, form_id, submission_data')
            .eq('form_id', targetFormId)
            .in('submission_ref_id', submissionRefIds),
        ]);

        // Abort if a newer call has started
        if (generation !== abortRef.current) return;

        if (formName) setTargetFormName(formName);

        if (submissionsResult.error) throw submissionsResult.error;

        const fieldMap = new Map(
          formFields.map((f: any) => [f.id, { label: f.label, type: f.field_type, options: f.options }])
        );

        const formattedRecords: CrossReferenceRecord[] = (submissionsResult.data || []).map(sub => {
          let displayParts: string[] = [];

          if (normalizedDisplayFieldIds.length > 0) {
            displayParts = normalizedDisplayFieldIds
              .map(fieldId => {
                const fieldInfo = fieldMap.get(fieldId);
                const value = sub.submission_data?.[fieldId];
                if (value !== null && value !== undefined && value !== '') {
                  const label = fieldInfo?.label || fieldId;
                  return `${label}: ${formatFieldValue(value, fieldInfo?.type, fieldInfo?.options)}`;
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
              : sub.submission_ref_id || sub.id.slice(0, 8),
          };
        });

        setRecords(formattedRecords);
        setError(null);
      } catch (err) {
        if (generation !== abortRef.current) return;
        console.error('Error fetching cross-reference data:', err);
        setError('Failed to fetch cross-reference data');
        setRecords([]);
      } finally {
        if (generation === abortRef.current) setLoading(false);
      }
    };

    fetchCrossReferenceData();
  }, [targetFormId, JSON.stringify(submissionRefIds), JSON.stringify(normalizedDisplayFieldIds)]);

  return { records, targetFormName, loading, error };
}

function formatFieldValue(value: any, fieldType?: string, options?: any): string {
  if (value === null || value === undefined) return 'N/A';

  if ((fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'dropdown') && options) {
    const optionsArray = Array.isArray(options) ? options : [];
    if (Array.isArray(value)) {
      const labels = value.map(v => {
        const option = optionsArray.find((opt: any) => opt.value === v || opt.id === v || opt.label === v);
        return option?.label || v;
      });
      return labels.join(', ');
    }
    const option = optionsArray.find((opt: any) => opt.value === value || opt.id === value || opt.label === value);
    if (option?.label) return option.label;
  }

  if (typeof value === 'object') {
    if (fieldType === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
    if (fieldType === 'address') {
      return [value.street, value.city, value.state, value.postal, value.country].filter(Boolean).join(', ');
    }
    return JSON.stringify(value);
  }

  if (fieldType === 'date' || fieldType === 'datetime') {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }

  return String(value);
}
