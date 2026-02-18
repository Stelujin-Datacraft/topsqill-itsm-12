import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ChevronRight, Loader2, ExternalLink, Layers, Link2 } from 'lucide-react';
import { SubmissionRefDisplay } from '@/components/SubmissionRefDisplay';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  submissionId: string;
  submissionRefId: string;
  formName: string;
  formId: string;
}

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
  tableDisplayFields?: string[];
}

interface CrossReferenceDrilldownModalProps {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  submissionRefId: string;
  formId: string;
  formName: string;
}

export function CrossReferenceDrilldownModal({
  open,
  onClose,
  submissionId,
  submissionRefId,
  formId,
  formName,
}: CrossReferenceDrilldownModalProps) {
  const navigate = useNavigate();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [currentSubmissionId, setCurrentSubmissionId] = useState(submissionId);
  const [currentFormId, setCurrentFormId] = useState(formId);
  const [currentFormName, setCurrentFormName] = useState(formName);
  const [currentRefId, setCurrentRefId] = useState(submissionRefId);
  const [fields, setFields] = useState<FieldDisplay[]>([]);
  const [crossRefFields, setCrossRefFields] = useState<CrossRefFieldInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Reset when modal opens with new data
  useEffect(() => {
    if (open) {
      setBreadcrumbs([]);
      setCurrentSubmissionId(submissionId);
      setCurrentFormId(formId);
      setCurrentFormName(formName);
      setCurrentRefId(submissionRefId);
    }
  }, [open, submissionId, formId, formName, submissionRefId]);

  // Fetch record data whenever current submission changes
  useEffect(() => {
    if (!open || !currentSubmissionId || !currentFormId) return;
    fetchRecordData(currentSubmissionId, currentFormId);
  }, [open, currentSubmissionId, currentFormId]);

  const fetchRecordData = async (subId: string, fId: string) => {
    setLoading(true);
    try {
      // Fetch submission data and form fields in parallel
      const [submissionRes, fieldsRes, formRes] = await Promise.all([
        supabase
          .from('form_submissions')
          .select('id, submission_ref_id, submission_data')
          .eq('id', subId)
          .single(),
        supabase
          .from('form_fields')
          .select('id, label, field_type, options, custom_config')
          .eq('form_id', fId)
          .order('field_order'),
        supabase
          .from('forms')
          .select('name')
          .eq('id', fId)
          .single(),
      ]);

      if (submissionRes.error || !submissionRes.data) {
        console.error('Error fetching submission:', submissionRes.error);
        setFields([]);
        setCrossRefFields([]);
        setLoading(false);
        return;
      }

      const submissionData = submissionRes.data.submission_data as Record<string, any>;
      const formFields = fieldsRes.data || [];

      if (formRes.data) {
        setCurrentFormName(formRes.data.name);
      }

      // Separate regular fields and cross-reference fields
      const regularFields: FieldDisplay[] = [];
      const crossRefs: CrossRefFieldInfo[] = [];

      for (const field of formFields) {
        const value = submissionData?.[field.id];
        let customConfig: any = null;
        
        try {
          customConfig = typeof field.custom_config === 'string'
            ? JSON.parse(field.custom_config)
            : field.custom_config;
        } catch { /* ignore */ }

        if (field.field_type === 'cross-reference' || field.field_type === 'child-cross-reference') {
          // Extract linked ref IDs from value
          const linkedRefIds = extractRefIds(value);
          const targetFormId = field.field_type === 'child-cross-reference'
            ? customConfig?.parentFormId
            : customConfig?.targetFormId;

          if (targetFormId && linkedRefIds.length > 0) {
            crossRefs.push({
              fieldId: field.id,
              label: field.label,
              targetFormId,
              targetFormName: customConfig?.targetFormName || 'Linked Form',
              linkedRefIds,
              tableDisplayFields: customConfig?.tableDisplayFields || [],
            });
          }
        } else if (field.field_type !== 'section' && field.field_type !== 'divider') {
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

      // Resolve linked records for cross-reference fields
      const resolvedCrossRefs = await Promise.all(
        crossRefs.map(async (cr) => {
          const { data: linkedSubs } = await supabase
            .from('form_submissions')
            .select('id, submission_ref_id, submission_data')
            .eq('form_id', cr.targetFormId)
            .in('submission_ref_id', cr.linkedRefIds);

          // Get target form name
          const { data: targetForm } = await supabase
            .from('forms')
            .select('name')
            .eq('id', cr.targetFormId)
            .single();

          return {
            ...cr,
            targetFormName: targetForm?.name || cr.targetFormName,
            linkedRecords: linkedSubs || [],
          };
        })
      );

      setFields(regularFields);
      setCrossRefFields(resolvedCrossRefs as any);
    } catch (err) {
      console.error('Error in drill-down fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDrillDown = (
    subId: string,
    refId: string,
    targetFormId: string,
    targetFormName: string
  ) => {
    // Push current to breadcrumbs
    setBreadcrumbs((prev) => [
      ...prev,
      {
        submissionId: currentSubmissionId,
        submissionRefId: currentRefId,
        formName: currentFormName,
        formId: currentFormId,
      },
    ]);
    setCurrentSubmissionId(subId);
    setCurrentRefId(refId);
    setCurrentFormId(targetFormId);
    setCurrentFormName(targetFormName);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index));
    setCurrentSubmissionId(target.submissionId);
    setCurrentRefId(target.submissionRefId);
    setCurrentFormId(target.formId);
    setCurrentFormName(target.formName);
  };

  const formatValue = (field: FieldDisplay): string => {
    const { value, fieldType, options } = field;
    if (value === null || value === undefined || value === '') return '—';

    if ((fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'dropdown') && options) {
      const opts = Array.isArray(options) ? options : [];
      if (Array.isArray(value)) {
        return value.map(v => {
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
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-accent" />
            Record Drill-Down
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb Navigation */}
        <div className="px-6 pb-2">
          <div className="flex items-center gap-1 flex-wrap text-sm">
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={i}>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => handleBreadcrumbClick(i)}
                >
                  {bc.formName}
                </Button>
                <ChevronRight className="h-3 w-3 text-accent/60" />
              </React.Fragment>
            ))}
            <Badge variant="secondary" className="text-xs font-medium">
              {currentFormName}
            </Badge>
          </div>
        </div>

        <Separator />

        <ScrollArea className="flex-1 px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading record...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Record ID */}
              <div className="flex items-center gap-2">
                <SubmissionRefDisplay
                  submissionRefId={currentRefId}
                  submissionId={currentSubmissionId}
                  formName={currentFormName}
                  variant="compact"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => navigate(`/submission/${currentSubmissionId}`)}
                >
                  <ExternalLink className="h-3 w-3 mr-1 text-info" />
                  Open
                </Button>
              </div>

              {/* Regular Fields */}
              {fields.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    Fields
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {fields
                      .filter((f) => f.value !== null && f.value !== undefined && f.value !== '')
                      .map((field) => (
                        <div key={field.id} className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">{field.label}</p>
                          <p className="text-sm font-medium truncate" title={formatValue(field)}>
                            {formatValue(field)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Cross-Reference Fields with Drill-Down */}
              {(crossRefFields as any[]).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-accent" />
                    Linked Records
                  </h4>
                  {(crossRefFields as any[]).map((cr) => (
                    <div key={cr.fieldId} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{cr.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {cr.targetFormName} · {cr.linkedRecords?.length || 0} records
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {(cr.linkedRecords || []).map((rec: any) => (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors group cursor-pointer"
                            onClick={() =>
                              handleDrillDown(rec.id, rec.submission_ref_id, cr.targetFormId, cr.targetFormName)
                            }
                          >
                            <div className="flex items-center gap-2">
                              <SubmissionRefDisplay
                                submissionRefId={rec.submission_ref_id}
                                submissionId={rec.id}
                                formName={cr.targetFormName}
                                variant="compact"
                              />
                              {cr.tableDisplayFields?.length > 0 && (
                                <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                  {cr.tableDisplayFields
                                    .map((fId: string) => rec.submission_data?.[fId])
                                    .filter(Boolean)
                                    .join(' | ')}
                                </span>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ))}
                        {(!cr.linkedRecords || cr.linkedRecords.length === 0) && (
                          <p className="text-xs text-muted-foreground italic px-3 py-2">
                            No linked records found
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {fields.length === 0 && (crossRefFields as any[]).length === 0 && !loading && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No data available for this record.
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function extractRefIds(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
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
