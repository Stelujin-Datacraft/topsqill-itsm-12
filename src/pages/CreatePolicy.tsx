import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePolicies } from '@/hooks/usePolicies';
import { POLICY_CATEGORIES, POLICY_PRIORITIES, REVIEW_CYCLE_OPTIONS } from '@/types/policy';
import type { PolicyTemplate } from '@/types/policy';
import { PolicyContentSource } from '@/components/policies/PolicyContentSource';
import { PolicyFormLink } from '@/components/policies/PolicyFormLink';
import { PolicyDynamicFieldInserter } from '@/components/policies/PolicyDynamicFieldInserter';
import PageContent from '@/components/PageContent';

const INITIAL_FORM = {
  name: '',
  description: '',
  category: 'General',
  department: '',
  compliance_standard: '',
  compliance_reference: '',
  owner_type: 'user' as const,
  priority: 'medium',
  effective_date: '',
  expiry_date: '',
  review_cycle_days: 365,
  acknowledgment_required: false,
  exception_allowed: true,
  content_html: '',
  form_id: '',
};

const CreatePolicy = () => {
  const navigate = useNavigate();
  const { createPolicy, templates, templatesLoading } = usePolicies();
  const [contentMode, setContentMode] = useState('blank');
  const [selectedTemplate, setSelectedTemplate] = useState<PolicyTemplate | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

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

    await createPolicy.mutateAsync({
      name: form.name,
      description: form.description || undefined,
      category: form.category,
      department: form.department || undefined,
      compliance_standard: form.compliance_standard || undefined,
      compliance_reference: form.compliance_reference || undefined,
      owner_type: form.owner_type,
      priority: form.priority as any,
      effective_date: form.effective_date || undefined,
      expiry_date: form.expiry_date || undefined,
      review_cycle_days: form.review_cycle_days,
      next_review_date,
      acknowledgment_required: form.acknowledgment_required,
      exception_allowed: form.exception_allowed,
      content: form.content_html ? { html: form.content_html } : (selectedTemplate?.content_structure || {}),
      template_id: selectedTemplate?.id,
      form_id: form.form_id || undefined,
      status: 'draft',
      tags: [],
      attachments: [] as any,
    });

    navigate('/policies');
  };

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <PageContent
      title="Create New Policy"
      description="Define a new organizational policy with content, metadata, and governance settings"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/policies')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || createPolicy.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {createPolicy.isPending ? 'Creating...' : 'Create Policy'}
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

        {/* Policy Content Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Policy Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.form_id && (
              <PolicyDynamicFieldInserter
                formId={form.form_id}
                onInsert={(placeholder) => {
                  const event = new CustomEvent('tiptap-insert-text', { detail: placeholder });
                  window.dispatchEvent(event);
                }}
              />
            )}
            <PolicyContentSource
              contentHtml={form.content_html}
              onContentChange={html => updateField('content_html', html)}
              templates={templates}
              templatesLoading={templatesLoading}
              selectedTemplate={selectedTemplate}
              onTemplateSelect={handleTemplateSelect}
              mode={contentMode}
              onModeChange={setContentMode}
            />
          </CardContent>
        </Card>

        {/* Form Link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dynamic Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <PolicyFormLink
              formId={form.form_id}
              onFormIdChange={id => updateField('form_id', id)}
            />
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Classification & Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => updateField('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POLICY_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => updateField('priority', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POLICY_PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={e => updateField('department', e.target.value)}
                  placeholder="e.g., Engineering, HR"
                />
              </div>
              <div>
                <Label>Owner Type</Label>
                <Select value={form.owner_type} onValueChange={v => updateField('owner_type', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Compliance Standard</Label>
                <Input
                  value={form.compliance_standard}
                  onChange={e => updateField('compliance_standard', e.target.value)}
                  placeholder="e.g., ISO 27001, GDPR"
                />
              </div>
              <div>
                <Label>Compliance Reference</Label>
                <Input
                  value={form.compliance_reference}
                  onChange={e => updateField('compliance_reference', e.target.value)}
                  placeholder="e.g., Section 4.2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates & Governance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dates & Governance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={form.effective_date}
                  onChange={e => updateField('effective_date', e.target.value)}
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={e => updateField('expiry_date', e.target.value)}
                />
              </div>
              <div>
                <Label>Review Cycle</Label>
                <Select
                  value={String(form.review_cycle_days)}
                  onValueChange={v => updateField('review_cycle_days', Number(v))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REVIEW_CYCLE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.acknowledgment_required}
                  onCheckedChange={v => updateField('acknowledgment_required', v)}
                />
                <Label className="text-sm cursor-pointer">Require Acknowledgment</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.exception_allowed}
                  onCheckedChange={v => updateField('exception_allowed', v)}
                />
                <Label className="text-sm cursor-pointer">Allow Exceptions</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContent>
  );
};

export default CreatePolicy;
