import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { FormSelector } from './FormSelector';
import { FormFieldSelector } from './FormFieldSelector';
import { DynamicFieldSelector } from './DynamicFieldSelector';
import { DynamicValueInput } from './conditions/DynamicValueInput';
import { FormFieldOption } from '@/types/conditions';
import { FieldValueUpdate } from '@/types/workflowConfig';
import { backend as supabase } from '@/services/api';
import {
  isUnusableFieldLabel,
  pickReadableFieldLabel,
  resolveOptionStaticValue,
} from '@/lib/changeFieldValueDisplay';

interface ChangeFieldValueConfigProps {
  config: any;
  projectId?: string;
  triggerFormId?: string;
  onConfigChange: (config: any) => void;
}

export function ChangeFieldValueConfig({
  config,
  projectId,
  triggerFormId,
  onConfigChange
}: ChangeFieldValueConfigProps) {
  // Migrate legacy single-field config to array format
  const getFieldUpdates = useCallback((): FieldValueUpdate[] => {
    if (config?.fieldUpdates && Array.isArray(config.fieldUpdates) && config.fieldUpdates.length > 0) {
      return config.fieldUpdates;
    }
    // Legacy migration: convert single field to array
    if (config?.targetFieldId) {
      return [{
        targetFieldId: config.targetFieldId,
        targetFieldName: config.targetFieldName,
        targetFieldType: config.targetFieldType,
        targetFieldOptions: config.targetFieldOptions,
        targetFieldCustomConfig: config.targetFieldCustomConfig,
        valueType: config.valueType || 'static',
        staticValue: config.staticValue,
        dynamicValuePath: config.dynamicValuePath,
        dynamicFieldName: config.dynamicFieldName,
        dynamicSourceForm: config.dynamicSourceForm,
        dynamicFieldType: config.dynamicFieldType
      }];
    }
    return [];
  }, [config]);

  const fieldUpdates = getFieldUpdates();

  const handleFormChange = useCallback((formId: string, formName?: string) => {
    onConfigChange({
      ...config,
      targetFormId: formId,
      targetFormName: formName,
      fieldUpdates: [], // Reset field updates when form changes
      // Clear legacy fields
      targetFieldId: undefined,
      targetFieldName: undefined,
      targetFieldType: undefined,
      targetFieldOptions: undefined,
      targetFieldCustomConfig: undefined,
      staticValue: undefined,
      dynamicValuePath: undefined
    });
  }, [config, onConfigChange]);

  const handleAddFieldUpdate = useCallback(() => {
    const newUpdate: FieldValueUpdate = {
      targetFieldId: '',
      valueType: 'static'
    };
    onConfigChange({
      ...config,
      fieldUpdates: [...fieldUpdates, newUpdate]
    });
  }, [config, fieldUpdates, onConfigChange]);

  const handleRemoveFieldUpdate = useCallback((index: number) => {
    const updated = fieldUpdates.filter((_, i) => i !== index);
    onConfigChange({
      ...config,
      fieldUpdates: updated
    });
  }, [config, fieldUpdates, onConfigChange]);

  const handleFieldUpdateChange = useCallback((index: number, updates: Partial<FieldValueUpdate>) => {
    const updated = fieldUpdates.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    );
    onConfigChange({
      ...config,
      fieldUpdates: updated
    });
  }, [config, fieldUpdates, onConfigChange]);

  return (
    <div className="space-y-4">
      <div>
        <Label>Target Form *</Label>
        <FormSelector
          value={config?.targetFormId || ''}
          onValueChange={handleFormChange}
          placeholder="Select form to update"
          projectId={projectId}
        />
      </div>

      {config?.targetFormId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Field Updates</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddFieldUpdate}
              className="h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Field
            </Button>
          </div>

          {fieldUpdates.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
              No field updates configured. Click "Add Field" to add one.
            </div>
          )}

          {fieldUpdates.map((update, index) => (
            <FieldUpdateItem
              key={index}
              index={index}
              update={update}
              targetFormId={config.targetFormId}
              triggerFormId={triggerFormId}
              onUpdate={handleFieldUpdateChange}
              onRemove={handleRemoveFieldUpdate}
            />
          ))}
        </div>
      )}

      {fieldUpdates.length > 0 && (
        <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded">
          <strong>Configuration:</strong> Will update {fieldUpdates.length} field(s) 
          in "{config.targetFormName || config.targetFormId}"
        </div>
      )}
    </div>
  );
}

interface FieldUpdateItemProps {
  index: number;
  update: FieldValueUpdate;
  targetFormId: string;
  triggerFormId?: string;
  onUpdate: (index: number, updates: Partial<FieldValueUpdate>) => void;
  onRemove: (index: number) => void;
}

function FieldUpdateItem({
  index,
  update,
  targetFormId,
  triggerFormId,
  onUpdate,
  onRemove
}: FieldUpdateItemProps) {
  const [loadingOptions, setLoadingOptions] = useState(false);

  // AI Builder often sets targetFieldId + staticValue but omits/mis-sets
  // targetFieldType and targetFieldName (sometimes the UUID). Hydrate from DB.
  useEffect(() => {
    if (!update.targetFieldId) return;

    const fieldType = (update.targetFieldType || '').toLowerCase();
    const optionFieldTypes = ['select', 'radio', 'dropdown', 'multiselect', 'multi-select', 'checkbox', 'toggle'];
    const needsType = !update.targetFieldType;
    const needsLabel = isUnusableFieldLabel(update.targetFieldName, update.targetFieldId);
    const isOptionField = optionFieldTypes.some((t) => fieldType.includes(t));
    const needsOptions = (needsType || isOptionField)
      && !(Array.isArray(update.targetFieldOptions) && update.targetFieldOptions.length > 0);

    // Locally normalize staticValue against options we already have
    if (!needsType && !needsLabel && !needsOptions) {
      const resolved = resolveOptionStaticValue(update.targetFieldOptions, update.staticValue);
      if (resolved && resolved.value !== String(update.staticValue ?? '')) {
        onUpdate(index, { staticValue: resolved.value });
      }
      return;
    }

    let cancelled = false;
    const fetchFieldMeta = async () => {
      setLoadingOptions(true);
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('label, field_type, options, custom_config')
          .eq('id', update.targetFieldId)
          .maybeSingle();

        if (cancelled || error || !data) return;

        let options = data.options;
        if (typeof options === 'string') {
          try { options = JSON.parse(options); } catch { options = []; }
        }
        if (!Array.isArray(options)) options = [];

        let customConfig = data.custom_config;
        if (typeof customConfig === 'string') {
          try { customConfig = JSON.parse(customConfig); } catch { customConfig = {}; }
        }

        const patch: Partial<FieldValueUpdate> = {};
        if (needsType && data.field_type) {
          patch.targetFieldType = data.field_type;
        }
        if (needsLabel && data.label) {
          patch.targetFieldName = data.label;
        }
        if (options.length > 0) {
          patch.targetFieldOptions = options as Array<{ label: string; value: string }>;
        }
        if (customConfig) {
          patch.targetFieldCustomConfig = customConfig;
        }
        if (!update.valueType) {
          patch.valueType = 'static';
        }

        const optsForResolve = (patch.targetFieldOptions || update.targetFieldOptions) as Array<{ label: string; value: string }>;
        const resolved = resolveOptionStaticValue(optsForResolve, update.staticValue);
        if (resolved && resolved.value !== String(update.staticValue ?? '')) {
          patch.staticValue = resolved.value;
        }

        if (Object.keys(patch).length > 0) {
          onUpdate(index, patch);
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    fetchFieldMeta();
    return () => { cancelled = true; };
  }, [
    update.targetFieldId,
    update.targetFieldType,
    update.targetFieldName,
    update.targetFieldOptions,
    update.valueType,
    update.staticValue,
    index,
    onUpdate,
  ]);

  const displayFieldName = pickReadableFieldLabel(
    update.targetFieldName,
    undefined,
    update.targetFieldId,
  );
  const resolvedOption = resolveOptionStaticValue(update.targetFieldOptions, update.staticValue);
  const displayStaticLabel = resolvedOption?.label
    ?? (update.staticValue !== undefined && update.staticValue !== null && typeof update.staticValue !== 'object'
      ? String(update.staticValue)
      : '');

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Field #{index + 1}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        <div>
          <Label className="text-xs">Field to Update *</Label>
          <FormFieldSelector
            formId={targetFormId}
            value={update.targetFieldId || ''}
            excludeNonInputFields
            onValueChange={(fieldId, fieldName, fieldType, fieldOptions, customConfig) => {
              onUpdate(index, {
                targetFieldId: fieldId,
                targetFieldName: fieldName,
                targetFieldType: fieldType,
                targetFieldOptions: fieldOptions,
                targetFieldCustomConfig: customConfig,
                // Reset value when field changes
                staticValue: undefined,
                dynamicValuePath: undefined
              });
            }}
            placeholder="Select field"
          />
        </div>

        {update.targetFieldId && (
          <div>
            <Label className="text-xs">Value Type *</Label>
            <Select
              value={update.valueType || 'static'}
              onValueChange={(value) => onUpdate(index, { 
                valueType: value as 'static' | 'dynamic',
                staticValue: undefined,
                dynamicValuePath: undefined
              })}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select value type" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="static">Static Value</SelectItem>
                <SelectItem value="dynamic">Dynamic (from trigger data)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {((update.valueType || 'static') === 'static') && update.targetFieldId && (
          <div>
            <Label className="text-xs">New Value</Label>
            {loadingOptions && !update.targetFieldType ? (
              <div className="text-xs text-muted-foreground">Loading field…</div>
            ) : update.targetFieldType ? (
              <DynamicValueInput
                field={{
                  id: update.targetFieldId,
                  label: displayFieldName,
                  type: update.targetFieldType,
                  options: (update.targetFieldOptions || []) as Array<{ label: string; value: string }>,
                  custom_config: update.targetFieldCustomConfig || {}
                } as FormFieldOption}
                value={resolvedOption?.value ?? update.staticValue ?? ''}
                onChange={(value) => onUpdate(index, { staticValue: value })}
                hideFieldCaption
              />
            ) : (
              <div className="text-xs text-muted-foreground">Loading field input…</div>
            )}
          </div>
        )}

        {update.valueType === 'dynamic' && (
          <div>
            <Label className="text-xs">Source Field</Label>
            <DynamicFieldSelector
              triggerFormId={triggerFormId}
              targetFormId={targetFormId}
              targetFieldType={update.targetFieldType}
              value={update.dynamicValuePath || ''}
              onValueChange={(fieldId, fieldName, sourceForm, fieldType) => {
                onUpdate(index, {
                  dynamicValuePath: fieldId,
                  dynamicFieldName: fieldName,
                  dynamicSourceForm: sourceForm,
                  dynamicFieldType: fieldType
                });
              }}
              placeholder="Select compatible field"
            />
          </div>
        )}

        {update.targetFieldId && update.valueType && (update.staticValue !== undefined || update.dynamicValuePath) && (
          <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
            "{displayFieldName}" → {update.valueType === 'static' 
              ? (() => {
                  if (update.staticValue && typeof update.staticValue === 'object') {
                    const val = update.staticValue as any;
                    if (val.users || val.groups) {
                      const parts = [];
                      if (val.users?.length) parts.push(`${val.users.length} user(s)`);
                      if (val.groups?.length) parts.push(`${val.groups.length} group(s)`);
                      return parts.length > 0 ? parts.join(', ') : 'No selection';
                    }
                    return JSON.stringify(val);
                  }
                  return `"${displayStaticLabel}"`;
                })()
              : `from "${update.dynamicFieldName || update.dynamicValuePath}"`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
