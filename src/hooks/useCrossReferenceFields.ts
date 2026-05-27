import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CrossRefFieldOption {
  id: string;
  label: string;
  targetFormId?: string;
  targetFormName?: string;
}

/**
 * Fetches cross-reference fields on a given form, including each field's
 * configured targetFormId (the linked form). Used by the workflow condition
 * builder to support "evaluate against linked records" predicates.
 */
export function useCrossReferenceFields(formId: string | undefined) {
  const [fields, setFields] = useState<CrossRefFieldOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!formId) {
      setFields([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type, custom_config')
          .eq('form_id', formId)
          .in('field_type', ['cross-reference', 'child-cross-reference'])
          .order('field_order');
        if (error) throw error;
        const parsed: CrossRefFieldOption[] = (data || []).map((f: any) => {
          let cfg: any = f.custom_config;
          if (typeof cfg === 'string') {
            try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
          }
          return {
            id: f.id,
            label: f.label,
            targetFormId: cfg?.targetFormId,
            targetFormName: cfg?.targetFormName,
          };
        });
        if (!cancelled) setFields(parsed);
      } catch (err) {
        console.error('useCrossReferenceFields error:', err);
        if (!cancelled) setFields([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [formId]);

  return { fields, loading };
}