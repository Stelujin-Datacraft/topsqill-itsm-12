import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EnhancedOptionConfig } from '../EnhancedOptionConfig';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, GitBranch, MessageSquare, Trash2, Plus, AlertTriangle, Settings2, Activity, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SelectFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function SelectFieldConfig({ field, onConfigChange }: SelectFieldConfigProps) {
  const config = (field.customConfig || {}) as Record<string, any>;
  const [lifecycleOpen, setLifecycleOpen] = useState(config.displayAsLifecycle || false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [slaOpen, setSlaOpen] = useState(false);
  const [newRuleFrom, setNewRuleFrom] = useState('');
  const [newRuleTo, setNewRuleTo] = useState('');
  const [slaTemplates, setSlaTemplates] = useState<any[]>([]);
  const [escalationChains, setEscalationChains] = useState<any[]>([]);
  const { userProfile } = useAuth();
  
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

  // Fetch SLA templates and escalation chains
  useEffect(() => {
    const fetchSlaData = async () => {
      if (!userProfile?.organization_id) return;
      
      const [templatesRes, chainsRes] = await Promise.all([
        supabase
          .from('sla_templates')
          .select('id, name, warning_hours, breach_hours')
          .eq('organization_id', userProfile.organization_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('escalation_chains')
          .select('id, name')
          .eq('organization_id', userProfile.organization_id)
          .eq('is_active', true)
          .order('name')
      ]);
      
      setSlaTemplates(templatesRes.data || []);
      setEscalationChains(chainsRes.data || []);
    };
    
    fetchSlaData();
  }, [userProfile?.organization_id]);

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
          
        </div>
      </div>

      {/* Lifecycle Status Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Activity className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Lifecycle Status</h4>
          {config.displayAsLifecycle && (
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
              checked={config.displayAsLifecycle || false}
              onCheckedChange={(checked) => {
                onConfigChange({ displayAsLifecycle: checked });
                setLifecycleOpen(!!checked);
              }}
            />
            <Label htmlFor="displayAsLifecycle" className="cursor-pointer">
              Display as Lifecycle Status Bar
            </Label>
          </div>

          {/* Advanced Lifecycle Settings */}
          {config.displayAsLifecycle && (
            <div className="space-y-3 mt-3 pl-4 border-l-2 border-primary/30">
              {/* Require Comment on Stage Change */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireCommentOnChange"
                  checked={config.requireCommentOnChange || false}
                  onCheckedChange={(checked) => onConfigChange({ requireCommentOnChange: checked })}
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
                    value={config.slaWarningHours || ''}
                    onChange={(e) => onConfigChange({ slaWarningHours: e.target.value ? parseInt(e.target.value) : null })}
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
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs">Add Transition Rule</Label>
                      <div className="flex items-center gap-2">
                        <Select value={newRuleFrom} onValueChange={setNewRuleFrom}>
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
                        <Select value={newRuleTo} onValueChange={setNewRuleTo}>
                          <SelectTrigger className="w-28 h-7 text-xs">
                            <SelectValue placeholder="To" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.filter((opt) => getOptionValue(opt) !== newRuleFrom).map((opt) => (
                              <SelectItem key={getOptionValue(opt)} value={getOptionValue(opt)}>
                                {getOptionLabel(opt)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!newRuleFrom || !newRuleTo}
                          onClick={() => {
                            if (newRuleFrom && newRuleTo) {
                              handleAddTransitionRule(newRuleFrom, newRuleTo);
                              setNewRuleFrom('');
                              setNewRuleTo('');
                            }
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Quick Add Sequential */}
                  {options.length >= 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7"
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
                      Set Sequential Flow
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* SLA Configuration */}
              <Collapsible open={slaOpen} onOpenChange={setSlaOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm hover:text-foreground w-full py-1">
                  {slaOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>SLA & Escalation</span>
                  {config.slaTemplateId && (
                    <Badge variant="default" className="ml-auto text-xs">Configured</Badge>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3 pl-2">
                  <p className="text-xs text-muted-foreground">
                    Configure automated SLA tracking and escalations for this lifecycle field.
                  </p>
                  
                  {/* Enable SLA Tracking */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enableSlaTracking"
                      checked={config.enableSlaTracking || false}
                      onCheckedChange={(checked) => {
                        onConfigChange({ enableSlaTracking: checked });
                        if (!checked) {
                          onConfigChange({ slaTemplateId: null, escalationChainId: null });
                        }
                      }}
                    />
                    <Label htmlFor="enableSlaTracking" className="cursor-pointer flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Enable SLA Tracking
                    </Label>
                  </div>

                  {config.enableSlaTracking && (
                    <div className="space-y-3 mt-2">
                      {/* SLA Template Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs">SLA Template</Label>
                        {slaTemplates.length > 0 ? (
                          <Select 
                            value={config.slaTemplateId || ''} 
                            onValueChange={(value) => onConfigChange({ slaTemplateId: value || null })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select SLA template" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {slaTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name} ({template.warning_hours}h warn / {template.breach_hours}h breach)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No SLA templates found. Create one in SLA Management.
                          </p>
                        )}
                      </div>

                      {/* Escalation Chain Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs">Escalation Chain</Label>
                        {escalationChains.length > 0 ? (
                          <Select 
                            value={config.escalationChainId || ''} 
                            onValueChange={(value) => onConfigChange({ escalationChainId: value || null })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select escalation chain" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {escalationChains.map((chain) => (
                                <SelectItem key={chain.id} value={chain.id}>
                                  {chain.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No escalation chains found. Create one in SLA Management.
                          </p>
                        )}
                      </div>

                      {/* Stage-specific SLA overrides */}
                      <div className="space-y-2">
                        <Label className="text-xs">Track SLA for stages:</Label>
                        <div className="flex flex-wrap gap-2">
                          {options.map((opt) => {
                            const optValue = getOptionValue(opt);
                            const trackedStages = config.slaTrackedStages || [];
                            const isTracked = trackedStages.includes(optValue);
                            return (
                              <Badge
                                key={optValue}
                                variant={isTracked ? "default" : "outline"}
                                className="cursor-pointer text-xs"
                                onClick={() => {
                                  const newTracked = isTracked
                                    ? trackedStages.filter((s: string) => s !== optValue)
                                    : [...trackedStages, optValue];
                                  onConfigChange({ slaTrackedStages: newTracked });
                                }}
                              >
                                {getOptionLabel(opt)}
                              </Badge>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Click stages to toggle SLA tracking. Empty = all stages tracked.
                        </p>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
