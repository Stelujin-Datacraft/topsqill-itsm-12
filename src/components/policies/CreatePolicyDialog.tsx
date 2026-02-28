import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { usePolicies } from '@/hooks/usePolicies';
import { POLICY_CATEGORIES, POLICY_PRIORITIES, REVIEW_CYCLE_OPTIONS } from '@/types/policy';
import type { PolicyTemplate } from '@/types/policy';
import { PolicyContentSource } from './PolicyContentSource';
import { PolicyFormLink } from './PolicyFormLink';

interface CreatePolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function CreatePolicyDialog({ open, onOpenChange }: CreatePolicyDialogProps) {
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

    setForm(INITIAL_FORM);
    setSelectedTemplate(null);
    setContentMode('blank');
    onOpenChange(false);
  };

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Create New Policy</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-140px)] pr-4">
          <div className="space-y-5">
            {/* Core fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Policy Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="e.g., Information Security Policy"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Brief description of the policy..."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Policy Content Source */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Policy Content</Label>
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
            </div>

            <Separator />

            {/* Form Link for Dynamic Fields */}
            <PolicyFormLink
              formId={form.form_id}
              onFormIdChange={id => updateField('form_id', id)}
            />

            <Separator />

            {/* Metadata fields */}
            <div className="grid grid-cols-2 gap-4">
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

              {/* Toggles */}
              <div className="col-span-2 flex items-center gap-6 pt-2">
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
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || createPolicy.isPending}>
            {createPolicy.isPending ? 'Creating...' : 'Create Policy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
