import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePolicies } from '@/hooks/usePolicies';
import { POLICY_CATEGORIES } from '@/types/policy';
import type { PolicyTemplate } from '@/types/policy';
import { PolicyContentSource } from '@/components/policies/PolicyContentSource';
import { PolicyFormLink } from '@/components/policies/PolicyFormLink';
import { PolicyRecordSelector } from '@/components/policies/PolicyRecordSelector';
import PageContent from '@/components/PageContent';
import { PolicyCustomFieldsBuilder, type PolicyCustomField } from '@/components/policies/PolicyCustomFieldsBuilder';


const INITIAL_FORM = {
  name: '',
  description: '',
  category: 'General',
  department: '',
  owner_type: 'user' as const,
  priority: 'medium',
  effective_date: '',
  expiry_date: '',
  review_cycle_days: 365,
  acknowledgment_required: false,
  exception_allowed: true,
  content_html: '',
  form_id: '',
  dynamic_fields_display: 'table' as 'table' | 'field-value',
  selected_field_ids: [] as string[],
};

const CreatePolicy = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderParam = searchParams.get('folder') || '';
  const typeParam = searchParams.get('type') || 'policy';
  const isAudit = typeParam === 'audit';
  const { createPolicy, templates, templatesLoading } = usePolicies();
  const [contentMode, setContentMode] = useState('upload');
  const [selectedTemplate, setSelectedTemplate] = useState<PolicyTemplate | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [originalDocxFile, setOriginalDocxFile] = useState<File | null>(null);

  const handleTemplateSelect = (template: PolicyTemplate) => {
    setSelectedTemplate(template);
    const templateHtml = template.content_structure?.html || '';
    setForm(prev => ({
      ...prev,
      name: template.name,
      description: template.description || '',
      category: template.category,
      content_html: templateHtml,
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    let next_review_date: string | undefined;
    if (form.effective_date && form.review_cycle_days) {
      const d = new Date(form.effective_date);
      d.setDate(d.getDate() + form.review_cycle_days);
      next_review_date = d.toISOString().split('T')[0];
    }

    // Upload original DOCX if available
    let originalDocxUrl: string | undefined;
    if (originalDocxFile) {
      const filePath = `policies/originals/${Date.now()}_${originalDocxFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('policy-attachments')
        .upload(filePath, originalDocxFile);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from('policy-attachments')
          .getPublicUrl(filePath);
        originalDocxUrl = urlData.publicUrl;
      }
    }

    await createPolicy.mutateAsync({
      name: form.name,
      description: form.description || undefined,
      category: form.category,
      department: form.department || undefined,
      owner_type: form.owner_type,
      priority: form.priority as any,
      effective_date: form.effective_date || undefined,
      expiry_date: form.expiry_date || undefined,
      review_cycle_days: form.review_cycle_days,
      next_review_date,
      acknowledgment_required: form.acknowledgment_required,
      exception_allowed: form.exception_allowed,
      content: {
        ...(form.content_html ? { html: form.content_html } : (selectedTemplate?.content_structure || {})),
        dynamic_fields_display: form.form_id ? form.dynamic_fields_display : undefined,
        selected_field_ids: form.form_id && form.selected_field_ids.length > 0 ? form.selected_field_ids : undefined,
        selected_record_ids: form.form_id && selectedRecords.length > 0 ? selectedRecords : undefined,
        record_name_field_id: form.form_id && recordNameFieldId ? recordNameFieldId : undefined,
        original_docx_url: originalDocxUrl,
        original_docx_name: originalDocxFile?.name,
        custom_fields: customFields.length > 0 ? customFields : undefined,
        custom_field_values: customFields.length > 0 ? customFieldValues : undefined,
      },
      template_id: selectedTemplate?.id,
      form_id: form.form_id || undefined,
      status: 'draft',
      tags: [],
      attachments: [] as any,
      folder_id: folderParam && folderParam !== 'unassigned' ? folderParam : undefined,
      item_type: typeParam,
    } as any);

    if (folderParam) {
      navigate(`/knowledge-base/${folderParam}`);
    } else {
      navigate('/knowledge-base');
    }
  };

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<PolicyCustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [recordNameFieldId, setRecordNameFieldId] = useState('');

  return (
    <PageContent
      title={isAudit ? "Create New Audit" : "Create New Doc"}
      description={isAudit ? "Define a new audit with content, metadata, and governance settings" : "Define a new document with content, metadata, and governance settings"}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => folderParam ? navigate(`/knowledge-base/${folderParam}`) : navigate('/knowledge-base')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || createPolicy.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {createPolicy.isPending ? 'Creating...' : isAudit ? 'Create Audit' : 'Create Doc'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Core Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Policy Name *</Label>
              <Input
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="e.g., Information Security Policy"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Brief description of the policy..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Policy Content - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Policy Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PolicyContentSource
              contentHtml={form.content_html}
              onContentChange={html => updateField('content_html', html)}
              onOriginalFileChange={setOriginalDocxFile}
              templates={templates}
              templatesLoading={templatesLoading}
              selectedTemplate={selectedTemplate}
              onTemplateSelect={handleTemplateSelect}
              mode={contentMode}
              onModeChange={setContentMode}
            />
          </CardContent>
        </Card>

        {/* Dynamic Fields - Full Width Below Content */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Dynamic Fields</CardTitle>
              {form.form_id && (
                <Select
                  value={form.dynamic_fields_display}
                  onValueChange={v => updateField('dynamic_fields_display', v as 'table' | 'field-value')}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table Format</SelectItem>
                    <SelectItem value="field-value">Field & Value</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <PolicyFormLink
              formId={form.form_id}
              onFormIdChange={(id) => {
                updateField("form_id", id);
                if (!id) {
                  updateField("selected_field_ids", []);
                  setRecordNameFieldId('');
                }
              }}
            />

            {form.form_id && (
              <PolicyRecordSelector
                formId={form.form_id}
                selectedFieldIds={form.selected_field_ids}
                selectedRecordIds={selectedRecords}
                onSelectedRecordsChange={setSelectedRecords}
                onSelectedFieldsChange={(ids) => updateField("selected_field_ids", ids)}
                recordNameFieldId={recordNameFieldId}
                onRecordNameFieldChange={setRecordNameFieldId}
              />
            )}
          </CardContent>
        </Card>

        {/* Custom Fields Builder with inline values */}
        <PolicyCustomFieldsBuilder
          fields={customFields}
          onFieldsChange={setCustomFields}
          values={customFieldValues}
          onValuesChange={setCustomFieldValues}
        />
      </div>
    </PageContent>
  );
};

export default CreatePolicy;
