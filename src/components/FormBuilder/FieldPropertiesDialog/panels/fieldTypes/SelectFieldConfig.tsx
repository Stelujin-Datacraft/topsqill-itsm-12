import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedOptionConfig } from './EnhancedOptionConfig';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, Settings2, Activity, MessageSquare, AlertTriangle, GitBranch, Trash2, Workflow, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';

interface SelectFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
  fieldType: 'select' | 'multi-select' | 'radio' | 'checkbox';
  formId?: string;
}

export function SelectFieldConfig({ config, onUpdate, errors, fieldType, formId }: SelectFieldConfigProps) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [transitionFrom, setTransitionFrom] = useState('');
  const [transitionTo, setTransitionTo] = useState('');
  const [siblingFields, setSiblingFields] = useState<Array<{ id: string; label: string; type: string; options?: any[] }>>([]);

  const ensureOptionsArray = (opts: any): any[] => {
    if (Array.isArray(opts)) return opts;
    if (typeof opts === 'string') {
      try {
        const parsed = JSON.parse(opts);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  
  const options = ensureOptionsArray(config.options);
  const customConfig = config.customConfig || {};
  const transitionRules = customConfig.transitionRules || {};
  const displayAsLifecycle = customConfig.displayAsLifecycle || false;
  const visibilityCondition = customConfig.lifecycleVisibilityCondition || null;

  // Fetch sibling fields for visibility condition
  useEffect(() => {
    const fetchSiblingFields = async () => {
      if (!formId || !displayAsLifecycle) return;
      const { data } = await supabase
        .from('form_fields')
        .select('id, label, field_type, options')
        .eq('form_id', formId)
        .order('field_order');
      if (data) {
        setSiblingFields(data.map(f => ({ id: f.id, label: f.label, type: f.field_type, options: f.options as any[] })));
      }
    };
    fetchSiblingFields();
  }, [formId, displayAsLifecycle]);
  
  // Radio and dropdown don't need "Allow Other" option
  const showAllowOther = fieldType === 'checkbox' || fieldType === 'multi-select';

  const handleOptionsChange = (newOptions: any[]) => {
    onUpdate({ options: newOptions });
  };

  const getOptionLabel = (option: any): string => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') {
      return option.label || option.value || String(option);
    }
    return String(option);
  };

  const getOptionValue = (option: any): string => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') {
      return option.value || option.label || String(option);
    }
    return String(option);
  };

  const addTransitionRule = () => {
    if (!transitionFrom || !transitionTo || transitionFrom === transitionTo) return;
    
    const newRules = { ...transitionRules };
    if (!newRules[transitionFrom]) {
      newRules[transitionFrom] = [];
    }
    if (!newRules[transitionFrom].includes(transitionTo)) {
      newRules[transitionFrom].push(transitionTo);
    }
    
    onUpdate({ customConfig: { ...customConfig, transitionRules: newRules } });
    setTransitionFrom('');
    setTransitionTo('');
  };

  const removeTransitionRule = (from: string, to: string) => {
    const newRules = { ...transitionRules };
    if (newRules[from]) {
      newRules[from] = newRules[from].filter((t: string) => t !== to);
      if (newRules[from].length === 0) {
        delete newRules[from];
      }
    }
    onUpdate({ customConfig: { ...customConfig, transitionRules: newRules } });
  };

  const setSequentialFlow = () => {
    const rules: Record<string, string[]> = {};
    options.forEach((opt, idx) => {
      if (idx < options.length - 1) {
        const fromVal = getOptionValue(opt);
        const toVal = getOptionValue(options[idx + 1]);
        rules[fromVal] = [toVal];
      }
    });
    onUpdate({ customConfig: { ...customConfig, transitionRules: rules } });
  };

  const showLifecycleOption = fieldType === 'select';

  return (
    <div className="space-y-4">
      <EnhancedOptionConfig
        options={options}
        onChange={handleOptionsChange}
        fieldType={fieldType}
      />

      {/* General Options Card */}
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">General Options</CardTitle>
              <CardDescription className="text-xs">Configure dropdown behavior</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex items-center justify-between">
            <Label htmlFor="searchable" className="text-sm font-normal">Enable search</Label>
            <Switch
              id="searchable"
              checked={customConfig.searchable || false}
              onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, searchable: checked } })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="clearable" className="text-sm font-normal">Allow clearing selection</Label>
            <Switch
              id="clearable"
              checked={customConfig.clearable !== false}
              onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, clearable: checked } })}
            />
          </div>
          
          {showAllowOther && (
            <div className="flex items-center justify-between">
              <Label htmlFor="allowOther" className="text-sm font-normal">Allow "Other" option</Label>
              <Switch
                id="allowOther"
                checked={customConfig.allowOther || false}
                onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, allowOther: checked } })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lifecycle Status Card */}
      {showLifecycleOption && (
        <Card className={`border-muted transition-all ${displayAsLifecycle ? 'ring-2 ring-primary/20 border-primary/30' : ''}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${displayAsLifecycle ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Activity className={`h-4 w-4 ${displayAsLifecycle ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Lifecycle Status
                    {displayAsLifecycle && (
                      <Badge className="text-[10px] h-5">Active</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">Track progress through stages</CardDescription>
                </div>
              </div>
              <Switch
                checked={displayAsLifecycle}
                onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, displayAsLifecycle: checked } })}
              />
            </div>
          </CardHeader>

          {displayAsLifecycle && (
            <CardContent className="space-y-4 pt-0">
              {/* Comment Requirement */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <div>
                    <Label htmlFor="requireComment" className="text-sm font-normal">Require comment</Label>
                    <p className="text-xs text-muted-foreground">Users must add a note on stage change</p>
                  </div>
                </div>
                <Switch
                  id="requireComment"
                  checked={customConfig.requireCommentOnChange || false}
                  onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, requireCommentOnChange: checked } })}
                />
              </div>

              {/* SLA Warning */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div>
                    <Label className="text-sm font-normal">SLA Warning</Label>
                    <p className="text-xs text-muted-foreground">Alert when record stays too long in a stage</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <Input
                    type="number"
                    min="0"
                    placeholder="24"
                    value={customConfig.slaWarningHours || ''}
                    onChange={(e) => onUpdate({ customConfig: { ...customConfig, slaWarningHours: e.target.value ? parseInt(e.target.value) : null } })}
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">hours</span>
                </div>
              </div>

              {/* Transition Rules */}
              <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg bg-muted/50 p-3 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-4 w-4 text-purple-500" />
                    <div className="text-left">
                      <div className="text-sm font-normal">Transition Rules</div>
                      <p className="text-xs text-muted-foreground">Control allowed stage transitions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {Object.keys(transitionRules).length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {Object.keys(transitionRules).length}
                      </Badge>
                    )}
                    {rulesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {/* Existing Rules */}
                  {Object.keys(transitionRules).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(transitionRules).map(([fromStage, toStages]: [string, any]) => (
                        <div key={fromStage} className="rounded-md border bg-background p-2">
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="font-normal">{fromStage}</Badge>
                            <Workflow className="h-3 w-3 text-muted-foreground" />
                            <div className="flex flex-wrap gap-1">
                              {(toStages as string[]).map((toStage: string) => (
                                <Badge key={toStage} variant="secondary" className="font-normal flex items-center gap-1">
                                  {toStage}
                                  <button
                                    onClick={() => removeTransitionRule(fromStage, toStage)}
                                    className="hover:text-destructive ml-1"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No rules set. All transitions are allowed.
                    </p>
                  )}

                  {/* Add New Rule */}
                  {options.length >= 2 && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Select value={transitionFrom} onValueChange={setTransitionFrom}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="From stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={getOptionValue(opt)} value={getOptionValue(opt)}>
                              {getOptionLabel(opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Workflow className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select value={transitionTo} onValueChange={setTransitionTo}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="To stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={getOptionValue(opt)} value={getOptionValue(opt)}>
                              {getOptionLabel(opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={addTransitionRule}
                        disabled={!transitionFrom || !transitionTo || transitionFrom === transitionTo}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Quick Actions */}
                  {options.length >= 2 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs"
                      onClick={setSequentialFlow}
                    >
                      <Workflow className="h-3 w-3 mr-2" />
                      Set Sequential Flow
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Visibility Condition */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Eye className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Visibility Condition</div>
                    <p className="text-xs text-muted-foreground">Control when this lifecycle bar appears</p>
                  </div>
                </div>

                {/* Show without condition checkbox */}
                <div className="flex items-center space-x-2 bg-background rounded-md p-2 border">
                  <Checkbox
                    id="showWithoutCondition"
                    checked={customConfig.showWithoutCondition || false}
                    onCheckedChange={(checked) => {
                      onUpdate({ customConfig: { ...customConfig, showWithoutCondition: !!checked } });
                    }}
                  />
                  <Label htmlFor="showWithoutCondition" className="text-xs cursor-pointer">
                    Show without condition (always visible)
                  </Label>
                </div>

                {/* Condition fields - shown only when "show without condition" is unchecked */}
                {!customConfig.showWithoutCondition && (
                  <div className="space-y-3 pl-1">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      A visibility condition is required for this lifecycle bar.
                    </p>

                    {/* Condition Field */}
                    <div className="space-y-2">
                      <Label className="text-xs">When field <span className="text-destructive">*</span></Label>
                      <Select
                        value={visibilityCondition?.fieldId || ''}
                        onValueChange={(val) => {
                          const newCondition = { ...visibilityCondition, fieldId: val, operator: visibilityCondition?.operator || '==', value: '' };
                          onUpdate({ customConfig: { ...customConfig, lifecycleVisibilityCondition: newCondition } });
                        }}
                      >
                        <SelectTrigger className={`h-8 text-xs ${!visibilityCondition?.fieldId ? 'border-destructive' : ''}`}>
                          <SelectValue placeholder="Select a field" />
                        </SelectTrigger>
                        <SelectContent>
                          {siblingFields
                            .filter(f => !['header', 'description', 'section-break', 'horizontal-line'].includes(f.type))
                            .map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {!visibilityCondition?.fieldId && (
                        <p className="text-xs text-destructive">Please select a field</p>
                      )}
                    </div>

                    {/* Operator */}
                    <div className="space-y-2">
                      <Label className="text-xs">Operator <span className="text-destructive">*</span></Label>
                      <Select
                        value={visibilityCondition?.operator || '=='}
                        onValueChange={(val) => {
                          const newCondition = { ...visibilityCondition, operator: val };
                          onUpdate({ customConfig: { ...customConfig, lifecycleVisibilityCondition: newCondition } });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="==">Equals</SelectItem>
                          <SelectItem value="!=">Not Equals</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="not_empty">Is Not Empty</SelectItem>
                          <SelectItem value="empty">Is Empty</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Value */}
                    {visibilityCondition?.operator !== 'not_empty' && visibilityCondition?.operator !== 'empty' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Value <span className="text-destructive">*</span></Label>
                        {(() => {
                          const selectedField = siblingFields.find(f => f.id === visibilityCondition?.fieldId);
                          const fieldOptions = selectedField?.options ? ensureOptionsArray(selectedField.options) : [];
                          if (fieldOptions.length > 0) {
                            return (
                              <Select
                                value={visibilityCondition?.value || ''}
                                onValueChange={(val) => {
                                  const newCondition = { ...visibilityCondition, value: val };
                                  onUpdate({ customConfig: { ...customConfig, lifecycleVisibilityCondition: newCondition } });
                                }}
                              >
                                <SelectTrigger className={`h-8 text-xs ${!visibilityCondition?.value ? 'border-destructive' : ''}`}>
                                  <SelectValue placeholder="Select value" />
                                </SelectTrigger>
                                <SelectContent>
                                  {fieldOptions.map((opt: any) => {
                                    const val = typeof opt === 'string' ? opt : (opt.value || opt.label);
                                    const lbl = typeof opt === 'string' ? opt : (opt.label || opt.value);
                                    return <SelectItem key={val} value={val}>{lbl}</SelectItem>;
                                  })}
                                </SelectContent>
                              </Select>
                            );
                          }
                          return (
                            <Input
                              value={visibilityCondition?.value || ''}
                              onChange={(e) => {
                                const newCondition = { ...visibilityCondition, value: e.target.value };
                                onUpdate({ customConfig: { ...customConfig, lifecycleVisibilityCondition: newCondition } });
                              }}
                              placeholder="Enter value"
                              className={`h-8 text-xs ${!visibilityCondition?.value ? 'border-destructive' : ''}`}
                            />
                          );
                        })()}
                        {!visibilityCondition?.value && (
                          <p className="text-xs text-destructive">Please enter a value</p>
                        )}
                      </div>
                    )}

                    {/* Clear condition */}
                    {visibilityCondition && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => onUpdate({ customConfig: { ...customConfig, lifecycleVisibilityCondition: null } })}
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Reset Condition
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
