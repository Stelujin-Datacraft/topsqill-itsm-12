import React, { useState, useEffect, useMemo } from 'react';
import { FormField } from '@/types/form';
import { ChartConfig } from '@/types/reports';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Link2, Calculator, Hash, Info, ChevronDown, ChevronUp, BarChart3, ArrowRight, CheckCircle2, Tag, GitCompare, Layers, MousePointerClick } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFormsData } from '@/hooks/useFormsData';
import { METRIC_FIELD_TYPES, DIMENSION_FIELD_TYPES } from '@/utils/chartConfig';

interface CrossReferenceDataSectionProps {
  config: ChartConfig;
  formFields: FormField[];
  onConfigChange: (updates: Partial<ChartConfig>) => void;
}

// Helper to get field type
const getFieldType = (field: FormField): string => {
  return (field as any)?.field_type || field?.type || 'unknown';
};

export function CrossReferenceDataSection({ 
  config, 
  formFields, 
  onConfigChange 
}: CrossReferenceDataSectionProps) {
  const { forms } = useFormsData();
  const [isExpanded, setIsExpanded] = useState(config.crossRefConfig?.enabled || false);
  const [targetFormFields, setTargetFormFields] = useState<FormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Get cross-reference fields from the current form
  const crossRefFields = useMemo(() => {
    return formFields.filter(f => {
      const type = getFieldType(f);
      return type === 'cross-reference' || type === 'child-cross-reference';
    });
  }, [formFields]);

  const crossRefConfig = config.crossRefConfig;

  // Get current form name
  const currentFormName = useMemo(() => {
    if (!config.formId) return 'Current Form';
    return forms.find(f => f.id === config.formId)?.name || 'Current Form';
  }, [forms, config.formId]);

  // When a cross-reference field is selected, get its target form
  const selectedCrossRefField = useMemo(() => {
    if (!crossRefConfig?.crossRefFieldId) return null;
    return formFields.find(f => f.id === crossRefConfig.crossRefFieldId);
  }, [formFields, crossRefConfig?.crossRefFieldId]);

  // Extract target form ID from the cross-reference field's customConfig
  const targetFormIdFromField = useMemo(() => {
    if (!selectedCrossRefField) return null;
    const customConfig = (selectedCrossRefField as any).customConfig || (selectedCrossRefField as any).custom_config;
    if (!customConfig) return null;
    
    try {
      const parsed = typeof customConfig === 'string' ? JSON.parse(customConfig) : customConfig;
      return parsed?.targetFormId;
    } catch (e) {
      console.error('Error parsing customConfig:', e);
      return null;
    }
  }, [selectedCrossRefField]);

  // Fetch fields from the target form when it changes
  useEffect(() => {
    const fetchTargetFormFields = async () => {
      const targetId = crossRefConfig?.targetFormId || targetFormIdFromField;
      if (!targetId) {
        setTargetFormFields([]);
        return;
      }

      setLoadingFields(true);
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type, options, custom_config')
          .eq('form_id', targetId);

        if (error) throw error;
        
        const fields = (data || []).map(f => ({
          id: f.id,
          label: f.label,
          type: f.field_type,
          field_type: f.field_type,
        })) as unknown as FormField[];
        
        setTargetFormFields(fields);
      } catch (err) {
        console.error('Error fetching target form fields:', err);
        setTargetFormFields([]);
      } finally {
        setLoadingFields(false);
      }
    };

    fetchTargetFormFields();
  }, [crossRefConfig?.targetFormId, targetFormIdFromField]);

  // Get numeric fields from target form (for aggregation and compare)
  const numericTargetFields = useMemo(() => {
    const filtered = targetFormFields.filter(f => METRIC_FIELD_TYPES.includes(getFieldType(f)));
    console.log('📊 CrossRef: Target form fields:', targetFormFields.length, 'Numeric fields:', filtered.length, filtered.map(f => `${f.label}(${getFieldType(f)})`));
    return filtered;
  }, [targetFormFields]);

  // Get dimension fields from target form (for grouping)
  const dimensionTargetFields = useMemo(() => {
    return targetFormFields.filter(f => DIMENSION_FIELD_TYPES.includes(getFieldType(f)));
  }, [targetFormFields]);

  // Get target form name
  const targetFormName = useMemo(() => {
    const targetId = crossRefConfig?.targetFormId || targetFormIdFromField;
    if (!targetId) return null;
    return forms.find(f => f.id === targetId)?.name || 'Linked Form';
  }, [forms, crossRefConfig?.targetFormId, targetFormIdFromField]);

  // Handle enabling/disabling cross-reference mode
  const handleToggle = (enabled: boolean) => {
    setIsExpanded(enabled);
    if (enabled) {
      const firstField = crossRefFields[0];
      let targetFormId = '';
      
      if (firstField) {
        const customConfig = (firstField as any)?.customConfig || (firstField as any)?.custom_config;
        if (customConfig) {
          try {
            const parsed = typeof customConfig === 'string' ? JSON.parse(customConfig) : customConfig;
            targetFormId = parsed?.targetFormId || '';
          } catch (e) {
            console.error('Error parsing customConfig on toggle:', e);
          }
        }
      }
      
      onConfigChange({
        crossRefConfig: {
          enabled: true,
          crossRefFieldId: firstField?.id || '',
          targetFormId,
          mode: 'count',
        }
      });
    } else {
      onConfigChange({
        crossRefConfig: undefined
      });
    }
  };

  // Handle cross-reference field selection
  const handleCrossRefFieldChange = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    const customConfig = (field as any)?.customConfig || (field as any)?.custom_config;
    let targetFormId = '';
    
    if (customConfig) {
      try {
        const parsed = typeof customConfig === 'string' ? JSON.parse(customConfig) : customConfig;
        targetFormId = parsed?.targetFormId || '';
      } catch (e) {
        console.error('Error parsing customConfig:', e);
      }
    }

    onConfigChange({
      crossRefConfig: {
        ...crossRefConfig!,
        crossRefFieldId: fieldId,
        targetFormId,
        targetMetricFieldId: undefined,
        targetDimensionFieldId: undefined,
        sourceLabelFieldId: undefined,
      }
    });
  };

  // Get all fields from the source form for labeling (exclude cross-reference and file types)
  const sourceLabelFields = useMemo(() => {
    return formFields.filter(f => {
      const type = getFieldType(f);
      // Exclude only cross-reference and file upload types that don't make sense as labels
      const excludeTypes = ['cross-reference', 'child-cross-reference', 'file', 'image', 'signature'];
      return !excludeTypes.includes(type);
    });
  }, [formFields]);

  // Get selected label field name for summary
  const selectedSourceLabelField = useMemo(() => {
    if (!crossRefConfig?.sourceLabelFieldId) return null;
    return formFields.find(f => f.id === crossRefConfig.sourceLabelFieldId);
  }, [formFields, crossRefConfig?.sourceLabelFieldId]);

  // Handle mode change
  const handleModeChange = (mode: 'count' | 'aggregate' | 'compare') => {
    onConfigChange({
      crossRefConfig: {
        ...crossRefConfig!,
        mode,
        targetMetricFieldId: mode === 'aggregate' ? crossRefConfig?.targetMetricFieldId : undefined,
        targetAggregation: mode === 'aggregate' ? (crossRefConfig?.targetAggregation || 'sum') : undefined,
        compareXFieldId: mode === 'compare' ? crossRefConfig?.compareXFieldId : undefined,
        compareYFieldId: mode === 'compare' ? crossRefConfig?.compareYFieldId : undefined,
      }
    });
  };

  // Calculate step completion status
  const isStep1Complete = !!crossRefConfig?.crossRefFieldId && !!(crossRefConfig.targetFormId || targetFormIdFromField);
  const isStep2Complete = !!crossRefConfig?.mode;
  const isStep3Complete = crossRefConfig?.mode === 'count' || 
    (crossRefConfig?.mode === 'aggregate' && !!crossRefConfig?.targetMetricFieldId) ||
    (crossRefConfig?.mode === 'compare' && !!crossRefConfig?.compareXFieldId && !!crossRefConfig?.compareYFieldId);

  // Get selected metric field label
  const selectedMetricField = useMemo(() => {
    if (!crossRefConfig?.targetMetricFieldId) return null;
    return targetFormFields.find(f => f.id === crossRefConfig.targetMetricFieldId);
  }, [targetFormFields, crossRefConfig?.targetMetricFieldId]);

  // Get selected compare fields (X-axis and Y-axis)
  const selectedCompareXField = useMemo(() => {
    if (!crossRefConfig?.compareXFieldId) return null;
    return targetFormFields.find(f => f.id === crossRefConfig.compareXFieldId);
  }, [targetFormFields, crossRefConfig?.compareXFieldId]);

  const selectedCompareYField = useMemo(() => {
    if (!crossRefConfig?.compareYFieldId) return null;
    return targetFormFields.find(f => f.id === crossRefConfig.compareYFieldId);
  }, [targetFormFields, crossRefConfig?.compareYFieldId]);

  // Get source form dimension fields for grouping
  const sourceGroupByFields = useMemo(() => {
    return formFields.filter(f => {
      const type = getFieldType(f);
      return DIMENSION_FIELD_TYPES.includes(type) && type !== 'cross-reference' && type !== 'child-cross-reference';
    });
  }, [formFields]);

  // Get selected group by field
  const selectedSourceGroupByField = useMemo(() => {
    if (!crossRefConfig?.sourceGroupByFieldId) return null;
    return formFields.find(f => f.id === crossRefConfig.sourceGroupByFieldId);
  }, [formFields, crossRefConfig?.sourceGroupByFieldId]);

  // If no cross-reference fields exist, show info message
  if (crossRefFields.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Cross-Reference Chart
                <Badge variant="secondary" className="text-xs">Advanced</Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Analyze relationships between linked forms
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={isExpanded} 
              onCheckedChange={handleToggle}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && crossRefConfig?.enabled && (
        <CardContent className="space-y-5">
          {/* Visual explanation of what this does */}
          <div className="p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md text-sm font-medium text-blue-700 dark:text-blue-300">
                  {currentFormName}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-md text-sm font-medium text-green-700 dark:text-green-300">
                  {targetFormName || 'Linked Form'}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a chart that shows data about the relationship between these two forms. 
              Each bar/point represents a record from <span className="font-medium">{currentFormName}</span>, 
              and shows information from its linked records in <span className="font-medium">{targetFormName || 'the linked form'}</span>.
            </p>
          </div>

          {/* Step 1: Select Cross-Reference Field */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                isStep1Complete ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
              }`}>
                {isStep1Complete ? <CheckCircle2 className="h-4 w-4" /> : '1'}
              </div>
              <Label className="text-sm font-medium">Which link field connects the forms?</Label>
            </div>
            <Select
              value={crossRefConfig.crossRefFieldId || ''}
              onValueChange={handleCrossRefFieldChange}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select the cross-reference field..." />
              </SelectTrigger>
              <SelectContent>
                {crossRefFields.map((field) => {
                  const customCfg = (field as any).customConfig || (field as any).custom_config;
                  const hasTargetForm = customCfg && (typeof customCfg === 'object' ? customCfg.targetFormId : false);
                  
                  return (
                    <SelectItem key={field.id} value={field.id}>
                      <div className="flex items-center gap-2">
                        <Link2 className={`h-3 w-3 ${hasTargetForm ? 'text-green-600' : 'text-muted-foreground'}`} />
                        <span>{field.label}</span>
                        {!hasTargetForm && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Not linked</Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            
            {/* Warning if not configured */}
            {crossRefConfig.crossRefFieldId && !crossRefConfig.targetFormId && !targetFormIdFromField && (
              <Alert className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs">
                  This field doesn't have a linked form configured. Set up the link in Form Builder first.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Step 2: Choose what to measure */}
          {isStep1Complete && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  isStep2Complete ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
                }`}>
                  {isStep2Complete ? <CheckCircle2 className="h-4 w-4" /> : '2'}
                </div>
                <Label className="text-sm font-medium">What do you want to measure?</Label>
              </div>
              
              <div className="grid gap-3">
                {/* Count Mode Card */}
                <div 
                  onClick={() => handleModeChange('count')}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    crossRefConfig.mode === 'count' 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-border hover:border-primary/50 bg-background'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${crossRefConfig.mode === 'count' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <Hash className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">Count Linked Records</div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Count how many <span className="font-medium text-green-600 dark:text-green-400">{targetFormName}</span> records 
                        are linked to each <span className="font-medium text-blue-600 dark:text-blue-400">{currentFormName}</span> record.
                      </p>
                      <div className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded">
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Example:</span>
                        <span>"Customer A has 5 orders, Customer B has 3 orders"</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Aggregate Mode Card */}
                <div 
                  onClick={() => handleModeChange('aggregate')}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    crossRefConfig.mode === 'aggregate' 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-border hover:border-primary/50 bg-background'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${crossRefConfig.mode === 'aggregate' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <Calculator className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">Calculate Values</div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Sum, average, or calculate a numeric field from <span className="font-medium text-green-600 dark:text-green-400">{targetFormName}</span> records 
                        for each <span className="font-medium text-blue-600 dark:text-blue-400">{currentFormName}</span> record.
                      </p>
                      <div className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded">
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Example:</span>
                        <span>"Customer A total: $1,500, Customer B total: $800"</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compare Mode Card */}
                <div 
                  onClick={() => handleModeChange('compare')}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    crossRefConfig.mode === 'compare' 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-border hover:border-primary/50 bg-background'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${crossRefConfig.mode === 'compare' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <GitCompare className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">Compare Two Fields</div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Compare two numeric fields side-by-side from <span className="font-medium text-green-600 dark:text-green-400">{targetFormName}</span> records 
                        for each <span className="font-medium text-blue-600 dark:text-blue-400">{currentFormName}</span> record.
                      </p>
                      <div className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded">
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Example:</span>
                        <span>"Customer A: Revenue $1500 vs Cost $800"</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Configure aggregation (only for aggregate mode) */}
          {isStep1Complete && crossRefConfig.mode === 'aggregate' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  isStep3Complete ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
                }`}>
                  {isStep3Complete ? <CheckCircle2 className="h-4 w-4" /> : '3'}
                </div>
                <Label className="text-sm font-medium">Which value to calculate?</Label>
              </div>
              
              {loadingFields ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading fields...</div>
              ) : numericTargetFields.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <span className="font-medium">{targetFormName}</span> has no numeric fields. 
                    Use "Count Linked Records" instead, or add numeric fields to that form.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-3 p-4 bg-muted/30 rounded-lg border">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Calculation</Label>
                      <Select
                        value={crossRefConfig.targetAggregation || 'sum'}
                        onValueChange={(value) => onConfigChange({
                          crossRefConfig: {
                            ...crossRefConfig,
                            targetAggregation: value as any
                          }
                        })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum (Total)</SelectItem>
                          <SelectItem value="avg">Average</SelectItem>
                          <SelectItem value="min">Minimum</SelectItem>
                          <SelectItem value="max">Maximum</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">of Field</Label>
                      <Select
                        value={crossRefConfig.targetMetricFieldId || ''}
                        onValueChange={(value) => onConfigChange({
                          crossRefConfig: {
                            ...crossRefConfig,
                            targetMetricFieldId: value
                          }
                        })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {numericTargetFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {selectedMetricField && (
                    <p className="text-xs text-muted-foreground">
                      Will calculate the <span className="font-medium">{crossRefConfig.targetAggregation || 'sum'}</span> of "
                      <span className="font-medium">{selectedMetricField.label}</span>" from all linked {targetFormName} records.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Configure compare fields (only for compare mode) */}
          {isStep1Complete && crossRefConfig.mode === 'compare' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  isStep3Complete ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
                }`}>
                  {isStep3Complete ? <CheckCircle2 className="h-4 w-4" /> : '3'}
                </div>
                <Label className="text-sm font-medium">Select X-axis and Y-axis fields</Label>
              </div>
              
              {loadingFields ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading fields...</div>
              ) : targetFormFields.length < 2 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <span className="font-medium">{targetFormName}</span> needs at least 2 fields to compare. 
                    Add more fields to that form or use a different mode.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-3 p-4 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Select fields for X and Y axes. If Y-axis is a text field, a legend will be shown.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">X-Axis Field (horizontal)</Label>
                      <Select
                        value={crossRefConfig.compareXFieldId || ''}
                        onValueChange={(value) => onConfigChange({
                          crossRefConfig: {
                            ...crossRefConfig,
                            compareXFieldId: value
                          }
                        })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select X-axis field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {targetFormFields.map((field) => (
                            <SelectItem key={field.id} value={field.id} disabled={field.id === crossRefConfig.compareYFieldId}>
                              {field.label} ({getFieldType(field)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Y-Axis Field (vertical)</Label>
                      <Select
                        value={crossRefConfig.compareYFieldId || ''}
                        onValueChange={(value) => onConfigChange({
                          crossRefConfig: {
                            ...crossRefConfig,
                            compareYFieldId: value
                          }
                        })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select Y-axis field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {targetFormFields.map((field) => (
                            <SelectItem key={field.id} value={field.id} disabled={field.id === crossRefConfig.compareXFieldId}>
                              {field.label} ({getFieldType(field)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {selectedCompareXField && selectedCompareYField && (
                    <p className="text-xs text-muted-foreground">
                      X-Axis: "<span className="font-medium">{selectedCompareXField.label}</span>" | 
                      Y-Axis: "<span className="font-medium">{selectedCompareYField.label}</span>" 
                      {!METRIC_FIELD_TYPES.includes(getFieldType(selectedCompareYField)) && (
                        <span className="text-blue-600 dark:text-blue-400 ml-1">(with legend for text values)</span>
                      )}
                    </p>
                  )}
                  
                  {/* Toggle for showing records separately */}
                  <div className="flex items-center justify-between pt-3 border-t mt-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Show records separately</Label>
                      <p className="text-xs text-muted-foreground">
                        Group bars by parent record to show each parent's linked data distinctly
                      </p>
                    </div>
                    <Switch
                      checked={crossRefConfig.showRecordsSeparately || false}
                      onCheckedChange={(checked) => onConfigChange({
                        crossRefConfig: {
                          ...crossRefConfig,
                          showRecordsSeparately: checked
                        }
                      })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Customize labels (optional) - available once cross-ref field is selected */}
          {isStep1Complete && sourceLabelFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                  <Tag className="h-3 w-3" />
                </div>
                <Label className="text-sm font-medium">
                  Customize chart labels <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg border">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Show each bar labeled by</Label>
                  <Select
                    value={crossRefConfig.sourceLabelFieldId || '_ref_id'}
                    onValueChange={(value) => onConfigChange({
                      crossRefConfig: {
                        ...crossRefConfig,
                        sourceLabelFieldId: value === '_ref_id' ? undefined : value
                      }
                    })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_ref_id">Reference ID (C241228001)</SelectItem>
                      {sourceLabelFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose a field from <span className="font-medium">{currentFormName}</span> to label each bar in the chart.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Optional: Group By Source Field - available for all modes */}
          {isStep1Complete && sourceGroupByFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                  <Layers className="h-3 w-3" />
                </div>
                <Label className="text-sm font-medium">
                  Group chart data <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg border">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Group results by field from {currentFormName}</Label>
                  <Select
                    value={crossRefConfig.sourceGroupByFieldId || '_none'}
                    onValueChange={(value) => onConfigChange({
                      crossRefConfig: {
                        ...crossRefConfig,
                        sourceGroupByFieldId: value === '_none' ? undefined : value
                      }
                    })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="No grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No grouping</SelectItem>
                      {sourceGroupByFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Aggregate chart data by grouping parent records from <span className="font-medium">{currentFormName}</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Optional: Drilldown to Linked Records - available for Count and Aggregate modes only (not Compare) */}
          {isStep1Complete && crossRefConfig.mode !== 'compare' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                  <MousePointerClick className="h-3 w-3" />
                </div>
                <Label className="text-sm font-medium">
                  Click-to-drilldown <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">Enable drill-down to linked records</Label>
                    <p className="text-xs text-muted-foreground">
                      Click a chart bar to view and filter linked <span className="font-medium text-green-600 dark:text-green-400">{targetFormName}</span> records
                    </p>
                  </div>
                  <Switch
                    checked={crossRefConfig.drilldownEnabled || false}
                    onCheckedChange={(checked) => onConfigChange({
                      crossRefConfig: {
                        ...crossRefConfig,
                        drilldownEnabled: checked,
                        drilldownLevels: checked ? crossRefConfig.drilldownLevels : undefined,
                        drilldownDisplayFields: checked ? crossRefConfig.drilldownDisplayFields : undefined
                      }
                    })}
                  />
                </div>
                
                {/* Drilldown Levels - hierarchical filtering with ordered selection */}
                {crossRefConfig.drilldownEnabled && targetFormFields.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    <Label className="text-xs text-muted-foreground">
                      Drilldown hierarchy (add levels in order - first field is filtered first)
                    </Label>
                    
                    {/* Current drilldown levels - ordered list */}
                    {(crossRefConfig.drilldownLevels || []).length > 0 && (
                      <div className="space-y-1">
                        {(crossRefConfig.drilldownLevels || []).map((fieldId, index) => {
                          const field = targetFormFields.find(f => f.id === fieldId);
                          return (
                            <div key={fieldId} className="flex items-center gap-2 p-2 bg-background rounded border">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="flex-1 text-sm">{field?.label || fieldId}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newLevels = (crossRefConfig.drilldownLevels || []).filter(id => id !== fieldId);
                                  onConfigChange({
                                    crossRefConfig: {
                                      ...crossRefConfig,
                                      drilldownLevels: newLevels
                                    }
                                  });
                                }}
                                className="text-muted-foreground hover:text-destructive p-1"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Add new level dropdown */}
                    <Select
                      value=""
                      onValueChange={(fieldId) => {
                        if (fieldId) {
                          const currentLevels = crossRefConfig.drilldownLevels || [];
                          if (!currentLevels.includes(fieldId)) {
                            onConfigChange({
                              crossRefConfig: {
                                ...crossRefConfig,
                                drilldownLevels: [...currentLevels, fieldId]
                              }
                            });
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="+ Add drilldown level..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-md z-50">
                        {targetFormFields
                          .filter(field => !(crossRefConfig.drilldownLevels || []).includes(field.id))
                          .map(field => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    
                    <p className="text-xs text-muted-foreground">
                      Click bar → filter by Level 1 → click again → filter by Level 2, etc.
                    </p>
                  </div>
                )}

                {/* Display fields in drilldown dialog */}
                {crossRefConfig.drilldownEnabled && targetFormFields.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs text-muted-foreground">Fields to show in drilldown dialog</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                      {targetFormFields.map(field => {
                        const isSelected = (crossRefConfig.drilldownDisplayFields || []).includes(field.id);
                        return (
                          <div key={field.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`drill-display-${field.id}`}
                              checked={isSelected}
                              onChange={(e) => {
                                const currentFields = crossRefConfig.drilldownDisplayFields || [];
                                const newFields = e.target.checked
                                  ? [...currentFields, field.id]
                                  : currentFields.filter(id => id !== field.id);
                                onConfigChange({
                                  crossRefConfig: {
                                    ...crossRefConfig,
                                    drilldownDisplayFields: newFields
                                  }
                                });
                              }}
                              className="rounded border-input h-4 w-4"
                            />
                            <label htmlFor={`drill-display-${field.id}`} className="text-xs cursor-pointer">
                              {field.label}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chart Preview Summary */}
          {isStep1Complete && isStep3Complete && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 rounded-lg border border-green-200/50 dark:border-green-800/50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-sm">Your Chart Configuration</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-20 text-xs text-muted-foreground">Each bar:</div>
                  <div className="flex-1">
                    One record from <span className="font-medium text-blue-600 dark:text-blue-400">{currentFormName}</span>
                    {selectedSourceLabelField && (
                      <span className="text-muted-foreground"> (labeled by "{selectedSourceLabelField.label}")</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-20 text-xs text-muted-foreground">Bar height:</div>
                  <div className="flex-1">
                    {crossRefConfig.mode === 'count' ? (
                      <>Number of linked <span className="font-medium text-green-600 dark:text-green-400">{targetFormName}</span> records</>
                    ) : crossRefConfig.mode === 'compare' ? (
                      <>
                        X-Axis: "<span className="font-medium">{selectedCompareXField?.label || 'X field'}</span>" | 
                        Y-Axis: "<span className="font-medium">{selectedCompareYField?.label || 'Y field'}</span>" 
                        from linked <span className="font-medium text-green-600 dark:text-green-400">{targetFormName}</span> records
                      </>
                    ) : (
                      <>
                        {crossRefConfig.targetAggregation?.toUpperCase() || 'SUM'} of "
                        <span className="font-medium">{selectedMetricField?.label || 'field'}</span>" 
                        from linked <span className="font-medium text-green-600 dark:text-green-400">{targetFormName}</span> records
                      </>
                    )}
                  </div>
                </div>
                
                {crossRefConfig.sourceGroupByFieldId && selectedSourceGroupByField && (
                  <div className="flex items-center gap-3">
                    <div className="w-20 text-xs text-muted-foreground">Grouped by:</div>
                    <div className="flex-1">
                      <span className="font-medium">{selectedSourceGroupByField.label}</span>
                    </div>
                  </div>
                )}
                
                {crossRefConfig.drilldownEnabled && (
                  <div className="flex items-center gap-3">
                    <div className="w-20 text-xs text-muted-foreground">Drilldown:</div>
                    <div className="flex-1 text-green-600 dark:text-green-400">
                      Click bars to view linked records
                    </div>
                  </div>
                )}
              </div>
              
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
