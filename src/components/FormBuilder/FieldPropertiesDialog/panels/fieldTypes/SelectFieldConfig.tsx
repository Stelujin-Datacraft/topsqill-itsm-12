import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnhancedOptionConfig } from './EnhancedOptionConfig';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, X, Settings2, Activity, MessageSquare, AlertTriangle, GitBranch, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SelectFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
  fieldType: 'select' | 'multi-select' | 'radio' | 'checkbox';
}

export function SelectFieldConfig({ config, onUpdate, errors, fieldType }: SelectFieldConfigProps) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [transitionFrom, setTransitionFrom] = useState('');
  const [transitionTo, setTransitionTo] = useState('');

  // Ensure options is always an array
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

  const handleOptionsChange = (newOptions: any[]) => {
    console.log('SelectFieldConfig: Options changed:', newOptions);
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

  // Only show lifecycle option for select/dropdown fields
  const showLifecycleOption = fieldType === 'select';

  return (
    <div className="space-y-6">
      <EnhancedOptionConfig
        options={options}
        onChange={handleOptionsChange}
        fieldType={fieldType}
      />

      {/* General Options Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">General Options</h4>
        </div>
        
        <div className="space-y-3 pl-1">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="searchable"
              checked={customConfig.searchable || false}
              onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, searchable: checked } })}
            />
            <Label htmlFor="searchable">Enable search</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="clearable"
              checked={customConfig.clearable !== false}
              onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, clearable: checked } })}
            />
            <Label htmlFor="clearable">Allow clearing selection</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="allowOther"
              checked={customConfig.allowOther || false}
              onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, allowOther: checked } })}
            />
            <Label htmlFor="allowOther">Allow "Other" option</Label>
          </div>
        </div>
      </div>

      {/* Lifecycle Status Section */}
      {showLifecycleOption && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Activity className="h-4 w-4 text-primary" />
            <h4 className="font-medium text-sm">Lifecycle Status</h4>
            {displayAsLifecycle && (
              <Badge variant="default" className="text-xs ml-auto">Enabled</Badge>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground pl-1">
            Track record progress through stages with visual indicators, comments, and SLA monitoring.
          </p>

          <div className="space-y-3 pl-1">
            {/* Lifecycle Display Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="displayAsLifecycle"
                checked={displayAsLifecycle}
                onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, displayAsLifecycle: checked } })}
              />
              <Label htmlFor="displayAsLifecycle" className="cursor-pointer">
                Display as Lifecycle Status Bar
              </Label>
            </div>

            {/* Advanced Lifecycle Settings */}
            {displayAsLifecycle && (
              <div className="space-y-4 mt-3 pl-4 border-l-2 border-primary/30">
                {/* Require Comment on Stage Change */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requireCommentOnChange"
                    checked={customConfig.requireCommentOnChange || false}
                    onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, requireCommentOnChange: checked } })}
                  />
                  <Label htmlFor="requireCommentOnChange" className="flex items-center gap-2 cursor-pointer">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    Require comment on stage change
                  </Label>
                </div>

                {/* SLA Warning Hours */}
                <div className="space-y-2">
                  <Label htmlFor="slaWarningHours" className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    SLA Warning (hours)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="slaWarningHours"
                      type="number"
                      min="0"
                      placeholder="e.g., 24"
                      value={customConfig.slaWarningHours || ''}
                      onChange={(e) => onUpdate({ customConfig: { ...customConfig, slaWarningHours: e.target.value ? parseInt(e.target.value) : null } })}
                      className="w-24 h-8"
                    />
                    <span className="text-xs text-muted-foreground">hours before alert</span>
                  </div>
                </div>

                {/* Stage Transition Rules */}
                <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm hover:text-foreground w-full py-1">
                    {rulesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <GitBranch className="h-4 w-4 text-purple-500" />
                    <span>Stage Transition Rules</span>
                    {Object.keys(transitionRules).length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {Object.keys(transitionRules).length} rules
                      </Badge>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3 pl-2">
                    <p className="text-xs text-muted-foreground">
                      Define allowed stage transitions. If empty, all transitions are allowed.
                    </p>
                    
                    {/* Existing Rules */}
                    {Object.entries(transitionRules).map(([fromStage, toStages]: [string, any]) => (
                      <div key={fromStage} className="space-y-1 bg-muted/50 p-2 rounded border">
                        <div className="text-xs font-medium">{fromStage} →</div>
                        <div className="flex flex-wrap gap-1">
                          {(toStages as string[]).map((toStage: string) => (
                            <Badge key={toStage} variant="secondary" className="flex items-center gap-1 text-xs">
                              {toStage}
                              <button
                                onClick={() => removeTransitionRule(fromStage, toStage)}
                                className="ml-1 hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Add New Rule */}
                    {options.length >= 2 && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Select value={transitionFrom} onValueChange={setTransitionFrom}>
                          <SelectTrigger className="w-28 h-7 text-xs">
                            <SelectValue placeholder="From" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={getOptionValue(opt)} value={getOptionValue(opt)}>
                                {getOptionLabel(opt)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground text-xs">→</span>
                        <Select value={transitionTo} onValueChange={setTransitionTo}>
                          <SelectTrigger className="w-28 h-7 text-xs">
                            <SelectValue placeholder="To" />
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
                          size="sm"
                          className="h-7 px-2"
                          onClick={addTransitionRule}
                          disabled={!transitionFrom || !transitionTo || transitionFrom === transitionTo}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Quick Add Sequential */}
                    {options.length >= 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-7"
                        onClick={setSequentialFlow}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Set Sequential Flow
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
