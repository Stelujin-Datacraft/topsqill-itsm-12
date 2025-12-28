
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnhancedOptionConfig } from './EnhancedOptionConfig';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, X, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SelectFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
  fieldType: 'select' | 'multi-select' | 'radio' | 'checkbox';
}

export function SelectFieldConfig({ config, onUpdate, errors, fieldType }: SelectFieldConfigProps) {
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
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

  // Only show lifecycle option for select/dropdown fields
  const showLifecycleOption = fieldType === 'select';

  return (
    <div className="space-y-4">
      <EnhancedOptionConfig
        options={options}
        onChange={handleOptionsChange}
        fieldType={fieldType}
      />

      <div className="space-y-3">
        {showLifecycleOption && (
          <>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="displayAsLifecycle"
                checked={displayAsLifecycle}
                onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, displayAsLifecycle: checked } })}
              />
              <Label htmlFor="displayAsLifecycle" className="flex flex-col">
                <span>Display as Lifecycle</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Shows options as a status bar at the top of the record
                </span>
              </Label>
            </div>

            {/* Advanced Lifecycle Settings */}
            {displayAsLifecycle && (
              <Collapsible open={lifecycleOpen} onOpenChange={setLifecycleOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Advanced Lifecycle Settings
                    </span>
                    {lifecycleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  {/* Require Comment */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requireCommentOnChange"
                      checked={customConfig.requireCommentOnChange || false}
                      onCheckedChange={(checked) => onUpdate({ customConfig: { ...customConfig, requireCommentOnChange: checked } })}
                    />
                    <Label htmlFor="requireCommentOnChange" className="flex flex-col">
                      <span>Require Comment on Stage Change</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        Users must add a note when changing the stage
                      </span>
                    </Label>
                  </div>

                  {/* SLA Warning */}
                  <div className="space-y-2">
                    <Label>SLA Warning (hours)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 24"
                      value={customConfig.slaWarningHours || ''}
                      onChange={(e) => onUpdate({ customConfig: { ...customConfig, slaWarningHours: e.target.value ? parseInt(e.target.value) : null } })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Show warning if record stays in a stage longer than this
                    </p>
                  </div>

                  {/* Transition Rules */}
                  <div className="space-y-2">
                    <Label>Stage Transition Rules</Label>
                    <p className="text-xs text-muted-foreground">
                      Define which stages can transition to which. Leave empty to allow all.
                    </p>
                    
                    {/* Existing rules */}
                    {Object.entries(transitionRules).map(([from, toList]: [string, any]) => (
                      <div key={from} className="space-y-1">
                        {toList.map((to: string) => (
                          <div key={`${from}-${to}`} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">{from}</Badge>
                            <span>→</span>
                            <Badge variant="outline">{to}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => removeTransitionRule(from, to)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Add new rule */}
                    <div className="flex items-center gap-2">
                      <Select value={transitionFrom} onValueChange={setTransitionFrom}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="From" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt: any) => (
                            <SelectItem key={getOptionValue(opt)} value={getOptionValue(opt)}>
                              {getOptionLabel(opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span>→</span>
                      <Select value={transitionTo} onValueChange={setTransitionTo}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="To" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt: any) => (
                            <SelectItem key={getOptionValue(opt)} value={getOptionValue(opt)}>
                              {getOptionLabel(opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addTransitionRule}
                        disabled={!transitionFrom || !transitionTo || transitionFrom === transitionTo}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
        
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
  );
}
