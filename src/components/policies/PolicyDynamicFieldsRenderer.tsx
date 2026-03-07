import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Database } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface PolicyDynamicFieldsRendererProps {
  formId: string;
  displayFormat: 'table' | 'field-value';
  selectedFieldIds?: string[];
  selectedRecordIds?: string[];
}

export function PolicyDynamicFieldsRenderer({ formId, displayFormat, selectedFieldIds, selectedRecordIds }: PolicyDynamicFieldsRendererProps) {
  const formQuery = useQuery({
    queryKey: ['policy-form-info', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('id, name, reference_id')
        .eq('id', formId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  const fieldsQuery = useQuery({
    queryKey: ['policy-form-fields', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type, options, field_order, custom_config')
        .eq('form_id', formId)
        .order('field_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  const submissionsQuery = useQuery({
    queryKey: ['policy-form-submissions', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submission_data, submitted_at')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Resolve cross-reference linked records
  const crossRefFields = (fieldsQuery.data || []).filter(f =>
    ['cross-reference', 'child-cross-reference'].includes(f.field_type)
  );

  const crossRefSubmissionIds = React.useMemo(() => {
    if (!submissionsQuery.data || crossRefFields.length === 0) return [];
    const ids = new Set<string>();
    for (const sub of submissionsQuery.data) {
      const data = sub.submission_data as Record<string, any>;
      for (const field of crossRefFields) {
        const val = data?.[field.id];
        if (Array.isArray(val)) {
          val.forEach((v: any) => {
            if (v?.id) ids.add(v.id);
          });
        } else if (val?.id) {
          ids.add(val.id);
        }
      }
    }
    return Array.from(ids);
  }, [submissionsQuery.data, crossRefFields]);

  const linkedRecordsQuery = useQuery({
    queryKey: ['policy-cross-ref-records', crossRefSubmissionIds],
    queryFn: async () => {
      if (crossRefSubmissionIds.length === 0) return {};
      // Fetch in batches of 50
      const results: Record<string, any> = {};
      for (let i = 0; i < crossRefSubmissionIds.length; i += 50) {
        const batch = crossRefSubmissionIds.slice(i, i + 50);
        const { data } = await supabase
          .from('form_submissions')
          .select('id, submission_ref_id, submission_data, form_id')
          .in('id', batch);
        if (data) {
          for (const rec of data) {
            results[rec.id] = rec;
          }
        }
      }

      // Also fetch field labels for each unique target form
      const formIds = [...new Set(Object.values(results).map((r: any) => r.form_id))];
      const fieldLabels: Record<string, Record<string, string>> = {};
      for (const fid of formIds) {
        const { data: fields } = await supabase
          .from('form_fields')
          .select('id, label, field_type')
          .eq('form_id', fid)
          .order('field_order');
        if (fields) {
          fieldLabels[fid] = {};
          fields.filter(f => !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break', 'child-cross-reference'].includes(f.field_type))
            .forEach(f => { fieldLabels[fid][f.id] = f.label; });
        }
      }

      return { records: results, fieldLabels };
    },
    enabled: crossRefSubmissionIds.length > 0,
  });

  if (!formId) return null;

  const isLoading = formQuery.isLoading || fieldsQuery.isLoading || submissionsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading dynamic field data...</span>
      </div>
    );
  }

  const fields = fieldsQuery.data || [];
  const allSubmissions = submissionsQuery.data || [];
  const submissions = selectedRecordIds?.length ? allSubmissions.filter(s => selectedRecordIds.includes(s.id)) : allSubmissions;
  const formName = formQuery.data?.name || 'Linked Form';
  const linkedData = linkedRecordsQuery.data || { records: {}, fieldLabels: {} };

  const allDataFields = fields.filter(f =>
    !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.field_type)
  );
  const dataFields = selectedFieldIds?.length ? allDataFields.filter(f => selectedFieldIds.includes(f.id)) : allDataFields;

  if (submissions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No records found in the linked form "{formName}".
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Submit data to the form to see dynamic field values here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Dynamic Data — {formName}
        </h3>
        <Badge variant="outline" className="text-xs">
          {submissions.length} record{submissions.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {submissions.map((submission, index) => {
        const refId = submission.submission_ref_id || submission.id.slice(0, 8);
        const sectionTitle = `Policy ${index + 1} — ${refId}`;

        return (
          <Card key={submission.id}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold">{sectionTitle}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {displayFormat === 'table' ? (
                <TableFormatView
                  fields={dataFields}
                  submissionData={submission.submission_data as Record<string, any>}
                  linkedData={linkedData}
                />
              ) : (
                <FieldValueFormatView
                  fields={dataFields}
                  submissionData={submission.submission_data as Record<string, any>}
                  linkedData={linkedData}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface LinkedData {
  records?: Record<string, any>;
  fieldLabels?: Record<string, Record<string, string>>;
}

function resolveCrossRefValue(value: any, linkedData: LinkedData): string {
  if (!value) return '—';

  const resolveOne = (v: any): string => {
    if (typeof v !== 'object' || !v) return String(v);
    const recId = v.id;
    const rec = linkedData.records?.[recId];
    if (!rec) {
      return v.submission_ref_id || v.id?.slice(0, 8) || JSON.stringify(v);
    }

    const refId = rec.submission_ref_id || rec.id.slice(0, 8);
    const formFieldLabels = linkedData.fieldLabels?.[rec.form_id] || {};
    const subData = rec.submission_data || {};

    // Get first 3 meaningful field values with labels
    const displayParts: string[] = [];
    const labelEntries = Object.entries(formFieldLabels).slice(0, 4);
    for (const [fieldId, label] of labelEntries) {
      const val = subData[fieldId];
      if (val !== null && val !== undefined && val !== '' && typeof val !== 'object') {
        displayParts.push(`${label}: ${val}`);
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        // Handle currency, address, etc.
        if (val.amount) displayParts.push(`${label}: ${val.currency || ''} ${val.amount}`);
        else if (val.street) displayParts.push(`${label}: ${[val.street, val.city].filter(Boolean).join(', ')}`);
      }
      if (displayParts.length >= 3) break;
    }

    return displayParts.length > 0
      ? `${refId} — ${displayParts.join(' | ')}`
      : refId;
  };

  if (Array.isArray(value)) {
    const resolved = value.map(resolveOne).filter(Boolean);
    return resolved.length > 0 ? resolved.join('; ') : '—';
  }

  return resolveOne(value);
}

function formatValue(value: any, fieldType: string, options?: any, linkedData?: LinkedData): string {
  if (value === null || value === undefined || value === '') return '—';

  if (['cross-reference', 'child-cross-reference', 'dynamic-table'].includes(fieldType)) {
    return resolveCrossRefValue(value, linkedData || {});
  }

  if (['select', 'radio', 'checkbox', 'dropdown'].includes(fieldType) && options) {
    const optionsArray = Array.isArray(options) ? options : [];
    if (Array.isArray(value)) {
      return value.map(v => {
        const opt = optionsArray.find((o: any) => o.value === v || o.id === v || o.label === v);
        return opt?.label || v;
      }).join(', ') || '—';
    }
    const opt = optionsArray.find((o: any) => o.value === value || o.id === value || o.label === value);
    if (opt?.label) return opt.label;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    if (fieldType === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
    if (fieldType === 'address') {
      return [value.street, value.city, value.state, value.postal, value.country].filter(Boolean).join(', ');
    }
    if (value.submission_ref_id) return value.submission_ref_id;
    if (value.label) return value.label;
    if (value.name) return value.name;
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) return value.map(v => typeof v === 'object' ? (v?.submission_ref_id || v?.label || JSON.stringify(v)) : String(v)).join(', ');

  if (fieldType === 'date' || fieldType === 'datetime') {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }

  return String(value);
}

function TableFormatView({
  fields,
  submissionData,
  linkedData,
}: {
  fields: Array<{ id: string; label: string; field_type: string; options: any }>;
  submissionData: Record<string, any>;
  linkedData: LinkedData;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Field</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map(field => {
          const rawValue = submissionData?.[field.id];
          const displayValue = formatValue(rawValue, field.field_type, field.options, linkedData);
          return (
            <TableRow key={field.id}>
              <TableCell className="font-medium text-sm">{field.label}</TableCell>
              <TableCell className="text-sm">{displayValue}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function FieldValueFormatView({
  fields,
  submissionData,
  linkedData,
}: {
  fields: Array<{ id: string; label: string; field_type: string; options: any }>;
  submissionData: Record<string, any>;
  linkedData: LinkedData;
}) {
  return (
    <div className="space-y-3">
      {fields.map((field, idx) => {
        const rawValue = submissionData?.[field.id];
        const displayValue = formatValue(rawValue, field.field_type, field.options, linkedData);
        return (
          <div key={field.id}>
            {idx > 0 && <Separator className="mb-3" />}
            <div className="font-semibold text-sm text-foreground">{field.label}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{displayValue}</div>
          </div>
        );
      })}
    </div>
  );
}
