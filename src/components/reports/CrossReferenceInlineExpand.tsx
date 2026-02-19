import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { SubmissionRefDisplay } from '@/components/SubmissionRefDisplay';

interface FieldInfo {
  id: string;
  label: string;
  field_type: string;
  options: any;
}

interface LinkedRecord {
  id: string;
  submission_ref_id: string;
  submission_data: Record<string, any>;
}

interface CrossReferenceInlineExpandProps {
  records: { id: string; submission_ref_id: string; displayData?: string }[];
  targetFormId: string;
  targetFormName?: string;
}

export function CrossReferenceInlineExpand({
  records,
  targetFormId,
  targetFormName,
}: CrossReferenceInlineExpandProps) {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [fullRecords, setFullRecords] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const refIds = records.map((r) => r.submission_ref_id);

        const [fieldsRes, subsRes] = await Promise.all([
          supabase
            .from('form_fields')
            .select('id, label, field_type, options')
            .eq('form_id', targetFormId)
            .not('field_type', 'in', '("section","divider","description","cross-reference","child-cross-reference")')
            .order('field_order'),
          supabase
            .from('form_submissions')
            .select('id, submission_ref_id, submission_data')
            .eq('form_id', targetFormId)
            .in('submission_ref_id', refIds),
        ]);

        setFields(fieldsRes.data || []);
        setFullRecords(
          (subsRes.data || []).map((s) => ({
            id: s.id,
            submission_ref_id: s.submission_ref_id || s.id.slice(0, 8),
            submission_data: (s.submission_data as Record<string, any>) || {},
          }))
        );
      } catch (err) {
        console.error('Error fetching inline expand data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [targetFormId, records]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 px-3">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading linked records...</span>
      </div>
    );
  }

  if (fullRecords.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2 px-3">
        No linked records found
      </div>
    );
  }

  // Limit displayed columns to first 5 for readability
  const displayFields = fields.slice(0, 5);

  const formatCellValue = (value: any, field: FieldInfo): string => {
    if (value === null || value === undefined || value === '') return '—';

    if (
      (field.field_type === 'select' || field.field_type === 'radio' || field.field_type === 'checkbox' || field.field_type === 'dropdown') &&
      field.options
    ) {
      const opts = Array.isArray(field.options) ? field.options : [];
      if (Array.isArray(value)) {
        return value
          .map((v) => {
            const opt = opts.find((o: any) => o.value === v || o.id === v);
            return opt?.label || v;
          })
          .join(', ');
      }
      const opt = opts.find((o: any) => o.value === value || o.id === value);
      return opt?.label || String(value);
    }

    if (typeof value === 'object') {
      if (field.field_type === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
      if (Array.isArray(value)) return value.join(', ');
      return JSON.stringify(value);
    }

    if (field.field_type === 'date' || field.field_type === 'datetime') {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    }

    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  return (
    <div className="mt-1 border border-border/60 rounded-md overflow-hidden bg-muted/30">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/60 border-b border-border/40">
            <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">
              ID
            </th>
            {displayFields.map((f) => (
              <th
                key={f.id}
                className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap max-w-[150px] truncate"
                title={f.label}
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fullRecords.map((rec, idx) => (
            <tr
              key={rec.id}
              className={`border-b border-border/20 last:border-b-0 ${idx % 2 === 0 ? 'bg-background/50' : 'bg-muted/20'}`}
            >
              <td className="px-2 py-1.5 whitespace-nowrap">
                <SubmissionRefDisplay
                  submissionRefId={rec.submission_ref_id}
                  submissionId={rec.id}
                  formName={targetFormName || undefined}
                  variant="compact"
                />
              </td>
              {displayFields.map((f) => (
                <td
                  key={f.id}
                  className="px-2 py-1.5 max-w-[150px] truncate"
                  title={formatCellValue(rec.submission_data?.[f.id], f)}
                >
                  {formatCellValue(rec.submission_data?.[f.id], f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
