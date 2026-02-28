import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FileText, Sparkles } from 'lucide-react';
import { usePolicies } from '@/hooks/usePolicies';
import { POLICY_CATEGORIES, POLICY_PRIORITIES, REVIEW_CYCLE_OPTIONS } from '@/types/policy';
import type { PolicyTemplate } from '@/types/policy';
import { TiptapEditor } from '@/components/ui/tiptap-editor';

interface CreatePolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePolicyDialog({ open, onOpenChange }: CreatePolicyDialogProps) {
  const { createPolicy, templates, templatesLoading } = usePolicies();
  const [mode, setMode] = useState<'blank' | 'template'>('blank');
  const [selectedTemplate, setSelectedTemplate] = useState<PolicyTemplate | null>(null);
  const [form, setForm] = useState({
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
  });

  const handleTemplateSelect = (template: PolicyTemplate) => {
    setSelectedTemplate(template);
    setForm(prev => ({
      ...prev,
      name: template.name,
      description: template.description || '',
      category: template.category,
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    // Calculate next_review_date from effective_date + review_cycle_days
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
      status: 'draft',
      tags: [],
      attachments: [] as any,
    });

    // Reset
    setForm({
      name: '', description: '', category: 'General', department: '',
      compliance_standard: '', compliance_reference: '', owner_type: 'user',
      priority: 'medium', effective_date: '', expiry_date: '',
      review_cycle_days: 365, acknowledgment_required: false, exception_allowed: true,
      content_html: '',
    });
    setSelectedTemplate(null);
    setMode('blank');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Create New Policy</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={v => setMode(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="blank" className="flex-1 gap-2">
              <FileText className="h-4 w-4" />
              Blank Policy
            </TabsTrigger>
            <TabsTrigger value="template" className="flex-1 gap-2">
              <Sparkles className="h-4 w-4" />
              From Template
            </TabsTrigger>
          </TabsList>

          <TabsContent value="template">
            <ScrollArea className="max-h-[200px] border rounded-md p-3 mb-4">
              {templatesLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading templates...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No templates available.</p>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      onClick={() => handleTemplateSelect(t)}
                      className={`p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{t.name}</span>
                        <Badge variant="outline">{t.category}</Badge>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="blank">
            <div className="h-1" />
          </TabsContent>
        </Tabs>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Core fields */}
              <div className="col-span-2">
                <Label>Policy Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Information Security Policy"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the policy..."
                  rows={2}
                />
              </div>
              <div className="col-span-2">
                <Label>Policy Content</Label>
                <TiptapEditor
                  content={form.content_html}
                  onChange={(html) => setForm(prev => ({ ...prev, content_html: html }))}
                  placeholder="Write the full policy content here..."
                  className="min-h-[150px]"
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(prev => ({ ...prev, category: v }))}>
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
                <Select value={form.priority} onValueChange={v => setForm(prev => ({ ...prev, priority: v }))}>
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
                  onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="e.g., Engineering, HR"
                />
              </div>
              <div>
                <Label>Owner Type</Label>
                <Select value={form.owner_type} onValueChange={v => setForm(prev => ({ ...prev, owner_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Compliance */}
              <div>
                <Label>Compliance Standard</Label>
                <Input
                  value={form.compliance_standard}
                  onChange={e => setForm(prev => ({ ...prev, compliance_standard: e.target.value }))}
                  placeholder="e.g., ISO 27001, GDPR"
                />
              </div>
              <div>
                <Label>Compliance Reference</Label>
                <Input
                  value={form.compliance_reference}
                  onChange={e => setForm(prev => ({ ...prev, compliance_reference: e.target.value }))}
                  placeholder="e.g., Section 4.2"
                />
              </div>

              {/* Dates & Review */}
              <div>
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={form.effective_date}
                  onChange={e => setForm(prev => ({ ...prev, effective_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={e => setForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Review Cycle</Label>
                <Select
                  value={String(form.review_cycle_days)}
                  onValueChange={v => setForm(prev => ({ ...prev, review_cycle_days: Number(v) }))}
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
                    onCheckedChange={v => setForm(prev => ({ ...prev, acknowledgment_required: v }))}
                  />
                  <Label className="text-sm cursor-pointer">Require Acknowledgment</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.exception_allowed}
                    onCheckedChange={v => setForm(prev => ({ ...prev, exception_allowed: v }))}
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
