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
}

export function PolicyDynamicFieldsRenderer({ formId, displayFormat, selectedFieldIds }: PolicyDynamicFieldsRendererProps) {
  // Fetch form info
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

  // Fetch form fields for labels and ordering
  const fieldsQuery = useQuery({
    queryKey: ['policy-form-fields', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type, options, field_order')
        .eq('form_id', formId)
        .order('field_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Fetch all submissions for this form
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
  const submissions = submissionsQuery.data || [];
  const formName = formQuery.data?.name || 'Linked Form';

  // Filter out layout/section fields that don't hold data
  const allDataFields = fields.filter(f =>
    !['section', 'divider', 'heading', 'paragraph', 'spacer', 'page-break'].includes(f.field_type)
  );
  // If selectedFieldIds is provided and non-empty, only show those fields
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
                />
              ) : (
                <FieldValueFormatView
                  fields={dataFields}
                  submissionData={submission.submission_data as Record<string, any>}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TableFormatView({
  fields,
  submissionData,
}: {
  fields: Array<{ id: string; label: string; field_type: string; options: any }>;
  submissionData: Record<string, any>;
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
          const displayValue = formatValue(rawValue, field.field_type, field.options);
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
}: {
  fields: Array<{ id: string; label: string; field_type: string; options: any }>;
  submissionData: Record<string, any>;
}) {
  return (
    <div className="space-y-3">
      {fields.map((field, idx) => {
        const rawValue = submissionData?.[field.id];
        const displayValue = formatValue(rawValue, field.field_type, field.options);
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

function safeStringify(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val !== 'object') return String(val);
  if (Array.isArray(val)) return val.map(safeStringify).filter(Boolean).join(', ');
  // Extract meaningful string from object
  if (val.submission_ref_id) return val.submission_ref_id;
  if (val.label) return val.label;
  if (val.name) return val.name;
  if (val.title) return val.title;
  // Last resort: extract primitive values
  const primitives = Object.values(val).filter(v => v !== null && v !== undefined && typeof v !== 'object');
  if (primitives.length > 0) return primitives.slice(0, 3).map(String).join(', ');
  return JSON.stringify(val);
}

function extractRecordDisplay(v: any): string {
  if (!v || typeof v !== 'object') return v ? String(v) : '';
  const refId = v.submission_ref_id || v.id?.slice(0, 8) || '';
  const displayParts: string[] = [];
  if (refId) displayParts.push(refId);

  if (v.displayData) {
    displayParts.push(safeStringify(v.displayData));
  } else if (v.submission_data && typeof v.submission_data === 'object') {
    const dataVals = Object.values(v.submission_data)
      .filter((val: any) => val !== null && val !== undefined && val !== '')
      .slice(0, 3)
      .map(safeStringify)
      .filter(Boolean);
    if (dataVals.length > 0) displayParts.push(...dataVals);
  } else {
    if (v.name) displayParts.push(String(v.name));
    else if (v.label) displayParts.push(String(v.label));
    else if (v.title) displayParts.push(String(v.title));
  }
  return displayParts.length > 0 ? displayParts.join(' — ') : safeStringify(v);
}

function formatValue(value: any, fieldType: string, options?: any): string {
  if (value === null || value === undefined || value === '') return '—';

  // Handle cross-reference and child-cross-reference fields
  if (['cross-reference', 'child-cross-reference', 'dynamic-table'].includes(fieldType)) {
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'object' && v !== null ? extractRecordDisplay(v) : String(v))
        .filter(Boolean).join(', ') || '—';
    }
    if (typeof value === 'object' && value !== null) {
      return extractRecordDisplay(value) || '—';
    }
    return String(value);
  }

  // Handle select/radio/checkbox - resolve option labels
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

  // Handle objects
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (fieldType === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
    if (fieldType === 'address') {
      return [value.street, value.city, value.state, value.postal, value.country].filter(Boolean).join(', ');
    }
    // Fallback: try to extract meaningful display from any object
    if (value.submission_ref_id) return value.submission_ref_id;
    if (value.label) return value.label;
    if (value.name) return value.name;
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) return value.map(v => typeof v === 'object' ? (v?.submission_ref_id || v?.label || JSON.stringify(v)) : String(v)).join(', ');

  // Date
  if (fieldType === 'date' || fieldType === 'datetime') {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }

  return String(value);
}
