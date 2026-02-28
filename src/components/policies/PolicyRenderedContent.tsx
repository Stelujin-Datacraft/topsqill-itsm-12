import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, Users } from 'lucide-react';

interface PolicyRenderedContentProps {
  contentHtml: string;
  formId?: string;
}

/**
 * Renders policy content with dynamic field resolution.
 * If a form is linked, each form submission creates a separate section
 * with {{Field Label}} placeholders replaced by actual submission values.
 */
export function PolicyRenderedContent({ contentHtml, formId }: PolicyRenderedContentProps) {
  // Fetch form fields to map field IDs to labels
  const fieldsQuery = useQuery({
    queryKey: ['policy-form-fields', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type, options')
        .eq('form_id', formId!)
        .order('field_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Fetch form info
  const formQuery = useQuery({
    queryKey: ['policy-form-info', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('name')
        .eq('id', formId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  // Fetch all submissions for the linked form
  const submissionsQuery = useQuery({
    queryKey: ['policy-form-submissions', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submission_data, submitted_at')
        .eq('form_id', formId!)
        .order('submitted_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Check if content has any placeholders
  const hasPlaceholders = /\{\{.+?\}\}/.test(contentHtml);

  // If no form linked or no placeholders, show raw content
  if (!formId || !hasPlaceholders) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    );
  }

  // Loading state
  if (fieldsQuery.isLoading || submissionsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading form data and resolving dynamic fields...</span>
      </div>
    );
  }

  const fields = fieldsQuery.data || [];
  const submissions = submissionsQuery.data || [];

  // Build label-to-field mapping
  const labelToFieldMap = new Map<string, { id: string; field_type: string; options: any }>();
  fields.forEach(f => {
    labelToFieldMap.set(f.label, { id: f.id, field_type: f.field_type, options: f.options });
  });

  // Function to resolve placeholders in HTML with submission data
  const resolveContent = (html: string, submissionData: Record<string, any>): string => {
    return html.replace(/\{\{(.+?)\}\}/g, (match, label) => {
      const trimmedLabel = label.trim();
      const fieldInfo = labelToFieldMap.get(trimmedLabel);
      if (!fieldInfo) return `<span class="text-muted-foreground italic">[${trimmedLabel}: not found]</span>`;

      const value = submissionData?.[fieldInfo.id];
      if (value === null || value === undefined || value === '') {
        return `<span class="text-muted-foreground italic">[${trimmedLabel}: empty]</span>`;
      }

      const formatted = formatValue(value, fieldInfo.field_type, fieldInfo.options);
      return `<strong>${formatted}</strong>`;
    });
  };

  if (submissions.length === 0) {
    return (
      <div className="space-y-4">
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          <FileText className="h-5 w-5 mx-auto mb-2" />
          No submissions found for the linked form{formQuery.data?.name ? ` "${formQuery.data.name}"` : ''}.
          Dynamic fields will be resolved once records are submitted.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {submissions.length} record{submissions.length !== 1 ? 's' : ''} from{' '}
          <strong className="text-foreground">{formQuery.data?.name || 'linked form'}</strong>
        </span>
      </div>

      {submissions.map((submission, index) => {
        const data = typeof submission.submission_data === 'string'
          ? JSON.parse(submission.submission_data)
          : submission.submission_data || {};
        const resolvedHtml = resolveContent(contentHtml, data);

        return (
          <Card key={submission.id} className="border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {submission.submission_ref_id || `Record ${index + 1}`}
                  </Badge>
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {new Date(submission.submitted_at).toLocaleDateString()}
                </span>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: resolvedHtml }}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function formatValue(value: any, fieldType?: string, options?: any): string {
  if (value === null || value === undefined) return 'N/A';

  if ((fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'dropdown') && options) {
    const optionsArray = Array.isArray(options) ? options : [];
    if (Array.isArray(value)) {
      return value.map(v => {
        const opt = optionsArray.find((o: any) => o.value === v || o.id === v || o.label === v);
        return opt?.label || v;
      }).join(', ');
    }
    const opt = optionsArray.find((o: any) => o.value === value || o.id === value || o.label === value);
    if (opt?.label) return opt.label;
  }

  if (typeof value === 'object') {
    if (fieldType === 'currency' && value.amount) return `${value.currency || ''} ${value.amount}`;
    if (fieldType === 'address') {
      return [value.street, value.city, value.state, value.postal, value.country].filter(Boolean).join(', ');
    }
    if (Array.isArray(value)) return value.join(', ');
    return JSON.stringify(value);
  }

  if (fieldType === 'date' || fieldType === 'datetime') {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }

  return String(value);
}
