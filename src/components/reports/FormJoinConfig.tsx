
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { JOIN_TYPES, canFieldsBeJoined } from '@/utils/chartConfig';
import { FormField } from '@/types/form';

interface FormJoinConfigProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  primaryForm: { id: string; name: string; fields: FormField[] };
  availableForms: Array<{ id: string; name: string; fields: FormField[] }>;
  joinConfig: {
    secondaryFormId: string;
    joinType: string;
    primaryFieldId: string;
    secondaryFieldId: string;
  };
  onJoinConfigChange: (config: any) => void;
}

export function FormJoinConfig({
  enabled,
  onEnabledChange,
  primaryForm,
  availableForms,
  joinConfig,
  onJoinConfigChange
}: FormJoinConfigProps) {
  const safeAvailableForms = availableForms || [];
  const secondaryForm = safeAvailableForms.find(f => f.id === joinConfig?.secondaryFormId);
  
  // Get field type supporting both .type and .field_type
  const getFieldType = (field: any): string => {
    return field?.field_type || field?.type || '';
  };

  const getJoinableFields = (form1Fields: FormField[], form2Fields: FormField[]) => {
    // Return all fields from form1 that have at least one compatible field in form2
    return form1Fields.filter(field1 => {
      const type1 = getFieldType(field1);
      return form2Fields.some(field2 => {
        const type2 = getFieldType(field2);
        return canFieldsBeJoined(
          { ...field1, type: type1 } as FormField,
          { ...field2, type: type2 } as FormField
        );
      });
    });
  };

  const getCompatibleSecondaryFields = (primaryFieldId: string) => {
    if (!secondaryForm || !primaryFieldId) return [];
    
    const primaryField = primaryForm.fields.find(f => f.id === primaryFieldId);
    if (!primaryField) return [];
    
    const primaryType = getFieldType(primaryField);
    return secondaryForm.fields.filter(field => {
      const secondaryType = getFieldType(field);
      return canFieldsBeJoined(
        { ...primaryField, type: primaryType } as FormField,
        { ...field, type: secondaryType } as FormField
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Form Join Configuration</CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="join-enabled" className="text-sm">Enable Join</Label>
            <Switch
              id="join-enabled"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Form</Label>
              <div className="p-3 bg-muted rounded-md">
                <div className="font-medium">{primaryForm.name}</div>
                <Badge variant="secondary" className="text-xs mt-1">
                  {primaryForm.fields.length} fields
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Secondary Form</Label>
              <Select
                value={joinConfig.secondaryFormId}
                onValueChange={(value) => {
                  console.log('Secondary form selected:', value);
                  onJoinConfigChange({ 
                    ...joinConfig, 
                    secondaryFormId: value,
                    primaryFieldId: '',
                    secondaryFieldId: ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select secondary form" />
                </SelectTrigger>
                <SelectContent>
                  {safeAvailableForms
                    .filter(form => form.id !== primaryForm?.id)
                    .map((form) => {
                      console.log('Available form:', form.name, 'Fields:', form.fields?.length || 0);
                      return (
                        <SelectItem key={form.id} value={form.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{form.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {form.fields?.length || 0} fields
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Join Type</Label>
            <Select
              value={joinConfig.joinType}
              onValueChange={(value) => 
                onJoinConfigChange({ ...joinConfig, joinType: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select join type" />
              </SelectTrigger>
              <SelectContent>
                {JOIN_TYPES.map((joinType) => (
                  <SelectItem key={joinType.value} value={joinType.value}>
                    <div>
                      <div className="font-medium">{joinType.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {joinType.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {joinConfig.secondaryFormId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Form Field</Label>
                <Select
                  value={joinConfig.primaryFieldId}
                  onValueChange={(value) => {
                    console.log('Primary field selected:', value);
                    onJoinConfigChange({ 
                      ...joinConfig, 
                      primaryFieldId: value,
                      secondaryFieldId: ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const joinableFields = getJoinableFields(primaryForm.fields || [], secondaryForm?.fields || []);
                      console.log('Primary form joinable fields:', joinableFields.length);
                      
                      // If no joinable fields found via compatibility, show all fields
                      const fieldsToShow = joinableFields.length > 0 
                        ? joinableFields 
                        : (primaryForm.fields || []);
                      
                      return fieldsToShow.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{field.label}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {getFieldType(field)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Secondary Form Field</Label>
                <Select
                  value={joinConfig.secondaryFieldId}
                  onValueChange={(value) => {
                    console.log('Secondary field selected:', value);
                    onJoinConfigChange({ ...joinConfig, secondaryFieldId: value });
                  }}
                  disabled={!joinConfig.primaryFieldId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const compatibleFields = getCompatibleSecondaryFields(joinConfig.primaryFieldId);
                      console.log('Secondary form compatible fields:', compatibleFields.length);
                      
                      // If no compatible fields found, show all secondary form fields
                      const fieldsToShow = compatibleFields.length > 0 
                        ? compatibleFields 
                        : (secondaryForm?.fields || []);
                      
                      return fieldsToShow.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{field.label}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {getFieldType(field)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
