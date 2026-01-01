import React, { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FormSelector } from './FormSelector';
import { FormFieldSelector } from './FormFieldSelector';
import { FieldMappingConfig } from './FieldMappingConfig';
import { supabase } from '@/integrations/supabase/client';
import { CreateCombinationRecordsConfig as ConfigType, TargetLinkFieldConfig, FieldMapping } from '@/types/workflowConfig';
import { Trash2, Plus, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateCombinationRecordsConfigProps {
  config: Partial<ConfigType>;
  triggerFormId: string;
  triggerFormName?: string;
  projectId?: string;
  onConfigChange: (config: Partial<ConfigType>) => void;
}

export function CreateCombinationRecordsConfig({
  config,
  triggerFormId,
  triggerFormName,
  projectId,
  onConfigChange
}: CreateCombinationRecordsConfigProps) {
  const [linkedFormLoading, setLinkedFormLoading] = useState(false);
  const [secondLinkedFormLoading, setSecondLinkedFormLoading] = useState(false);
  const [targetFormCrossRefFields, setTargetFormCrossRefFields] = useState<Array<{ id: string; label: string; targetFormId?: string; targetFormName?: string }>>([]);

  const combinationMode = config.combinationMode || 'single';

  // Fetch linked form info for first source cross-ref field
  useEffect(() => {
    const sourceCrossRefFieldId = config.sourceCrossRefFieldId;
    const sourceLinkedFormId = config.sourceLinkedFormId;
    
    if (!sourceCrossRefFieldId || sourceLinkedFormId) return;
    
    setLinkedFormLoading(true);
    
    const fetchLinkedForm = async () => {
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('custom_config')
          .eq('id', sourceCrossRefFieldId)
          .maybeSingle();
        
        if (error || !data) {
          setLinkedFormLoading(false);
          return;
        }
        
        let customConfig: { targetFormId?: string; targetFormName?: string } | null = null;
        if (typeof data.custom_config === 'string') {
          try { customConfig = JSON.parse(data.custom_config); } catch {}
        } else {
          customConfig = data.custom_config as { targetFormId?: string; targetFormName?: string } | null;
        }
        
        if (customConfig?.targetFormId) {
          onConfigChange({
            ...config,
            sourceLinkedFormId: customConfig.targetFormId,
            sourceLinkedFormName: customConfig.targetFormName || 'Unknown Form'
          });
        }
        setLinkedFormLoading(false);
      } catch {
        setLinkedFormLoading(false);
      }
    };
    
    fetchLinkedForm();
  }, [config.sourceCrossRefFieldId, config.sourceLinkedFormId]);

  // Fetch linked form info for second source cross-ref field
  useEffect(() => {
    if (combinationMode !== 'dual') return;
    
    const secondSourceCrossRefFieldId = config.secondSourceCrossRefFieldId;
    const secondSourceLinkedFormId = config.secondSourceLinkedFormId;
    
    if (!secondSourceCrossRefFieldId || secondSourceLinkedFormId) return;
    
    setSecondLinkedFormLoading(true);
    
    const fetchLinkedForm = async () => {
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('custom_config')
          .eq('id', secondSourceCrossRefFieldId)
          .maybeSingle();
        
        if (error || !data) {
          setSecondLinkedFormLoading(false);
          return;
        }
        
        let customConfig: { targetFormId?: string; targetFormName?: string } | null = null;
        if (typeof data.custom_config === 'string') {
          try { customConfig = JSON.parse(data.custom_config); } catch {}
        } else {
          customConfig = data.custom_config as { targetFormId?: string; targetFormName?: string } | null;
        }
        
        if (customConfig?.targetFormId) {
          onConfigChange({
            ...config,
            secondSourceLinkedFormId: customConfig.targetFormId,
            secondSourceLinkedFormName: customConfig.targetFormName || 'Unknown Form'
          });
        }
        setSecondLinkedFormLoading(false);
      } catch {
        setSecondLinkedFormLoading(false);
      }
    };
    
    fetchLinkedForm();
  }, [combinationMode, config.secondSourceCrossRefFieldId, config.secondSourceLinkedFormId]);

  // Fetch cross-reference fields from target form for auto-linking
  useEffect(() => {
    if (!config.targetFormId) {
      setTargetFormCrossRefFields([]);
      return;
    }

    const fetchTargetFormFields = async () => {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type, custom_config')
        .eq('form_id', config.targetFormId)
        .eq('field_type', 'cross-reference');

      if (!error && data) {
        const fields = data.map(f => {
          let targetFormId: string | undefined;
          let targetFormName: string | undefined;
          if (f.custom_config) {
            const cc = typeof f.custom_config === 'string' ? JSON.parse(f.custom_config) : f.custom_config;
            targetFormId = cc?.targetFormId;
            targetFormName = cc?.targetFormName;
          }
          return { id: f.id, label: f.label, targetFormId, targetFormName };
        });
        setTargetFormCrossRefFields(fields);
      }
    };

    fetchTargetFormFields();
  }, [config.targetFormId]);

  const handleModeChange = (mode: 'single' | 'dual') => {
    onConfigChange({
      ...config,
      combinationMode: mode,
      // Clear second source fields when switching to single
      ...(mode === 'single' ? {
        secondSourceCrossRefFieldId: undefined,
        secondSourceCrossRefFieldName: undefined,
        secondSourceLinkedFormId: undefined,
        secondSourceLinkedFormName: undefined,
        secondLinkedFormFieldMappings: undefined
      } : {})
    });
  };

  const handleAddTargetLinkField = () => {
    const newLinkField: TargetLinkFieldConfig = {
      targetFieldId: '',
      linkTo: 'first_source'
    };
    onConfigChange({
      ...config,
      targetLinkFields: [...(config.targetLinkFields || []), newLinkField]
    });
  };

  const handleRemoveTargetLinkField = (index: number) => {
    const newFields = [...(config.targetLinkFields || [])];
    newFields.splice(index, 1);
    onConfigChange({ ...config, targetLinkFields: newFields });
  };

  const handleTargetLinkFieldChange = (index: number, updates: Partial<TargetLinkFieldConfig>) => {
    const newFields = [...(config.targetLinkFields || [])];
    newFields[index] = { ...newFields[index], ...updates };
    onConfigChange({ ...config, targetLinkFields: newFields });
  };

  if (!triggerFormId) {
    return (
      <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
        Please configure the Start Node with a trigger form first, then <strong>save the workflow</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-fuchsia-700 bg-fuchsia-50 p-3 rounded border border-fuchsia-200 mb-4">
        <strong>Create Combination Records</strong> creates records in a target form by combining linked records from cross-reference fields.
      </div>

      {/* Mode Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <span className="bg-fuchsia-600 text-white text-xs px-2 py-0.5 rounded">1</span>
          Combination Mode
        </Label>
        <RadioGroup
          value={combinationMode}
          onValueChange={(v) => handleModeChange(v as 'single' | 'dual')}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single" id="mode-single" />
            <Label htmlFor="mode-single" className="font-normal text-sm">
              Trigger × One Cross-Ref
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dual" id="mode-dual" />
            <Label htmlFor="mode-dual" className="font-normal text-sm">
              Cross-Ref × Cross-Ref (Cartesian)
            </Label>
          </div>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          {combinationMode === 'single' 
            ? 'Creates one record for each linked record in the selected cross-reference field'
            : 'Creates records for every combination of records from two cross-reference fields (Cartesian product)'
          }
        </p>
      </div>

      {/* First Source Cross-Reference Field */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <span className="bg-fuchsia-600 text-white text-xs px-2 py-0.5 rounded">2</span>
          {combinationMode === 'dual' ? 'First' : ''} Source Cross-Reference Field *
        </Label>
        <p className="text-xs text-muted-foreground">
          Select the cross-reference field in {triggerFormName || 'trigger form'}
        </p>
        <FormFieldSelector
          formId={triggerFormId}
          value={config.sourceCrossRefFieldId || ''}
          onValueChange={(fieldId, fieldName, fieldType, fieldOptions, customConfig) => {
            onConfigChange({
              ...config,
              sourceCrossRefFieldId: fieldId,
              sourceCrossRefFieldName: fieldName,
              sourceLinkedFormId: customConfig?.targetFormId,
              sourceLinkedFormName: customConfig?.targetFormName
            });
          }}
          placeholder="Select cross-reference field"
          filterTypes={['cross-reference']}
        />
        {linkedFormLoading && (
          <p className="text-xs text-blue-600">Loading linked form...</p>
        )}
        {config.sourceLinkedFormId && (
          <p className="text-xs text-green-600">
            ✓ Linked to: {config.sourceLinkedFormName || config.sourceLinkedFormId}
          </p>
        )}
      </div>

      {/* Second Source Cross-Reference Field (Dual Mode Only) */}
      {combinationMode === 'dual' && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span className="bg-fuchsia-600 text-white text-xs px-2 py-0.5 rounded">3</span>
            Second Source Cross-Reference Field *
          </Label>
          <p className="text-xs text-muted-foreground">
            Select the second cross-reference field to combine with
          </p>
          <FormFieldSelector
            formId={triggerFormId}
            value={config.secondSourceCrossRefFieldId || ''}
            onValueChange={(fieldId, fieldName, fieldType, fieldOptions, customConfig) => {
              onConfigChange({
                ...config,
                secondSourceCrossRefFieldId: fieldId,
                secondSourceCrossRefFieldName: fieldName,
                secondSourceLinkedFormId: customConfig?.targetFormId,
                secondSourceLinkedFormName: customConfig?.targetFormName
              });
            }}
            placeholder="Select second cross-reference field"
            filterTypes={['cross-reference']}
          />
          {secondLinkedFormLoading && (
            <p className="text-xs text-blue-600">Loading linked form...</p>
          )}
          {config.secondSourceLinkedFormId && (
            <p className="text-xs text-green-600">
              ✓ Linked to: {config.secondSourceLinkedFormName || config.secondSourceLinkedFormId}
            </p>
          )}
        </div>
      )}

      {/* Target Form */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <span className="bg-fuchsia-600 text-white text-xs px-2 py-0.5 rounded">{combinationMode === 'dual' ? '4' : '3'}</span>
          Target Form *
        </Label>
        <p className="text-xs text-muted-foreground">
          The form where new records will be created
        </p>
        <FormSelector
          value={config.targetFormId || ''}
          onValueChange={(formId, formName) => {
            onConfigChange({
              ...config,
              targetFormId: formId,
              targetFormName: formName,
              targetLinkFields: [],
              fieldMappings: [],
              linkedFormFieldMappings: [],
              secondLinkedFormFieldMappings: []
            });
          }}
          placeholder="Select target form"
          projectId={projectId}
        />
      </div>

      {config.targetFormId && (
        <>
          {/* Auto-Link Configuration */}
          <div className="space-y-3 border-t pt-4">
            <Label className="flex items-center gap-2">
              <span className="bg-fuchsia-600 text-white text-xs px-2 py-0.5 rounded">{combinationMode === 'dual' ? '5' : '4'}</span>
              <Link className="h-4 w-4" />
              Auto-Link Target Cross-Reference Fields
            </Label>
            <p className="text-xs text-muted-foreground">
              Select which cross-reference fields in the target form should be automatically linked to source records
            </p>

            {(config.targetLinkFields || []).map((linkField, index) => (
              <div key={index} className="flex gap-2 items-start p-2 bg-muted/30 rounded border">
                <div className="flex-1 space-y-2">
                  <Select
                    value={linkField.targetFieldId}
                    onValueChange={(fieldId) => {
                      const field = targetFormCrossRefFields.find(f => f.id === fieldId);
                      handleTargetLinkFieldChange(index, {
                        targetFieldId: fieldId,
                        targetFieldName: field?.label
                      });
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select target cross-ref field" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetFormCrossRefFields.map(field => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label} {field.targetFormName ? `→ ${field.targetFormName}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={linkField.linkTo}
                    onValueChange={(v) => handleTargetLinkFieldChange(index, { linkTo: v as 'first_source' | 'second_source' })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first_source">
                        Link to: {config.sourceLinkedFormName || 'First Source'}
                      </SelectItem>
                      {combinationMode === 'dual' && (
                        <SelectItem value="second_source">
                          Link to: {config.secondSourceLinkedFormName || 'Second Source'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleRemoveTargetLinkField(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddTargetLinkField}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Link Field
            </Button>

            {targetFormCrossRefFields.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                No cross-reference fields found in target form. Links will be skipped.
              </p>
            )}
          </div>

          {/* Field Mappings from Trigger Form */}
          {combinationMode === 'single' && (
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <span className="bg-fuchsia-600 text-white text-xs px-2 py-0.5 rounded">5</span>
                Map Fields from {triggerFormName || 'Trigger Form'} (Optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Copy values from the trigger form to the new records
              </p>
              <FieldMappingConfig
                triggerFormId={triggerFormId}
                targetFormId={config.targetFormId}
                fieldMappings={config.fieldMappings || []}
                onFieldMappingsChange={(mappings) => onConfigChange({ ...config, fieldMappings: mappings })}
                sourceLabel={`From ${triggerFormName || 'Trigger'}`}
                targetLabel={`To ${config.targetFormName || 'Target'}`}
              />
            </div>
          )}

          {/* Field Mappings from First Linked Form */}
          <div className="space-y-2 border-t pt-4">
            <Label className="flex items-center gap-2">
              <span className="bg-fuchsia-600 text-white text-xs px-2 py-0.5 rounded">{combinationMode === 'dual' ? '6' : '6'}</span>
              Map Fields from {config.sourceLinkedFormName || 'First Linked Form'} (Optional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Copy values from each linked record to the new records
            </p>
            {config.sourceLinkedFormId ? (
              <FieldMappingConfig
                triggerFormId={config.sourceLinkedFormId}
                targetFormId={config.targetFormId}
                fieldMappings={config.linkedFormFieldMappings || []}
                onFieldMappingsChange={(mappings) => onConfigChange({ ...config, linkedFormFieldMappings: mappings })}
                sourceLabel={`From ${config.sourceLinkedFormName || 'First Linked'}`}
                targetLabel={`To ${config.targetFormName || 'Target'}`}
              />
            ) : (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                Select the first source cross-reference field to enable mapping.
              </p>
            )}
          </div>

          {/* Field Mappings from Second Linked Form (Dual Mode) */}
          {combinationMode === 'dual' && (
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <span className="bg-fuchsia-600 text-white text-xs px-2 py-0.5 rounded">7</span>
                Map Fields from {config.secondSourceLinkedFormName || 'Second Linked Form'} (Optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Copy values from each second linked record to the new records
              </p>
              {config.secondSourceLinkedFormId ? (
                <FieldMappingConfig
                  triggerFormId={config.secondSourceLinkedFormId}
                  targetFormId={config.targetFormId}
                  fieldMappings={config.secondLinkedFormFieldMappings || []}
                  onFieldMappingsChange={(mappings) => onConfigChange({ ...config, secondLinkedFormFieldMappings: mappings })}
                  sourceLabel={`From ${config.secondSourceLinkedFormName || 'Second Linked'}`}
                  targetLabel={`To ${config.targetFormName || 'Target'}`}
                />
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  Select the second source cross-reference field to enable mapping.
                </p>
              )}
            </div>
          )}

          {/* Advanced Options */}
          <details className="border-t pt-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Advanced Options
            </summary>
            <div className="space-y-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="preventDuplicates"
                  checked={config.preventDuplicates ?? true}
                  onCheckedChange={(checked) => onConfigChange({ ...config, preventDuplicates: !!checked })}
                />
                <Label htmlFor="preventDuplicates" className="text-sm font-normal">
                  Prevent duplicate combinations
                </Label>
              </div>

              <div>
                <Label>Auto-Link Back to Trigger Form (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Update a cross-reference field in {triggerFormName || 'trigger form'} with created records
                </p>
                <FormFieldSelector
                  formId={triggerFormId}
                  value={config.updateTriggerCrossRefFieldId || ''}
                  onValueChange={(fieldId, fieldName) => {
                    onConfigChange({
                      ...config,
                      updateTriggerCrossRefFieldId: fieldId,
                      updateTriggerCrossRefFieldName: fieldName
                    });
                  }}
                  placeholder="Select cross-reference field (optional)"
                  filterTypes={['cross-reference']}
                />
              </div>
            </div>
          </details>

          {/* Summary */}
          <div className="text-xs text-fuchsia-700 bg-fuchsia-50 p-3 rounded border border-fuchsia-200">
            <strong>Summary:</strong>{' '}
            {combinationMode === 'dual' ? (
              <>
                For each combination of "{config.sourceCrossRefFieldName}" ({config.sourceLinkedFormName}) 
                × "{config.secondSourceCrossRefFieldName}" ({config.secondSourceLinkedFormName}), 
                create a record in "{config.targetFormName}".
              </>
            ) : (
              <>
                For each record in "{config.sourceCrossRefFieldName}" ({config.sourceLinkedFormName}), 
                create a record in "{config.targetFormName}".
              </>
            )}
            {(config.targetLinkFields?.length || 0) > 0 && ` Auto-link ${config.targetLinkFields?.length} field(s).`}
            {(config.linkedFormFieldMappings?.length || 0) > 0 && ` Map ${config.linkedFormFieldMappings?.length} field(s) from first source.`}
            {(config.secondLinkedFormFieldMappings?.length || 0) > 0 && ` Map ${config.secondLinkedFormFieldMappings?.length} field(s) from second source.`}
            {config.preventDuplicates && ' Skip duplicates.'}
          </div>
        </>
      )}
    </div>
  );
}
