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
}

export function CrossReferenceInlineExpand({
  records,
  targetFormId,
  targetFormName,
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

            if (field.field_type === 'cross-reference' || field.field_type === 'child-cross-reference') {
              const linkedRefIds = extractRefIds(value);
              const tFormId = field.field_type === 'child-cross-reference' ? customConfig?.parentFormId : customConfig?.targetFormId;
              if (tFormId && linkedRefIds.length > 0) {
                crossRefs.push({ fieldId: field.id, label: field.label, targetFormId: tFormId, targetFormName: customConfig?.targetFormName || 'Linked Form', linkedRefIds, linkedRecords: [] });
              }
            } else if (!['section', 'divider', 'description'].includes(field.field_type)) {
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
      <div className="flex items-center gap-2 py-3 px-3 mt-1 border border-border rounded-md bg-background shadow-lg relative z-50">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading linked records...</span>
      </div>
    );
  }

  if (recordDetails.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2 px-3 mt-1 border border-border rounded-md bg-background shadow-lg relative z-50">
        No linked records found
      </div>
    );
  }

  const allFields = recordDetails.length > 0 ? recordDetails[0].fields : [];
  // Collect unique cross-ref field definitions across all records
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
    <div className="mt-1 relative z-50 min-w-[600px] w-full max-w-[1100px]">
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

                  {/* Expanded cross-ref sections */}
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
                        {crData!.linkedRecords.map((linked: any) => {
                          const nestedKey = `${crKey}-nested-${linked.id}`;
                          const isNestedExpanded = !!expandedCrossRefs[nestedKey];
                          return (
                            <div key={linked.id} className="mb-1">
                              <div className="flex items-center gap-1 py-0.5">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-5 w-5 flex-shrink-0 border-border bg-background hover:bg-muted"
                                  onClick={() => toggleCrossRef(nestedKey)}
                                >
                                  {isNestedExpanded ? <Minus className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                                </Button>
                                <SubmissionRefDisplay submissionRefId={linked.submission_ref_id} submissionId={linked.id} formName={crData!.targetFormName} variant="compact" />
                              </div>
                              {isNestedExpanded && (
                                <NestedRecordExpand submissionId={linked.id} formId={crData!.targetFormId} formName={crData!.targetFormName} />
                              )}
                            </div>
                          );
                        })}
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

function NestedRecordExpand({ submissionId, formId, formName }: { submissionId: string; formId: string; formName: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<FieldDisplay[]>([]);
  const [crossRefFields, setCrossRefFields] = useState<CrossRefFieldInfo[]>([]);
  const [expandedCrossRefs, setExpandedCrossRefs] = useState<Record<string, boolean>>({});
  const [refId, setRefId] = useState('');

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true);
      try {
        const [subRes, fieldsRes] = await Promise.all([
          supabase.from('form_submissions').select('id, submission_ref_id, submission_data').eq('id', submissionId).single(),
          supabase.from('form_fields').select('id, label, field_type, options, custom_config').eq('form_id', formId).order('field_order'),
        ]);
        if (!subRes.data) { setLoading(false); return; }

        setRefId(subRes.data.submission_ref_id || submissionId.slice(0, 8));
        const submissionData = (subRes.data.submission_data as Record<string, any>) || {};
        const formFields = fieldsRes.data || [];
        const regularFields: FieldDisplay[] = [];
        const crossRefs: CrossRefFieldInfo[] = [];

        for (const field of formFields) {
          const value = submissionData[field.id];
          let customConfig: any = null;
          try { customConfig = typeof field.custom_config === 'string' ? JSON.parse(field.custom_config) : field.custom_config; } catch { /* */ }

          if (field.field_type === 'cross-reference' || field.field_type === 'child-cross-reference') {
            const linkedRefIds = extractRefIds(value);
            const tFormId = field.field_type === 'child-cross-reference' ? customConfig?.parentFormId : customConfig?.targetFormId;
            if (tFormId && linkedRefIds.length > 0) {
              crossRefs.push({ fieldId: field.id, label: field.label, targetFormId: tFormId, targetFormName: customConfig?.targetFormName || 'Linked Form', linkedRefIds, linkedRecords: [] });
            }
          } else if (!['section', 'divider', 'description'].includes(field.field_type)) {
            regularFields.push({ id: field.id, label: field.label, fieldType: field.field_type, value, options: field.options });
          }
        }

        for (const cr of crossRefs) {
          const { data: linkedSubs } = await supabase.from('form_submissions').select('id, submission_ref_id, submission_data').eq('form_id', cr.targetFormId).in('submission_ref_id', cr.linkedRefIds);
          const { data: targetForm } = await supabase.from('forms').select('name').eq('id', cr.targetFormId).single();
          cr.linkedRecords = linkedSubs || [];
          if (targetForm?.name) cr.targetFormName = targetForm.name;
        }

        setFields(regularFields);
        setCrossRefFields(crossRefs);
      } catch (err) {
        console.error('Error fetching nested record:', err);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [submissionId, formId]);

  const toggleCrossRef = (key: string) => {
    setExpandedCrossRefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 ml-6">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const visibleFields = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
  const crColumns = crossRefFields.filter((cr) => cr.linkedRecords.length > 0);

  return (
    <div className="ml-6 my-1 border border-border/60 rounded-md overflow-auto bg-background shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/60 border-b border-border/40">
            <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">ID</th>
            {visibleFields.map((f) => (
              <th key={f.id} className="px-3 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap max-w-[160px] truncate" title={f.label}>{f.label}</th>
            ))}
            {crColumns.map((cr) => (
              <th key={cr.fieldId} className="px-3 py-1.5 text-left font-semibold text-accent whitespace-nowrap">
                <div className="flex items-center gap-1"><Link2 className="h-2.5 w-2.5" />{cr.label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-background">
            <td className="px-3 py-1.5 whitespace-nowrap">
              <div className="flex items-center gap-1">
                <SubmissionRefDisplay submissionRefId={refId} submissionId={submissionId} formName={formName} variant="compact" />
                <Button variant="ghost" size="sm" className="h-4 px-1 text-xs" onClick={() => navigate(`/submission/${submissionId}`)}>
                  <ExternalLink className="h-2.5 w-2.5 text-info" />
                </Button>
              </div>
            </td>
            {visibleFields.map((f) => (
              <td key={f.id} className="px-3 py-1.5 max-w-[160px] truncate" title={formatValue(f)}>{formatValue(f)}</td>
            ))}
            {crColumns.map((cr) => {
              const crKey = `nested-${submissionId}-${cr.fieldId}`;
              const isExpanded = !!expandedCrossRefs[crKey];
              return (
                <td key={cr.fieldId} className="px-3 py-1.5">
                  <Button variant="outline" size="sm" className="h-5 px-1.5 gap-1 border-border bg-background hover:bg-muted text-xs" onClick={() => toggleCrossRef(crKey)}>
                    {isExpanded ? <Minus className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                    <span>{cr.linkedRecords.length}</span>
                  </Button>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      {/* Expanded nested cross-refs */}
      {crColumns.map((cr) => {
        const crKey = `nested-${submissionId}-${cr.fieldId}`;
        if (!expandedCrossRefs[crKey]) return null;
        return (
          <div key={crKey} className="border-t border-border/40 px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="h-2.5 w-2.5 text-accent" />
              <span className="text-[11px] font-semibold">{cr.label}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0">{cr.targetFormName} · {cr.linkedRecords.length}</Badge>
            </div>
            {cr.linkedRecords.map((linked: any) => {
              const deepKey = `${crKey}-deep-${linked.id}`;
              const isDeepExpanded = !!expandedCrossRefs[deepKey];
              return (
                <div key={linked.id} className="mb-1">
                  <div className="flex items-center gap-1 py-0.5">
                    <Button variant="outline" size="icon" className="h-4 w-4 flex-shrink-0 border-border bg-background hover:bg-muted" onClick={() => toggleCrossRef(deepKey)}>
                      {isDeepExpanded ? <Minus className="h-2 w-2" /> : <Plus className="h-2 w-2" />}
                    </Button>
                    <SubmissionRefDisplay submissionRefId={linked.submission_ref_id} submissionId={linked.id} formName={cr.targetFormName} variant="compact" />
                  </div>
                  {isDeepExpanded && <NestedRecordExpand submissionId={linked.id} formId={cr.targetFormId} formName={cr.targetFormName} />}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
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
