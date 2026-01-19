import { useState, useEffect } from 'react';
import { DataFeed, DataFeedFormData, FieldMapping, MatchingRule, SCHEDULE_PRESETS, ScheduleConfig, buildCronFromConfig, parseCronToReadable } from '@/types/dataFeed';
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
import { Plus, Trash2, ArrowRight, Clock, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ExpressionEvaluator } from '@/utils/expressionEvaluator';

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
  const [scheduleType, setScheduleType] = useState<'none' | 'preset' | 'interval' | 'custom'>('none');
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    type: 'preset',
    intervalValue: 1,
    intervalUnit: 'hours',
    atTime: '09:00',
    onDays: [1, 2, 3, 4, 5], // Mon-Fri by default
  });

  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  const [formData, setFormData] = useState<DataFeedFormData>({
    name: '',
    description: '',
    source_form_id: '',
    target_form_id: '',
    matching_type: 'field_matching',
    matching_rules: [],
    matching_logic: '',
    field_mappings: [],
    no_match_behavior: 'skip',
    schedule: '',
    is_active: true,
  });

  const [logicError, setLogicError] = useState<string | null>(null);

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
      // Ensure matching rules have IDs
      const rulesWithIds = (feed.matching_rules || []).map((rule, idx) => ({
        ...rule,
        id: rule.id || String(idx + 1)
      }));
      
      setFormData({
        name: feed.name,
        description: feed.description || '',
        source_form_id: feed.source_form_id,
        target_form_id: feed.target_form_id,
        matching_type: feed.matching_type,
        cross_reference_field_id: feed.cross_reference_field_id,
        matching_rules: rulesWithIds,
        matching_logic: feed.matching_logic || '',
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
        matching_logic: '',
        field_mappings: [],
        no_match_behavior: 'skip',
        schedule: '',
        is_active: true,
      });
    }
    setLogicError(null);
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
    const newId = String(formData.matching_rules.length + 1);
    setFormData(prev => {
      const newRules = [...prev.matching_rules, { id: newId, sourceFieldId: '', targetFieldId: '' }];
      // Auto-generate default logic if we have 2+ rules and no custom logic yet
      const autoLogic = newRules.length >= 2 && !prev.matching_logic
        ? newRules.map(r => r.id).join(' AND ')
        : prev.matching_logic;
      return {
        ...prev,
        matching_rules: newRules,
        matching_logic: autoLogic,
      };
    });
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
    setFormData(prev => {
      const removedId = prev.matching_rules[index]?.id;
      const newRules = prev.matching_rules.filter((_, i) => i !== index);
      
      // Update logic expression to remove references to deleted rule
      let newLogic = prev.matching_logic || '';
      if (removedId && newLogic) {
        // Remove the deleted ID and clean up logic
        newLogic = newLogic
          .replace(new RegExp(`\\b${removedId}\\b\\s*(AND|OR)\\s*`, 'gi'), '')
          .replace(new RegExp(`\\s*(AND|OR)\\s*\\b${removedId}\\b`, 'gi'), '')
          .replace(new RegExp(`\\b${removedId}\\b`, 'g'), '')
          .replace(/\(\s*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      return {
        ...prev,
        matching_rules: newRules,
        matching_logic: newRules.length < 2 ? '' : newLogic,
      };
    });
  };

  const validateLogicExpression = (expression: string): boolean => {
    if (!expression || formData.matching_rules.length < 2) {
      setLogicError(null);
      return true;
    }
    
    const validation = ExpressionEvaluator.validate(expression);
    if (!validation.valid) {
      setLogicError(validation.error || 'Invalid expression');
      return false;
    }
    
    // Check that all referenced IDs exist
    const referencedIds = ExpressionEvaluator.extractConditionIds(expression);
    const existingIds = formData.matching_rules.map(r => r.id);
    const invalidIds = referencedIds.filter(id => !existingIds.includes(id));
    
    if (invalidIds.length > 0) {
      setLogicError(`Unknown rule ID(s): ${invalidIds.join(', ')}`);
      return false;
    }
    
    setLogicError(null);
    return true;
  };

  const handleLogicChange = (value: string) => {
    setFormData(prev => ({ ...prev, matching_logic: value }));
    validateLogicExpression(value);
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

              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule
                </Label>
                
                <RadioGroup
                  value={scheduleType}
                  onValueChange={(value) => {
                    const newType = value as 'none' | 'preset' | 'interval' | 'custom';
                    setScheduleType(newType);
                    if (newType === 'none') {
                      setFormData(prev => ({ ...prev, schedule: '' }));
                    }
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                    <RadioGroupItem value="none" id="schedule_none" />
                    <Label htmlFor="schedule_none" className="font-normal cursor-pointer flex-1">Manual only</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                    <RadioGroupItem value="preset" id="schedule_preset" />
                    <Label htmlFor="schedule_preset" className="font-normal cursor-pointer flex-1">Preset</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                    <RadioGroupItem value="interval" id="schedule_interval" />
                    <Label htmlFor="schedule_interval" className="font-normal cursor-pointer flex-1">Custom interval</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                    <RadioGroupItem value="custom" id="schedule_custom" />
                    <Label htmlFor="schedule_custom" className="font-normal cursor-pointer flex-1">Cron expression</Label>
                  </div>
                </RadioGroup>

                {scheduleType === 'preset' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Select a preset schedule</Label>
                    <Select
                      value={formData.schedule || ''}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, schedule: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose schedule..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Frequent</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'frequent').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Hourly</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'hourly').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Daily</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'daily').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Weekly</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'weekly').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Monthly</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'monthly').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {scheduleType === 'interval' && (
                  <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label className="whitespace-nowrap">Run every</Label>
                      <Input
                        type="number"
                        min="1"
                        max="60"
                        className="w-20"
                        value={scheduleConfig.intervalValue || 1}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          const newConfig = { ...scheduleConfig, intervalValue: value, type: 'interval' as const };
                          setScheduleConfig(newConfig);
                          setFormData(prev => ({ ...prev, schedule: buildCronFromConfig(newConfig) }));
                        }}
                      />
                      <Select
                        value={scheduleConfig.intervalUnit || 'hours'}
                        onValueChange={(value) => {
                          const newConfig = { ...scheduleConfig, intervalUnit: value as 'minutes' | 'hours' | 'days', type: 'interval' as const };
                          setScheduleConfig(newConfig);
                          setFormData(prev => ({ ...prev, schedule: buildCronFromConfig(newConfig) }));
                        }}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {scheduleConfig.intervalUnit === 'days' && (
                      <>
                        <div className="flex items-center gap-2">
                          <Label className="whitespace-nowrap">At time</Label>
                          <Input
                            type="time"
                            className="w-32"
                            value={scheduleConfig.atTime || '09:00'}
                            onChange={(e) => {
                              const newConfig = { ...scheduleConfig, atTime: e.target.value, type: 'interval' as const };
                              setScheduleConfig(newConfig);
                              setFormData(prev => ({ ...prev, schedule: buildCronFromConfig(newConfig) }));
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Run on days</Label>
                          <div className="flex flex-wrap gap-1">
                            {DAYS_OF_WEEK.map((day) => (
                              <label
                                key={day.value}
                                className={`flex items-center justify-center w-10 h-8 rounded border cursor-pointer text-xs font-medium transition-colors ${
                                  scheduleConfig.onDays?.includes(day.value)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={scheduleConfig.onDays?.includes(day.value) || false}
                                  onChange={(e) => {
                                    const newDays = e.target.checked
                                      ? [...(scheduleConfig.onDays || []), day.value].sort()
                                      : (scheduleConfig.onDays || []).filter(d => d !== day.value);
                                    const newConfig = { ...scheduleConfig, onDays: newDays, type: 'interval' as const };
                                    setScheduleConfig(newConfig);
                                    setFormData(prev => ({ ...prev, schedule: buildCronFromConfig(newConfig) }));
                                  }}
                                />
                                {day.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {scheduleType === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Enter cron expression (minute hour day month weekday)</Label>
                    <Input
                      placeholder="0 9 * * 1-5"
                      value={formData.schedule || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: <code className="bg-muted px-1 rounded">0 9 * * 1-5</code> = Every weekday at 9 AM
                    </p>
                  </div>
                )}

                {formData.schedule && (
                  <div className="flex items-center gap-2 text-sm p-2 bg-primary/10 rounded-md">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Schedule:</span>
                    <span className="font-medium">{parseCronToReadable(formData.schedule)}</span>
                  </div>
                )}
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
                    <div key={rule.id || index} className="flex items-center gap-2">
                      <Badge variant="secondary" className="shrink-0 w-6 h-6 flex items-center justify-center p-0 text-xs font-bold">
                        {rule.id || index + 1}
                      </Badge>
                      
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

                  {/* Logic Expression UI - Show when 2+ rules */}
                  {formData.matching_rules.length >= 2 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Logic Expression</Label>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => handleLogicChange(formData.matching_rules.map(r => r.id).join(' AND '))}
                          >
                            All (AND)
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => handleLogicChange(formData.matching_rules.map(r => r.id).join(' OR '))}
                          >
                            Any (OR)
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={formData.matching_logic || ''}
                        onChange={(e) => handleLogicChange(e.target.value)}
                        placeholder={`e.g., 1 AND 2, (1 OR 2) AND 3`}
                        className={logicError ? 'border-destructive' : ''}
                      />
                      {logicError && (
                        <div className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          {logicError}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Use rule numbers with AND, OR, NOT and parentheses. Default: all rules must match (AND).
                      </p>
                    </div>
                  )}
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
