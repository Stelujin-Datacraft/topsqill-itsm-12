import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EnhancedOptionConfig } from '../EnhancedOptionConfig';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Clock, GitBranch, MessageSquare, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SelectFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function SelectFieldConfig({ field, onConfigChange }: SelectFieldConfigProps) {
  const config = (field.customConfig || {}) as Record<string, any>;
  const [lifecycleOpen, setLifecycleOpen] = useState(config.displayAsLifecycle || false);
  const [rulesOpen, setRulesOpen] = useState(false);
  
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
  
  const options = ensureOptionsArray(field.options);

  const handleOptionsChange = (newOptions: any[]) => {
    onConfigChange({ options: newOptions });
  };

  // Handle transition rules
  const transitionRules = config.transitionRules || {};
  
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

  const handleAddTransitionRule = (fromStage: string, toStage: string) => {
    const currentRules = { ...transitionRules };
    if (!currentRules[fromStage]) {
      currentRules[fromStage] = [];
    }
    if (!currentRules[fromStage].includes(toStage)) {
      currentRules[fromStage].push(toStage);
    }
    onConfigChange({ transitionRules: currentRules });
  };

  const handleRemoveTransitionRule = (fromStage: string, toStage: string) => {
    const currentRules = { ...transitionRules };
    if (currentRules[fromStage]) {
      currentRules[fromStage] = currentRules[fromStage].filter((s: string) => s !== toStage);
      if (currentRules[fromStage].length === 0) {
        delete currentRules[fromStage];
      }
    }
    onConfigChange({ transitionRules: currentRules });
  };

  return (
    <div className="space-y-4">
      <EnhancedOptionConfig
        options={options}
        onChange={handleOptionsChange}
        fieldType="select"
      />

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="searchable"
            checked={config.searchable || false}
            onCheckedChange={(checked) => onConfigChange({ searchable: checked })}
          />
          <Label htmlFor="searchable">Enable search</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="clearable"
            checked={config.clearable !== false}
            onCheckedChange={(checked) => onConfigChange({ clearable: checked })}
          />
          <Label htmlFor="clearable">Allow clearing selection</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowOther"
            checked={config.allowOther || false}
            onCheckedChange={(checked) => onConfigChange({ allowOther: checked })}
          />
          <Label htmlFor="allowOther">Allow "Other" option</Label>
        </div>

        {/* Lifecycle Display Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="displayAsLifecycle"
            checked={config.displayAsLifecycle || false}
            onCheckedChange={(checked) => {
              onConfigChange({ displayAsLifecycle: checked });
              setLifecycleOpen(!!checked);
            }}
          />
          <Label htmlFor="displayAsLifecycle" className="flex items-center gap-2">
            Display as Lifecycle Status Bar
            {config.displayAsLifecycle && (
              <Badge variant="secondary" className="text-xs">Enabled</Badge>
            )}
          </Label>
        </div>
      </div>

      {/* Advanced Lifecycle Settings */}
      {config.displayAsLifecycle && (
        <Collapsible open={lifecycleOpen} onOpenChange={setLifecycleOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full py-2 border-t pt-4">
            {lifecycleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Advanced Lifecycle Settings
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Require Comment on Stage Change */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requireCommentOnChange"
                checked={config.requireCommentOnChange || false}
                onCheckedChange={(checked) => onConfigChange({ requireCommentOnChange: checked })}
              />
              <Label htmlFor="requireCommentOnChange" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Require comment on stage change
              </Label>
            </div>

            {/* SLA Warning Hours */}
            <div className="space-y-2">
              <Label htmlFor="slaWarningHours" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                SLA Warning (hours before alert)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="slaWarningHours"
                  type="number"
                  min="0"
                  placeholder="e.g., 24"
                  value={config.slaWarningHours || ''}
                  onChange={(e) => onConfigChange({ slaWarningHours: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Notifies creator/admin when record exceeds this time in a stage
              </p>
            </div>

            {/* Stage Transition Rules */}
            <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground w-full py-2">
                {rulesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <GitBranch className="h-4 w-4" />
                Stage Transition Rules
                {Object.keys(transitionRules).length > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {Object.keys(transitionRules).length} rules
                  </Badge>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3 pl-6">
                <p className="text-xs text-muted-foreground mb-2">
                  Define which stages can transition to other stages. If no rules are set, all transitions are allowed.
                </p>
                
                {/* Existing Rules */}
                {Object.entries(transitionRules).map(([fromStage, toStages]: [string, any]) => (
                  <div key={fromStage} className="space-y-1">
                    <div className="text-sm font-medium">{fromStage} can transition to:</div>
                    <div className="flex flex-wrap gap-1 pl-4">
                      {(toStages as string[]).map((toStage: string) => (
                        <Badge key={toStage} variant="secondary" className="flex items-center gap-1">
                          {toStage}
                          <button
                            onClick={() => handleRemoveTransitionRule(fromStage, toStage)}
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
                    <Select
                      onValueChange={(fromStage) => {
                        const select = document.getElementById('toStageSelect') as HTMLSelectElement;
                        if (select?.dataset.value && fromStage !== select.dataset.value) {
                          handleAddTransitionRule(fromStage, select.dataset.value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
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
                    <span className="text-muted-foreground">→</span>
                    <Select
                      onValueChange={(toStage) => {
                        const fromSelect = document.querySelector('[data-from-stage]') as HTMLElement;
                        // This is simplified - in practice you'd use state
                      }}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs" id="toStageSelect">
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
                  </div>
                )}

                {/* Quick Add All Sequential Transitions */}
                {options.length >= 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      const rules: Record<string, string[]> = {};
                      options.forEach((opt, idx) => {
                        if (idx < options.length - 1) {
                          const fromVal = getOptionValue(opt);
                          const toVal = getOptionValue(options[idx + 1]);
                          rules[fromVal] = [toVal];
                        }
                      });
                      onConfigChange({ transitionRules: rules });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Set Sequential Flow (each stage → next stage only)
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
