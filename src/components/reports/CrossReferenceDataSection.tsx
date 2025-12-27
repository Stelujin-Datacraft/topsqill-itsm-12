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
import { Link2, Calculator, Hash, Info, X, ChevronDown, ChevronUp } from 'lucide-react';
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

  // When a cross-reference field is selected, get its target form
  const selectedCrossRefField = useMemo(() => {
    if (!crossRefConfig?.crossRefFieldId) return null;
    return formFields.find(f => f.id === crossRefConfig.crossRefFieldId);
  }, [formFields, crossRefConfig?.crossRefFieldId]);

  // Extract target form ID from the cross-reference field's custom_config
  const targetFormIdFromField = useMemo(() => {
    if (!selectedCrossRefField) return null;
    const customConfig = (selectedCrossRefField as any).custom_config || (selectedCrossRefField as any).customConfig;
    if (!customConfig) return null;
    
    const parsed = typeof customConfig === 'string' ? JSON.parse(customConfig) : customConfig;
    return parsed?.targetFormId;
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
        
        // Map to FormField-like type for our purposes
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

  // Get numeric fields from target form (for aggregation)
  const numericTargetFields = useMemo(() => {
    return targetFormFields.filter(f => METRIC_FIELD_TYPES.includes(getFieldType(f)));
  }, [targetFormFields]);

  // Get dimension fields from target form (for grouping)
  const dimensionTargetFields = useMemo(() => {
    return targetFormFields.filter(f => DIMENSION_FIELD_TYPES.includes(getFieldType(f)));
  }, [targetFormFields]);

  // Get target form name
  const targetFormName = useMemo(() => {
    const targetId = crossRefConfig?.targetFormId || targetFormIdFromField;
    if (!targetId) return null;
    return forms.find(f => f.id === targetId)?.name;
  }, [forms, crossRefConfig?.targetFormId, targetFormIdFromField]);

  // Handle enabling/disabling cross-reference mode
  const handleToggle = (enabled: boolean) => {
    setIsExpanded(enabled);
    if (enabled) {
      onConfigChange({
        crossRefConfig: {
          enabled: true,
          crossRefFieldId: crossRefFields[0]?.id || '',
          targetFormId: '',
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
    const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
    let targetFormId = '';
    
    if (customConfig) {
      const parsed = typeof customConfig === 'string' ? JSON.parse(customConfig) : customConfig;
      targetFormId = parsed?.targetFormId || '';
    }

    onConfigChange({
      crossRefConfig: {
        ...crossRefConfig!,
        crossRefFieldId: fieldId,
        targetFormId,
        targetMetricFieldId: undefined,
        targetDimensionFieldId: undefined,
      }
    });
  };

  // Handle mode change
  const handleModeChange = (mode: 'count' | 'aggregate') => {
    onConfigChange({
      crossRefConfig: {
        ...crossRefConfig!,
        mode,
        targetMetricFieldId: mode === 'aggregate' ? crossRefConfig?.targetMetricFieldId : undefined,
        targetAggregation: mode === 'aggregate' ? (crossRefConfig?.targetAggregation || 'sum') : undefined,
      }
    });
  };

  // If no cross-reference fields exist, show info message
  if (crossRefFields.length === 0) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Cross-Reference Data</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Use data from linked records in your chart
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
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs">
              Cross-reference fields link to records in other forms. You can count linked records or aggregate their numeric data.
            </AlertDescription>
          </Alert>

          {/* Step 1: Select Cross-Reference Field */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cross-Reference Field</Label>
            <Select
              value={crossRefConfig.crossRefFieldId || ''}
              onValueChange={handleCrossRefFieldChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a cross-reference field..." />
              </SelectTrigger>
              <SelectContent>
                {crossRefFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    <div className="flex items-center gap-2">
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                      <span>{field.label}</span>
                      <Badge variant="secondary" className="text-xs">{getFieldType(field)}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targetFormName && (
              <p className="text-xs text-muted-foreground">
                Links to: <span className="font-medium">{targetFormName}</span>
              </p>
            )}
          </div>

          {/* Step 2: Choose Mode */}
          {crossRefConfig.crossRefFieldId && (crossRefConfig.targetFormId || targetFormIdFromField) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">What do you want to show?</Label>
              <RadioGroup 
                value={crossRefConfig.mode || 'count'} 
                onValueChange={(v) => handleModeChange(v as 'count' | 'aggregate')}
                className="grid gap-2"
              >
                {/* Count Mode */}
                <div 
                  onClick={() => handleModeChange('count')}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    crossRefConfig.mode === 'count' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <RadioGroupItem value="count" id="mode-count" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Hash className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-sm">Count Linked Records</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Show how many records are linked to each parent record.
                      <br />
                      <span className="italic">Example: "Orders per Customer"</span>
                    </p>
                  </div>
                </div>

                {/* Aggregate Mode */}
                <div 
                  onClick={() => handleModeChange('aggregate')}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    crossRefConfig.mode === 'aggregate' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <RadioGroupItem value="aggregate" id="mode-aggregate" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Calculator className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-sm">Aggregate Referenced Data</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sum, average, or calculate values from linked records.
                      <br />
                      <span className="italic">Example: "Total Order Amount per Customer"</span>
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 3: For Aggregate Mode - Select field and aggregation */}
          {crossRefConfig.mode === 'aggregate' && (crossRefConfig.targetFormId || targetFormIdFromField) && (
            <div className="space-y-3 pl-4 border-l-2 border-primary/20">
              {loadingFields ? (
                <p className="text-xs text-muted-foreground">Loading fields...</p>
              ) : numericTargetFields.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    The referenced form has no numeric fields to aggregate. Use "Count Linked Records" instead.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Field to Aggregate</Label>
                    <Select
                      value={crossRefConfig.targetMetricFieldId || ''}
                      onValueChange={(value) => onConfigChange({
                        crossRefConfig: {
                          ...crossRefConfig,
                          targetMetricFieldId: value
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a numeric field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {numericTargetFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            <div className="flex items-center gap-2">
                              <span>{field.label}</span>
                              <Badge variant="outline" className="text-xs">{getFieldType(field)}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Aggregation Type</Label>
                    <Select
                      value={crossRefConfig.targetAggregation || 'sum'}
                      onValueChange={(value) => onConfigChange({
                        crossRefConfig: {
                          ...crossRefConfig,
                          targetAggregation: value as any
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">Sum</SelectItem>
                        <SelectItem value="avg">Average</SelectItem>
                        <SelectItem value="min">Minimum</SelectItem>
                        <SelectItem value="max">Maximum</SelectItem>
                        <SelectItem value="count">Count</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Optional: Group by field from referenced form */}
          {crossRefConfig.crossRefFieldId && (crossRefConfig.targetFormId || targetFormIdFromField) && !loadingFields && dimensionTargetFields.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Group by Referenced Field <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Select
                value={crossRefConfig.targetDimensionFieldId || '_none'}
                onValueChange={(value) => onConfigChange({
                  crossRefConfig: {
                    ...crossRefConfig,
                    targetDimensionFieldId: value === '_none' ? undefined : value
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No grouping</SelectItem>
                  {dimensionTargetFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      <div className="flex items-center gap-2">
                        <span>{field.label}</span>
                        <Badge variant="outline" className="text-xs">{getFieldType(field)}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Break down the data by a category from the referenced form.
              </p>
            </div>
          )}

          {/* Summary */}
          {crossRefConfig.crossRefFieldId && (
            <div className="p-3 bg-muted/50 rounded-lg text-xs">
              <p className="font-medium mb-1">Configuration Summary:</p>
              <p className="text-muted-foreground">
                {crossRefConfig.mode === 'count' ? (
                  <>Count linked records from <span className="font-medium">{targetFormName || 'referenced form'}</span> via "{selectedCrossRefField?.label}"</>
                ) : (
                  <>
                    {crossRefConfig.targetAggregation?.toUpperCase() || 'SUM'} of "
                    {targetFormFields.find(f => f.id === crossRefConfig.targetMetricFieldId)?.label || 'field'}" from{' '}
                    <span className="font-medium">{targetFormName || 'referenced form'}</span>
                  </>
                )}
                {crossRefConfig.targetDimensionFieldId && (
                  <>, grouped by "{targetFormFields.find(f => f.id === crossRefConfig.targetDimensionFieldId)?.label}"</>
                )}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
