import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmissionRefDisplay } from '@/components/SubmissionRefDisplay';

const MAX_DEPTH = 5;

interface FieldInfo {
  id: string;
  label: string;
  field_type: string;
  options: any;
  custom_config: any;
}

interface CrossReferenceInlineExpandProps {
  submissionId: string;
  submissionRefId: string;
  targetFormId: string;
  targetFormName?: string;
  depth?: number;
}

export function CrossReferenceInlineExpand({
  submissionId,
  submissionRefId,
  targetFormId,
  targetFormName,
  depth = 0,
}: CrossReferenceInlineExpandProps) {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [submissionData, setSubmissionData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fieldsRes, subRes] = await Promise.all([
          supabase
            .from('form_fields')
            .select('id, label, field_type, options, custom_config')
            .eq('form_id', targetFormId)
            .not('field_type', 'in', '("section","divider","description")')
            .order('field_order'),
          supabase
            .from('form_submissions')
            .select('submission_data')
            .eq('id', submissionId)
            .single(),
        ]);
        setFields(fieldsRes.data || []);
        setSubmissionData((subRes.data?.submission_data as Record<string, any>) || {});
      } catch (err) {
        console.error('Error fetching expand data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [submissionId, targetFormId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 px-3">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const regularFields = fields.filter(
    (f) => f.field_type !== 'cross-reference' && f.field_type !== 'child-cross-reference'
  );
  const crossRefFields = fields.filter(
    (f) => f.field_type === 'cross-reference' || f.field_type === 'child-cross-reference'
  );
  const displayFields = regularFields.slice(0, 5);

  return (
    <div className="mt-1 ml-4 border-l-2 border-accent/30 pl-2">
      {/* Regular fields as a mini table */}
      {displayFields.length > 0 && (
        <div className="border border-border/60 rounded-md overflow-hidden bg-muted/30">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b border-border/40">
                {displayFields.map((f) => (
                  <th
                    key={f.id}
                    className="text-left px-2 py-1 font-semibold text-muted-foreground whitespace-nowrap max-w-[150px] truncate"
                    title={f.label}
                  >
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/20">
                {displayFields.map((f) => (
                  <td
                    key={f.id}
                    className="px-2 py-1 max-w-[150px] truncate"
                    title={formatCellValue(submissionData[f.id], f)}
                  >
                    {formatCellValue(submissionData[f.id], f)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Nested cross-ref fields */}
      {depth < MAX_DEPTH &&
        crossRefFields.map((field) => {
          const value = submissionData[field.id];
          if (!value) return null;
          return (
            <NestedCrossRefField
              key={field.id}
              field={field}
              value={value}
              depth={depth + 1}
            />
          );
        })}
    </div>
  );
}

/** Renders a nested cross-reference field with its own expandable records */
function NestedCrossRefField({
  field,
  value,
  depth,
}: {
  field: FieldInfo;
  value: any;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [records, setRecords] = useState<{ id: string; submission_ref_id: string }[]>([]);
  const [formName, setFormName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());

  // Parse custom_config
  let customConfig: any = null;
  try {
    customConfig =
      typeof field.custom_config === 'string'
        ? JSON.parse(field.custom_config)
        : field.custom_config;
  } catch {
    /* ignore */
  }
  const targetFormId = customConfig?.targetFormId;
  if (!targetFormId) return null;

  // Normalize ref IDs
  let refIds: string[] = [];
  if (typeof value === 'string') {
    refIds = value.split(',').map((s: string) => s.trim()).filter(Boolean);
  } else if (Array.isArray(value)) {
    refIds = value
      .flatMap((v: any) => (typeof v === 'string' ? v.split(',').map((s: string) => s.trim()) : []))
      .filter(Boolean);
  }
  if (refIds.length === 0) return null;

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (records.length > 0) return; // already fetched

    setLoading(true);
    try {
      const [formRes, subsRes] = await Promise.all([
        supabase.from('forms').select('name').eq('id', targetFormId).single(),
        supabase
          .from('form_submissions')
          .select('id, submission_ref_id')
          .eq('form_id', targetFormId)
          .in('submission_ref_id', refIds),
      ]);
      setFormName(formRes.data?.name || null);
      setRecords(
        (subsRes.data || []).map((s) => ({
          id: s.id,
          submission_ref_id: s.submission_ref_id || s.id.slice(0, 8),
        }))
      );
    } catch (err) {
      console.error('Error fetching nested cross-ref:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecord = (id: string) => {
    setExpandedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mt-1.5">
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs gap-1 border-border bg-background hover:bg-muted"
        onClick={handleToggle}
      >
        {expanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        <span className="font-medium">{field.label}</span>
        <span className="text-muted-foreground">({refIds.length} linked)</span>
      </Button>

      {expanded && loading && (
        <div className="flex items-center gap-2 py-1 ml-4">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      )}

      {expanded &&
        !loading &&
        records.map((rec) => {
          const isRecExpanded = expandedRecordIds.has(rec.id);
          return (
            <div key={rec.id} className="ml-2 mt-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-5 w-5 flex-shrink-0 border-border bg-background hover:bg-muted"
                  onClick={() => toggleRecord(rec.id)}
                >
                  {isRecExpanded ? (
                    <Minus className="h-2.5 w-2.5" />
                  ) : (
                    <Plus className="h-2.5 w-2.5" />
                  )}
                </Button>
                <SubmissionRefDisplay
                  submissionRefId={rec.submission_ref_id}
                  submissionId={rec.id}
                  formName={formName || undefined}
                  variant="compact"
                />
              </div>
              {isRecExpanded && (
                <CrossReferenceInlineExpand
                  submissionId={rec.id}
                  submissionRefId={rec.submission_ref_id}
                  targetFormId={targetFormId}
                  targetFormName={formName || undefined}
                  depth={depth}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}

function formatCellValue(value: any, field: FieldInfo): string {
  if (value === null || value === undefined || value === '') return '—';

  if (
    (field.field_type === 'select' ||
      field.field_type === 'radio' ||
      field.field_type === 'checkbox' ||
      field.field_type === 'dropdown') &&
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
    if (field.field_type === 'currency' && value.amount)
      return `${value.currency || ''} ${value.amount}`;
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
}
