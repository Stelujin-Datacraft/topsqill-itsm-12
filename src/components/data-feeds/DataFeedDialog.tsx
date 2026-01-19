import { useState, useEffect } from 'react';
import { DataFeed, DataFeedFormData, FieldMapping, MatchingRule, SCHEDULE_PRESETS } from '@/types/dataFeed';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DataFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed?: DataFeed | null;
  projectId: string;
  onSave: (data: DataFeedFormData) => Promise<boolean>;
}

interface FormOption {
  id: string;
  name: string;
}

interface FieldOption {
  id: string;
  label: string;
  field_type: string;
}

export function DataFeedDialog({
  open,
  onOpenChange,
  feed,
  projectId,
  onSave,
}: DataFeedDialogProps) {
  const [saving, setSaving] = useState(false);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [sourceFields, setSourceFields] = useState<FieldOption[]>([]);
  const [targetFields, setTargetFields] = useState<FieldOption[]>([]);
  const [crossRefFields, setCrossRefFields] = useState<FieldOption[]>([]);

  const [formData, setFormData] = useState<DataFeedFormData>({
    name: '',
    description: '',
    source_form_id: '',
    target_form_id: '',
    matching_type: 'field_matching',
    matching_rules: [],
    field_mappings: [],
    no_match_behavior: 'skip',
    schedule: '',
    is_active: true,
  });

  // Load forms
  useEffect(() => {
    if (!projectId || !open) return;

    const fetchForms = async () => {
      const { data } = await supabase
        .from('forms')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');
      
      setForms(data || []);
    };

    fetchForms();
  }, [projectId, open]);

  // Load source form fields
  useEffect(() => {
    if (!formData.source_form_id) {
      setSourceFields([]);
      setCrossRefFields([]);
      return;
    }

    const fetchFields = async () => {
      const { data } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formData.source_form_id)
        .order('field_order');

      setSourceFields(data || []);
      setCrossRefFields((data || []).filter(f => f.field_type === 'cross-reference'));
    };

    fetchFields();
  }, [formData.source_form_id]);

  // Load target form fields
  useEffect(() => {
    if (!formData.target_form_id) {
      setTargetFields([]);
      return;
    }

    const fetchFields = async () => {
      const { data } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formData.target_form_id)
        .order('field_order');

      setTargetFields(data || []);
    };

    fetchFields();
  }, [formData.target_form_id]);

  // Initialize form data when editing
  useEffect(() => {
    if (feed) {
      setFormData({
        name: feed.name,
        description: feed.description || '',
        source_form_id: feed.source_form_id,
        target_form_id: feed.target_form_id,
        matching_type: feed.matching_type,
        cross_reference_field_id: feed.cross_reference_field_id,
        matching_rules: feed.matching_rules || [],
        field_mappings: feed.field_mappings || [],
        no_match_behavior: feed.no_match_behavior,
        schedule: feed.schedule || '',
        is_active: feed.is_active,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        source_form_id: '',
        target_form_id: '',
        matching_type: 'field_matching',
        matching_rules: [],
        field_mappings: [],
        no_match_behavior: 'skip',
        schedule: '',
        is_active: true,
      });
    }
  }, [feed, open]);

  const handleSave = async () => {
    if (!formData.name || !formData.source_form_id || !formData.target_form_id) return;

    setSaving(true);
    const success = await onSave(formData);
    setSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const addMatchingRule = () => {
    setFormData(prev => ({
      ...prev,
      matching_rules: [...prev.matching_rules, { sourceFieldId: '', targetFieldId: '' }],
    }));
  };

  const updateMatchingRule = (index: number, field: keyof MatchingRule, value: string) => {
    const sourceField = field === 'sourceFieldId' ? sourceFields.find(f => f.id === value) : null;
    const targetField = field === 'targetFieldId' ? targetFields.find(f => f.id === value) : null;

    setFormData(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.map((rule, i) => 
        i === index ? { 
          ...rule, 
          [field]: value,
          ...(sourceField ? { sourceFieldName: sourceField.label } : {}),
          ...(targetField ? { targetFieldName: targetField.label } : {}),
        } : rule
      ),
    }));
  };

  const removeMatchingRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.filter((_, i) => i !== index),
    }));
  };

  const addFieldMapping = () => {
    setFormData(prev => ({
      ...prev,
      field_mappings: [...prev.field_mappings, { sourceFieldId: '', targetFieldId: '' }],
    }));
  };

  const updateFieldMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const sourceField = field === 'sourceFieldId' ? sourceFields.find(f => f.id === value) : null;
    const targetField = field === 'targetFieldId' ? targetFields.find(f => f.id === value) : null;

    setFormData(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.map((mapping, i) => 
        i === index ? { 
          ...mapping, 
          [field]: value,
          ...(sourceField ? { sourceFieldName: sourceField.label } : {}),
          ...(targetField ? { targetFieldName: targetField.label } : {}),
        } : mapping
      ),
    }));
  };

  const removeFieldMapping = (index: number) => {
    setFormData(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{feed ? 'Edit Data Feed' : 'Create Data Feed'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="matching">Matching</TabsTrigger>
              <TabsTrigger value="mappings">Field Mappings</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 p-1">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Data Feed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this feed does..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Form *</Label>
                  <Select
                    value={formData.source_form_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, source_form_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source form" />
                    </SelectTrigger>
                    <SelectContent>
                      {forms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Form *</Label>
                  <Select
                    value={formData.target_form_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, target_form_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target form" />
                    </SelectTrigger>
                    <SelectContent>
                      {forms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select
                  value={formData.schedule || '__none__'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, schedule: value === '__none__' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No schedule (manual only)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No schedule (manual only)</SelectItem>
                    {SCHEDULE_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </TabsContent>

            <TabsContent value="matching" className="space-y-4 p-1">
              <div className="space-y-3">
                <Label>Matching Type</Label>
                <RadioGroup
                  value={formData.matching_type}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    matching_type: value as 'cross_reference' | 'field_matching' 
                  }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="field_matching" id="field_matching" />
                    <Label htmlFor="field_matching" className="font-normal">
                      Field Value Matching
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cross_reference" id="cross_reference" />
                    <Label htmlFor="cross_reference" className="font-normal">
                      Cross-Reference Field
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.matching_type === 'cross_reference' && (
                <div className="space-y-2">
                  <Label>Cross-Reference Field</Label>
                  <Select
                    value={formData.cross_reference_field_id || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, cross_reference_field_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cross-reference field" />
                    </SelectTrigger>
                    <SelectContent>
                      {crossRefFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {crossRefFields.length === 0 && formData.source_form_id && (
                    <p className="text-sm text-muted-foreground">
                      No cross-reference fields found in the source form.
                    </p>
                  )}
                </div>
              )}

              {formData.matching_type === 'field_matching' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Matching Rules</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMatchingRule}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Rule
                    </Button>
                  </div>

                  {formData.matching_rules.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Add rules to define how source and target records are matched.
                    </p>
                  )}

                  {formData.matching_rules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={rule.sourceFieldId}
                        onValueChange={(value) => updateMatchingRule(index, 'sourceFieldId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Source field" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                      <Select
                        value={rule.targetFieldId}
                        onValueChange={(value) => updateMatchingRule(index, 'targetFieldId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Target field" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMatchingRule(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <Label>When No Match Found</Label>
                <RadioGroup
                  value={formData.no_match_behavior}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    no_match_behavior: value as 'skip' | 'create' 
                  }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="skip" id="skip" />
                    <Label htmlFor="skip" className="font-normal">
                      Skip (update existing only)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="create" id="create" />
                    <Label htmlFor="create" className="font-normal">
                      Create new record in target form
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </TabsContent>

            <TabsContent value="mappings" className="space-y-4 p-1">
              <div className="flex items-center justify-between">
                <Label>Field Mappings</Label>
                <Button type="button" variant="outline" size="sm" onClick={addFieldMapping}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Mapping
                </Button>
              </div>

              {formData.field_mappings.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add mappings to define which source fields update which target fields.
                </p>
              )}

              {formData.field_mappings.map((mapping, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={mapping.sourceFieldId}
                    onValueChange={(value) => updateFieldMapping(index, 'sourceFieldId', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Source field" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                  <Select
                    value={mapping.targetFieldId}
                    onValueChange={(value) => updateFieldMapping(index, 'targetFieldId', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Target field" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFieldMapping(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.name || !formData.source_form_id || !formData.target_form_id}>
            {saving ? 'Saving...' : (feed ? 'Update' : 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
