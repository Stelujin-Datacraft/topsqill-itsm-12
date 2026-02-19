import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink, Link2, Plus, Minus } from 'lucide-react';
import { SubmissionRefDisplay } from '@/components/SubmissionRefDisplay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface FieldDisplay {
  id: string;
  label: string;
  fieldType: string;
  value: any;
  options?: any;
}

interface CrossRefFieldInfo {
  fieldId: string;
  label: string;
  targetFormId: string;
  targetFormName: string;
  linkedRefIds: string[];
  linkedRecords: any[];
}

interface CrossReferenceInlineExpandProps {
  records: { id: string; submission_ref_id: string; displayData?: string }[];
  targetFormId: string;
  targetFormName?: string;
  tableDisplayFields?: string[];
}

export function CrossReferenceInlineExpand({
  records,
  targetFormId,
  targetFormName,
  tableDisplayFields,
}: CrossReferenceInlineExpandProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recordDetails, setRecordDetails] = useState<
    { id: string; submissionRefId: string; fields: FieldDisplay[]; crossRefFields: CrossRefFieldInfo[] }[]
  >([]);
  const [expandedCrossRefs, setExpandedCrossRefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const subIds = records.map((r) => r.id);
        const [subsRes, fieldsRes] = await Promise.all([
          supabase.from('form_submissions').select('id, submission_ref_id, submission_data').eq('form_id', targetFormId).in('id', subIds),
          supabase.from('form_fields').select('id, label, field_type, options, custom_config').eq('form_id', targetFormId).order('field_order'),
        ]);

        const formFields = fieldsRes.data || [];
        const submissions = subsRes.data || [];

        const details = submissions.map((sub) => {
          const submissionData = (sub.submission_data as Record<string, any>) || {};
          const regularFields: FieldDisplay[] = [];
          const crossRefs: CrossRefFieldInfo[] = [];

          for (const field of formFields) {
            const value = submissionData[field.id];
            let customConfig: any = null;
            try { customConfig = typeof field.custom_config === 'string' ? JSON.parse(field.custom_config) : field.custom_config; } catch { /* */ }

            if (field.field_type === 'cross-reference') {
              // Skip cross-reference fields if tableDisplayFields is set and this field is not in it
              if (tableDisplayFields && tableDisplayFields.length > 0 && !tableDisplayFields.includes(field.id)) continue;
              const linkedRefIds = extractRefIds(value);
              const tFormId = customConfig?.targetFormId;
              if (tFormId && linkedRefIds.length > 0) {
                crossRefs.push({ fieldId: field.id, label: field.label, targetFormId: tFormId, targetFormName: customConfig?.targetFormName || 'Linked Form', linkedRefIds, linkedRecords: [] });
              }
            } else if (!['section', 'divider', 'description', 'child-cross-reference'].includes(field.field_type)) {
              // Only include fields that are in tableDisplayFields (if configured)
              if (tableDisplayFields && tableDisplayFields.length > 0 && !tableDisplayFields.includes(field.id)) continue;
              regularFields.push({ id: field.id, label: field.label, fieldType: field.field_type, value, options: field.options });
            }
          }

          return { id: sub.id, submissionRefId: sub.submission_ref_id || sub.id.slice(0, 8), fields: regularFields, crossRefFields: crossRefs };
        });

        for (const detail of details) {
          for (const cr of detail.crossRefFields) {
            const { data: linkedSubs } = await supabase.from('form_submissions').select('id, submission_ref_id, submission_data').eq('form_id', cr.targetFormId).in('submission_ref_id', cr.linkedRefIds);
            const { data: targetForm } = await supabase.from('forms').select('name').eq('id', cr.targetFormId).single();
            cr.linkedRecords = linkedSubs || [];
            if (targetForm?.name) cr.targetFormName = targetForm.name;
          }
        }

        setRecordDetails(details);
      } catch (err) {
        console.error('Error fetching inline expand data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [targetFormId, records]);

  const toggleCrossRef = (key: string) => {
    setExpandedCrossRefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 px-3">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading linked records...</span>
      </div>
    );
  }

  if (recordDetails.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2 px-3">
        No linked records found
      </div>
    );
  }

  const allFields = recordDetails.length > 0 ? recordDetails[0].fields : [];
  const allCrossRefColumns: { fieldId: string; label: string }[] = [];
  const seenCrFields = new Set<string>();
  for (const rec of recordDetails) {
    for (const cr of rec.crossRefFields) {
      if (!seenCrFields.has(cr.fieldId)) {
        seenCrFields.add(cr.fieldId);
        allCrossRefColumns.push({ fieldId: cr.fieldId, label: cr.label });
      }
    }
  }

  return (
    <div className="min-w-[600px] w-max max-w-[1100px]">
      <div className="border border-border rounded-md overflow-auto bg-background shadow-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap sticky left-0 bg-muted">ID</th>
              {allFields.map((f) => (
                <th key={f.id} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap max-w-[180px] truncate" title={f.label}>{f.label}</th>
              ))}
              {allCrossRefColumns.map((cr) => (
                <th key={cr.fieldId} className="px-3 py-2 text-left font-semibold text-accent whitespace-nowrap" title={cr.label}>
                  <div className="flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    {cr.label}
                  </div>
                </th>
              ))}
              <th className="px-1 py-2 w-[30px]"></th>
            </tr>
          </thead>
          <tbody>
            {recordDetails.map((rec, rowIdx) => {
              // Find which cross-ref columns are expanded for this row
              const expandedCrForRow = allCrossRefColumns
                .map((col) => {
                  const crKey = `${rec.id}-${col.fieldId}`;
                  const crData = rec.crossRefFields.find((c) => c.fieldId === col.fieldId);
                  return { col, crKey, crData, isExpanded: !!expandedCrossRefs[crKey] };
                })
                .filter((x) => x.isExpanded && x.crData && x.crData.linkedRecords.length > 0);

              return (
                <React.Fragment key={rec.id}>
                  <tr className={`border-b border-border/40 ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-inherit">
                      <div className="flex items-center gap-1.5">
                        <SubmissionRefDisplay submissionRefId={rec.submissionRefId} submissionId={rec.id} formName={targetFormName || undefined} variant="compact" />
                        <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={() => navigate(`/submission/${rec.id}`)}>
                          <ExternalLink className="h-3 w-3 text-info" />
                        </Button>
                      </div>
                    </td>
                    {allFields.map((f) => {
                      const recField = rec.fields.find((rf) => rf.id === f.id);
                      return (
                        <td key={f.id} className="px-3 py-2 max-w-[180px] truncate" title={recField ? formatValue(recField) : '—'}>
                          {recField ? formatValue(recField) : '—'}
                        </td>
                      );
                    })}
                    {allCrossRefColumns.map((col) => {
                      const crData = rec.crossRefFields.find((c) => c.fieldId === col.fieldId);
                      const crKey = `${rec.id}-${col.fieldId}`;
                      const isExpanded = !!expandedCrossRefs[crKey];
                      const count = crData?.linkedRecords.length || 0;

                      if (!crData || count === 0) {
                        return <td key={col.fieldId} className="px-3 py-2 text-muted-foreground italic">—</td>;
                      }

                      return (
                        <td key={col.fieldId} className="px-3 py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 gap-1 border-border bg-background hover:bg-muted text-xs font-medium"
                            onClick={() => toggleCrossRef(crKey)}
                          >
                            {isExpanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            <span>{count}</span>
                          </Button>
                        </td>
                      );
                    })}
                    <td className="px-1 py-2"></td>
                  </tr>

                  {/* Expanded cross-ref sections — directly show table */}
                  {expandedCrForRow.map(({ crData, crKey }) => (
                    <tr key={crKey}>
                      <td colSpan={allFields.length + allCrossRefColumns.length + 2} className="px-4 py-2 bg-muted/10 border-b border-border/40">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className="h-3 w-3 text-accent" />
                          <span className="text-xs font-semibold">{crData!.label}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {crData!.targetFormName} · {crData!.linkedRecords.length}
                          </Badge>
                        </div>
                        <MultiRecordTable
                          linkedRecords={crData!.linkedRecords}
                          formId={crData!.targetFormId}
                          formName={crData!.targetFormName}
                        />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Fetches fields for a form and renders all linked records directly in a horizontal table */
const DEPTH_STYLES = [
  { border: 'border-accent/30', bg: 'bg-accent/5', headerBg: 'bg-accent/10', headerBorder: 'border-accent/20', rowEven: 'bg-accent/5', rowOdd: 'bg-accent/10' },
  { border: 'border-primary/25', bg: 'bg-primary/5', headerBg: 'bg-primary/10', headerBorder: 'border-primary/20', rowEven: 'bg-primary/5', rowOdd: 'bg-primary/10' },
  { border: 'border-secondary/30', bg: 'bg-secondary/20', headerBg: 'bg-secondary/30', headerBorder: 'border-secondary/25', rowEven: 'bg-secondary/15', rowOdd: 'bg-secondary/25' },
];

function MultiRecordTable({ linkedRecords, formId, formName, depth = 0 }: { linkedRecords: any[]; formId: string; formName: string; depth?: number }) {
  const ds = DEPTH_STYLES[depth % DEPTH_STYLES.length];
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formFields, setFormFields] = useState<{ id: string; label: string; fieldType: string; options?: any }[]>([]);
  const [crossRefColumns, setCrossRefColumns] = useState<{ fieldId: string; label: string; targetFormId: string; targetFormName: string }[]>([]);
  const [expandedCrossRefs, setExpandedCrossRefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true);
      try {
        const { data: fields } = await supabase
          .from('form_fields')
          .select('id, label, field_type, options, custom_config')
          .eq('form_id', formId)
          .order('field_order');

        const regular: typeof formFields = [];
        const crCols: typeof crossRefColumns = [];

        for (const field of fields || []) {
          let customConfig: any = null;
          try { customConfig = typeof field.custom_config === 'string' ? JSON.parse(field.custom_config) : field.custom_config; } catch { /* */ }

          if (field.field_type === 'cross-reference') {
            const tFormId = customConfig?.targetFormId;
            if (tFormId) {
              const { data: tf } = await supabase.from('forms').select('name').eq('id', tFormId).single();
              crCols.push({ fieldId: field.id, label: field.label, targetFormId: tFormId, targetFormName: tf?.name || customConfig?.targetFormName || 'Linked Form' });
            }
          } else if (!['section', 'divider', 'description', 'child-cross-reference'].includes(field.field_type)) {
            regular.push({ id: field.id, label: field.label, fieldType: field.field_type, options: field.options });
          }
        }

        setFormFields(regular);
        setCrossRefColumns(crCols);
      } catch (err) {
        console.error('Error fetching form fields for multi-record table:', err);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [formId]);

  const toggleCrossRef = (key: string) => {
    setExpandedCrossRefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // For each linked record, resolve cross-ref values to get counts & linked record IDs
  const rowsWithCrData = linkedRecords.map((rec) => {
    const submissionData = (rec.submission_data as Record<string, any>) || {};
    const crData: Record<string, { linkedRefIds: string[]; targetFormId: string; targetFormName: string }> = {};
    for (const cr of crossRefColumns) {
      const refIds = extractRefIds(submissionData[cr.fieldId]);
      if (refIds.length > 0) {
        crData[cr.fieldId] = { linkedRefIds: refIds, targetFormId: cr.targetFormId, targetFormName: cr.targetFormName };
      }
    }
    return { ...rec, crData };
  });

  return (
    <div className={`border ${ds.border} rounded-md overflow-auto ${ds.bg} shadow-sm`}>
      <table className="w-full text-xs">
        <thead>
          <tr className={`${ds.headerBg} border-b ${ds.headerBorder}`}>
            <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">ID</th>
            {formFields.map((f) => (
              <th key={f.id} className="px-3 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap max-w-[160px] truncate" title={f.label}>{f.label}</th>
            ))}
            {crossRefColumns.map((cr) => (
              <th key={cr.fieldId} className="px-3 py-1.5 text-left font-semibold text-accent whitespace-nowrap">
                <div className="flex items-center gap-1"><Link2 className="h-2.5 w-2.5" />{cr.label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsWithCrData.map((rec, idx) => {
            const submissionData = (rec.submission_data as Record<string, any>) || {};
            const expandedForRow = crossRefColumns
              .map((cr) => {
                const crKey = `multi-${rec.id}-${cr.fieldId}`;
                const data = rec.crData[cr.fieldId];
                return { cr, crKey, data, isExpanded: !!expandedCrossRefs[crKey] && !!data };
              })
              .filter((x) => x.isExpanded && x.data);

            return (
              <React.Fragment key={rec.id}>
                <tr className={idx % 2 === 0 ? ds.rowEven : ds.rowOdd}>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <SubmissionRefDisplay submissionRefId={rec.submission_ref_id} submissionId={rec.id} formName={formName} variant="compact" />
                      <Button variant="ghost" size="sm" className="h-4 px-1 text-xs" onClick={() => navigate(`/submission/${rec.id}`)}>
                        <ExternalLink className="h-2.5 w-2.5 text-info" />
                      </Button>
                    </div>
                  </td>
                  {formFields.map((f) => {
                    const val = submissionData[f.id];
                    const display = formatValue({ id: f.id, label: f.label, fieldType: f.fieldType, value: val, options: f.options });
                    return (
                      <td key={f.id} className="px-3 py-1.5 max-w-[160px] truncate" title={display}>{display}</td>
                    );
                  })}
                  {crossRefColumns.map((cr) => {
                    const data = rec.crData[cr.fieldId];
                    const crKey = `multi-${rec.id}-${cr.fieldId}`;
                    const isExpanded = !!expandedCrossRefs[crKey];
                    if (!data) return <td key={cr.fieldId} className="px-3 py-1.5 text-muted-foreground italic">—</td>;
                    return (
                      <td key={cr.fieldId} className="px-3 py-1.5">
                        <Button variant="outline" size="sm" className="h-5 px-1.5 gap-1 border-border bg-background hover:bg-muted text-xs" onClick={() => toggleCrossRef(crKey)}>
                          {isExpanded ? <Minus className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                          <span>{data.linkedRefIds.length}</span>
                        </Button>
                      </td>
                    );
                  })}
                </tr>

                {/* Expanded cross-ref sub-tables */}
                {expandedForRow.map(({ cr, crKey, data }) => (
                  <tr key={crKey}>
                    <td colSpan={formFields.length + crossRefColumns.length + 1} className="px-4 py-2 bg-muted/10 border-b border-border/40">
                      <div className="flex items-center gap-2 mb-1">
                        <Link2 className="h-2.5 w-2.5 text-accent" />
                        <span className="text-[11px] font-semibold">{cr.label}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{data!.targetFormName} · {data!.linkedRefIds.length}</Badge>
                      </div>
                      <LazyMultiRecordTable linkedRefIds={data!.linkedRefIds} formId={data!.targetFormId} formName={data!.targetFormName} depth={depth + 1} />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Fetches linked records by ref IDs then renders MultiRecordTable */
function LazyMultiRecordTable({ linkedRefIds, formId, formName, depth = 0 }: { linkedRefIds: string[]; formId: string; formName: string; depth?: number }) {
  const [loading, setLoading] = useState(true);
  const [linkedRecords, setLinkedRecords] = useState<any[]>([]);

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('form_submissions')
          .select('id, submission_ref_id, submission_data')
          .eq('form_id', formId)
          .in('submission_ref_id', linkedRefIds);
        setLinkedRecords(data || []);
      } catch (err) {
        console.error('Error fetching lazy linked records:', err);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [formId, linkedRefIds]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (linkedRecords.length === 0) {
    return <div className="text-xs text-muted-foreground italic py-1">No linked records found</div>;
  }

  return <MultiRecordTable linkedRecords={linkedRecords} formId={formId} formName={formName} depth={depth} />;
}
function formatValue(field: FieldDisplay): string {
  const { value, fieldType, options } = field;
  if (value === null || value === undefined || value === '') return '—';
  if ((fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'dropdown') && options) {
    const opts = Array.isArray(options) ? options : [];
    if (Array.isArray(value)) return value.map((v) => { const opt = opts.find((o: any) => o.value === v || o.id === v); return opt?.label || v; }).join(', ');
    const opt = opts.find((o: any) => o.value === value || o.id === value);
    return opt?.label || String(value);
  }
  if (typeof value === 'object') {
    if (fieldType === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
    if (Array.isArray(value)) return value.join(', ');
    return JSON.stringify(value);
  }
  if (fieldType === 'date' || fieldType === 'datetime') { try { return new Date(value).toLocaleDateString(); } catch { return String(value); } }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function extractRefIds(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.map((v) => { if (typeof v === 'string') return v; if (v?.submission_ref_id) return v.submission_ref_id; if (v?.id) return v.id; return null; }).filter(Boolean) as string[];
  return [];
}
