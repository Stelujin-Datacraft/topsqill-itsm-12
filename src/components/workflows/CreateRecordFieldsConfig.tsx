import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { FormFieldSelector } from './FormFieldSelector';
import { DynamicValueInput } from './conditions/DynamicValueInput';
import { DynamicFieldSelector } from './DynamicFieldSelector';
import { FormFieldOption } from '@/types/conditions';
import { CreateRecordFieldValue } from '@/types/workflowConfig';

interface CreateRecordFieldsConfigProps {
  targetFormId: string;
  triggerFormId?: string;
  fieldValues: CreateRecordFieldValue[];
  onFieldValuesChange: (values: CreateRecordFieldValue[]) => void;
}

export function CreateRecordFieldsConfig({
  targetFormId,
  triggerFormId,
  fieldValues,
  onFieldValuesChange,
}: CreateRecordFieldsConfigProps) {
  const handleAddField = useCallback(() => {
    const newField: CreateRecordFieldValue = {
      fieldId: '',
      fieldName: '',
      fieldType: '',
      valueType: 'static',
      staticValue: '',
      dynamicValuePath: '',
    };
    onFieldValuesChange([...fieldValues, newField]);
  }, [fieldValues, onFieldValuesChange]);

  const handleRemoveField = useCallback((index: number) => {
    const updated = fieldValues.filter((_, i) => i !== index);
    onFieldValuesChange(updated);
  }, [fieldValues, onFieldValuesChange]);

  const handleFieldUpdate = useCallback((index: number, updates: Partial<CreateRecordFieldValue>) => {
    const updated = fieldValues.map((field, i) => 
      i === index ? { ...field, ...updates } : field
    );
    onFieldValuesChange(updated);
  }, [fieldValues, onFieldValuesChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Field Values (Optional)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddField}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Field
        </Button>
      </div>

      {fieldValues.length === 0 && (
        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          No field values configured. Records will be created with empty/default values.
        </p>
      )}

      {fieldValues.map((fieldValue, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Field #{index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveField(index)}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          <div>
            <Label className="text-xs">Select Field</Label>
            <FormFieldSelector
              formId={targetFormId}
              value={fieldValue.fieldId}
              onValueChange={(fieldId, fieldName, fieldType, fieldOptions) => {
                handleFieldUpdate(index, {
                  fieldId,
                  fieldName,
                  fieldType,
                  fieldOptions: fieldOptions || [],
                });
              }}
              placeholder="Select field"
            />
          </div>

          {fieldValue.fieldId && (
            <div>
              <Label className="text-xs">Value Type</Label>
              <Select
                value={fieldValue.valueType}
                onValueChange={(value: 'static' | 'dynamic') => {
                  handleFieldUpdate(index, { 
                    valueType: value,
                    staticValue: value === 'static' ? fieldValue.staticValue : undefined,
                    dynamicValuePath: value === 'dynamic' ? fieldValue.dynamicValuePath : undefined,
                  });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Static Value</SelectItem>
                  <SelectItem value="dynamic">Dynamic (from trigger)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {fieldValue.fieldId && fieldValue.valueType === 'static' && fieldValue.fieldType && (
            <div>
              <Label className="text-xs">Value</Label>
              <DynamicValueInput
                field={{
                  id: fieldValue.fieldId,
                  label: fieldValue.fieldName || 'Field',
                  type: fieldValue.fieldType,
                  options: fieldValue.fieldOptions || []
                } as FormFieldOption}
                value={fieldValue.staticValue || ''}
                onChange={(value) => handleFieldUpdate(index, { staticValue: value })}
              />
            </div>
          )}

          {fieldValue.fieldId && fieldValue.valueType === 'dynamic' && (
            <div>
              <Label className="text-xs">Source Field</Label>
              <DynamicFieldSelector
                triggerFormId={triggerFormId}
                targetFormId={targetFormId}
                targetFieldType={fieldValue.fieldType}
                value={fieldValue.dynamicValuePath || ''}
                onValueChange={(fieldId, fieldName) => {
                  handleFieldUpdate(index, { dynamicValuePath: fieldId });
                }}
                placeholder="Select source field"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
