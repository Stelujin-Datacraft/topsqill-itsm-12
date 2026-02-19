import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronRight, ExternalLink, Link2, Plus, Minus } from 'lucide-react';
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
  customConfig?: any;
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
    {
      id: string;
      submissionRefId: string;
      fields: FieldDisplay[];
      crossRefFields: CrossRefFieldInfo[];
    }[]
  >([]);
  const [expandedCrossRefs, setExpandedCrossRefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const subIds = records.map((r) => r.id);

        const [subsRes, fieldsRes] = await Promise.all([
          supabase
            .from('form_submissions')
            .select('id, submission_ref_id, submission_data')
            .eq('form_id', targetFormId)
            .in('id', subIds),
          supabase
            .from('form_fields')
            .select('id, label, field_type, options, custom_config')
            .eq('form_id', targetFormId)
            .order('field_order'),
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
            try {
              customConfig =
                typeof field.custom_config === 'string'
                  ? JSON.parse(field.custom_config)
                  : field.custom_config;
            } catch {
              /* ignore */
            }

            if (field.field_type === 'cross-reference' || field.field_type === 'child-cross-reference') {
              const linkedRefIds = extractRefIds(value);
              const tFormId =
                field.field_type === 'child-cross-reference'
                  ? customConfig?.parentFormId
                  : customConfig?.targetFormId;

              if (tFormId && linkedRefIds.length > 0) {
                crossRefs.push({
                  fieldId: field.id,
                  label: field.label,
                  targetFormId: tFormId,
                  targetFormName: customConfig?.targetFormName || 'Linked Form',
                  linkedRefIds,
                  linkedRecords: [],
                });
              }
            } else if (field.field_type !== 'section' && field.field_type !== 'divider' && field.field_type !== 'description') {
              regularFields.push({
                id: field.id,
                label: field.label,
                fieldType: field.field_type,
                value,
                options: field.options,
                customConfig,
              });
            }
          }

          return {
            id: sub.id,
            submissionRefId: sub.submission_ref_id || sub.id.slice(0, 8),
            fields: regularFields,
            crossRefFields: crossRefs,
          };
        });

        // Resolve cross-ref linked records
        for (const detail of details) {
          for (const cr of detail.crossRefFields) {
            const { data: linkedSubs } = await supabase
              .from('form_submissions')
              .select('id, submission_ref_id, submission_data')
              .eq('form_id', cr.targetFormId)
              .in('submission_ref_id', cr.linkedRefIds);

            const { data: targetForm } = await supabase
              .from('forms')
              .select('name')
              .eq('id', cr.targetFormId)
              .single();

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
      <div className="flex items-center gap-2 py-3 px-3 mt-1 border border-border/60 rounded-md bg-muted/30">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading linked records...</span>
      </div>
    );
  }

  if (recordDetails.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2 px-3 mt-1 border border-border/60 rounded-md bg-muted/30">
        No linked records found
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-2">
      {recordDetails.map((rec) => (
        <div key={rec.id} className="border border-border/60 rounded-md overflow-hidden bg-muted/30">
          {/* Record Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border/40">
            <SubmissionRefDisplay
              submissionRefId={rec.submissionRefId}
              submissionId={rec.id}
              formName={targetFormName || undefined}
              variant="compact"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={() => navigate(`/submission/${rec.id}`)}
            >
              <ExternalLink className="h-3 w-3 mr-1 text-info" />
              Open
            </Button>
          </div>

          {/* Fields Table */}
          {rec.fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== '').length > 0 && (
            <table className="w-full text-xs">
              <tbody>
                {rec.fields
                  .filter((f) => f.value !== null && f.value !== undefined && f.value !== '')
                  .map((field, idx) => (
                    <tr
                      key={field.id}
                      className={idx % 2 === 0 ? 'bg-background/50' : 'bg-muted/20'}
                    >
                      <td className="px-3 py-1.5 font-medium text-muted-foreground whitespace-nowrap w-[30%] align-top">
                        {field.label}
                      </td>
                      <td className="px-3 py-1.5 truncate max-w-[300px]" title={formatValue(field)}>
                        {formatValue(field)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* Linked Cross-Reference Records */}
          {rec.crossRefFields.length > 0 && (
            <div className="border-t border-border/40 px-3 py-2 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3 w-3 text-accent" />
                Linked Records
              </h4>
              {rec.crossRefFields.map((cr) => (
                <div key={cr.fieldId} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{cr.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {cr.targetFormName} · {cr.linkedRecords.length}
                    </Badge>
                  </div>
                  {cr.linkedRecords.map((linked: any) => {
                    const crKey = `${rec.id}-${cr.fieldId}-${linked.id}`;
                    const isExpanded = expandedCrossRefs[crKey];
                    return (
                      <div key={linked.id} className="rounded-md border border-border/40 bg-background/50">
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0 border-border bg-background hover:bg-muted"
                            onClick={() => toggleCrossRef(crKey)}
                          >
                            {isExpanded ? <Minus className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                          </Button>
                          <SubmissionRefDisplay
                            submissionRefId={linked.submission_ref_id}
                            submissionId={linked.id}
                            formName={cr.targetFormName}
                            variant="compact"
                          />
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                        {isExpanded && (
                          <NestedRecordExpand
                            submissionId={linked.id}
                            formId={cr.targetFormId}
                            formName={cr.targetFormName}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Recursively expandable nested record */
function NestedRecordExpand({
  submissionId,
  formId,
  formName,
}: {
  submissionId: string;
  formId: string;
  formName: string;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<FieldDisplay[]>([]);
  const [crossRefFields, setCrossRefFields] = useState<CrossRefFieldInfo[]>([]);
  const [expandedCrossRefs, setExpandedCrossRefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [subRes, fieldsRes] = await Promise.all([
          supabase
            .from('form_submissions')
            .select('id, submission_ref_id, submission_data')
            .eq('id', submissionId)
            .single(),
          supabase
            .from('form_fields')
            .select('id, label, field_type, options, custom_config')
            .eq('form_id', formId)
            .order('field_order'),
        ]);

        if (!subRes.data) { setLoading(false); return; }

        const submissionData = (subRes.data.submission_data as Record<string, any>) || {};
        const formFields = fieldsRes.data || [];
        const regularFields: FieldDisplay[] = [];
        const crossRefs: CrossRefFieldInfo[] = [];

        for (const field of formFields) {
          const value = submissionData[field.id];
          let customConfig: any = null;
          try {
            customConfig = typeof field.custom_config === 'string'
              ? JSON.parse(field.custom_config)
              : field.custom_config;
          } catch { /* ignore */ }

          if (field.field_type === 'cross-reference' || field.field_type === 'child-cross-reference') {
            const linkedRefIds = extractRefIds(value);
            const tFormId = field.field_type === 'child-cross-reference'
              ? customConfig?.parentFormId
              : customConfig?.targetFormId;
            if (tFormId && linkedRefIds.length > 0) {
              crossRefs.push({
                fieldId: field.id,
                label: field.label,
                targetFormId: tFormId,
                targetFormName: customConfig?.targetFormName || 'Linked Form',
                linkedRefIds,
                linkedRecords: [],
              });
            }
          } else if (field.field_type !== 'section' && field.field_type !== 'divider' && field.field_type !== 'description') {
            regularFields.push({
              id: field.id,
              label: field.label,
              fieldType: field.field_type,
              value,
              options: field.options,
              customConfig,
            });
          }
        }

        for (const cr of crossRefs) {
          const { data: linkedSubs } = await supabase
            .from('form_submissions')
            .select('id, submission_ref_id, submission_data')
            .eq('form_id', cr.targetFormId)
            .in('submission_ref_id', cr.linkedRefIds);
          const { data: targetForm } = await supabase
            .from('forms')
            .select('name')
            .eq('id', cr.targetFormId)
            .single();
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
    fetch();
  }, [submissionId, formId]);

  const toggleCrossRef = (key: string) => {
    setExpandedCrossRefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 border-t border-border/30">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const visibleFields = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== '');

  return (
    <div className="border-t border-border/30">
      {visibleFields.length > 0 && (
        <table className="w-full text-xs">
          <tbody>
            {visibleFields.map((field, idx) => (
              <tr key={field.id} className={idx % 2 === 0 ? 'bg-background/30' : 'bg-muted/10'}>
                <td className="px-3 py-1 font-medium text-muted-foreground whitespace-nowrap w-[30%] align-top">
                  {field.label}
                </td>
                <td className="px-3 py-1 truncate max-w-[250px]" title={formatValue(field)}>
                  {formatValue(field)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {crossRefFields.length > 0 && (
        <div className="border-t border-border/30 px-3 py-2 space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Link2 className="h-2.5 w-2.5 text-accent" />
            Linked Records
          </h4>
          {crossRefFields.map((cr) => (
            <div key={cr.fieldId} className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium">{cr.label}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {cr.targetFormName} · {cr.linkedRecords.length}
                </Badge>
              </div>
              {cr.linkedRecords.map((linked: any) => {
                const crKey = `${submissionId}-${cr.fieldId}-${linked.id}`;
                const isExpanded = expandedCrossRefs[crKey];
                return (
                  <div key={linked.id} className="rounded border border-border/30 bg-background/30">
                    <div className="flex items-center gap-1 px-2 py-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-4 w-4 flex-shrink-0 border-border bg-background hover:bg-muted"
                        onClick={() => toggleCrossRef(crKey)}
                      >
                        {isExpanded ? <Minus className="h-2 w-2" /> : <Plus className="h-2 w-2" />}
                      </Button>
                      <SubmissionRefDisplay
                        submissionRefId={linked.submission_ref_id}
                        submissionId={linked.id}
                        formName={cr.targetFormName}
                        variant="compact"
                      />
                    </div>
                    {isExpanded && (
                      <NestedRecordExpand
                        submissionId={linked.id}
                        formId={cr.targetFormId}
                        formName={cr.targetFormName}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatValue(field: FieldDisplay): string {
  const { value, fieldType, options } = field;
  if (value === null || value === undefined || value === '') return '—';

  if ((fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'dropdown') && options) {
    const opts = Array.isArray(options) ? options : [];
    if (Array.isArray(value)) {
      return value.map((v) => {
        const opt = opts.find((o: any) => o.value === v || o.id === v);
        return opt?.label || v;
      }).join(', ');
    }
    const opt = opts.find((o: any) => o.value === value || o.id === value);
    return opt?.label || String(value);
  }

  if (typeof value === 'object') {
    if (fieldType === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
    if (Array.isArray(value)) return value.join(', ');
    return JSON.stringify(value);
  }

  if (fieldType === 'date' || fieldType === 'datetime') {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function extractRefIds(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') return v;
        if (v?.submission_ref_id) return v.submission_ref_id;
        if (v?.id) return v.id;
        return null;
      })
      .filter(Boolean) as string[];
  }
  return [];
}
