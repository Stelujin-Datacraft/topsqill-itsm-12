
import React, { useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link2, Zap } from 'lucide-react';
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
    useCrossReference?: boolean;
  };
  onJoinConfigChange: (config: any) => void;
}

interface CrossReferenceInfo {
  fieldId: string;
  fieldLabel: string;
  targetFormId: string;
  targetFormName?: string;
}

export function FormJoinConfig({
  enabled,
  onEnabledChange,
  primaryForm,
  availableForms,
  joinConfig,
  onJoinConfigChange
}: FormJoinConfigProps) {
  const secondaryForm = availableForms.find(f => f.id === joinConfig.secondaryFormId);
  
  // Get field type supporting both .type and .field_type
  const getFieldType = (field: any): string => {
    return field?.field_type || field?.type || '';
  };

  // Detect cross-reference fields in primary form
  const crossReferenceFields = useMemo((): CrossReferenceInfo[] => {
    const crossRefFields: CrossReferenceInfo[] = [];
    
    primaryForm.fields.forEach(field => {
      const fieldType = getFieldType(field);
      if (fieldType === 'cross-reference' || fieldType === 'child-cross-reference') {
        // Parse customConfig to get targetFormId
        let customConfig: any = {};
        try {
          if (typeof (field as any).custom_config === 'string') {
            customConfig = JSON.parse((field as any).custom_config);
          } else if ((field as any).custom_config) {
            customConfig = (field as any).custom_config;
          } else if (typeof (field as any).customConfig === 'string') {
            customConfig = JSON.parse((field as any).customConfig);
          } else if ((field as any).customConfig) {
            customConfig = (field as any).customConfig;
          }
        } catch (e) {
          console.warn('Failed to parse cross-reference config:', e);
        }

        const targetFormId = customConfig?.targetFormId;
        if (targetFormId) {
          const targetForm = availableForms.find(f => f.id === targetFormId);
          crossRefFields.push({
            fieldId: field.id,
            fieldLabel: field.label,
            targetFormId,
            targetFormName: targetForm?.name || customConfig?.targetFormName
          });
        }
      }
    });
    
    return crossRefFields;
  }, [primaryForm.fields, availableForms]);

  // Apply cross-reference quick join
  const applyCrossReferenceJoin = (crossRef: CrossReferenceInfo) => {
    onJoinConfigChange({
      secondaryFormId: crossRef.targetFormId,
      joinType: 'left',
      primaryFieldId: crossRef.fieldId,
      secondaryFieldId: '__submission_ref_id__', // Special marker for submission_ref_id
      useCrossReference: true
    });
    if (!enabled) {
      onEnabledChange(true);
    }
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

      {/* Cross-Reference Quick Join Suggestions */}
      {crossReferenceFields.length > 0 && (
        <CardContent className="pt-0 pb-2">
          <Alert className="bg-primary/5 border-primary/20">
            <Zap className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="text-sm font-medium">Cross-Reference Fields Detected</p>
                <p className="text-xs text-muted-foreground">
                  Quickly join data from referenced forms:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {crossReferenceFields.map((crossRef) => (
                    <Button
                      key={crossRef.fieldId}
                      variant="outline"
                      size="sm"
                      className="h-auto py-1.5 px-3 text-xs"
                      onClick={() => applyCrossReferenceJoin(crossRef)}
                    >
                      <Link2 className="h-3 w-3 mr-1.5" />
                      <span className="font-medium">{crossRef.fieldLabel}</span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span>{crossRef.targetFormName || 'Target Form'}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      )}

      {enabled && (
        <CardContent className="space-y-4">
          {/* Show indicator if using cross-reference join */}
          {joinConfig.useCrossReference && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 p-2 rounded-md">
              <Link2 className="h-4 w-4" />
              <span>Using cross-reference join (matches by submission reference ID)</span>
            </div>
          )}

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
                    secondaryFieldId: '',
                    useCrossReference: false
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select secondary form" />
                </SelectTrigger>
                <SelectContent>
                  {availableForms
                    .filter(form => form.id !== primaryForm.id)
                    .map((form) => {
                      // Check if this form is a cross-reference target
                      const isCrossRefTarget = crossReferenceFields.some(
                        cr => cr.targetFormId === form.id
                      );
                      return (
                        <SelectItem key={form.id} value={form.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{form.name}</span>
                            <div className="flex items-center gap-1 ml-2">
                              {isCrossRefTarget && (
                                <Badge variant="default" className="text-xs">
                                  <Link2 className="h-2.5 w-2.5 mr-1" />
                                  Referenced
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {form.fields?.length || 0} fields
                              </Badge>
                            </div>
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
                    // Check if this is a cross-reference field
                    const isCrossRef = crossReferenceFields.some(
                      cr => cr.fieldId === value && cr.targetFormId === joinConfig.secondaryFormId
                    );
                    onJoinConfigChange({ 
                      ...joinConfig, 
                      primaryFieldId: value,
                      secondaryFieldId: isCrossRef ? '__submission_ref_id__' : '',
                      useCrossReference: isCrossRef
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const joinableFields = getJoinableFields(primaryForm.fields || [], secondaryForm?.fields || []);
                      
                      // Include cross-reference fields that target this secondary form
                      const crossRefFieldsForSecondary = crossReferenceFields
                        .filter(cr => cr.targetFormId === joinConfig.secondaryFormId)
                        .map(cr => primaryForm.fields.find(f => f.id === cr.fieldId))
                        .filter(Boolean) as FormField[];
                      
                      // Merge both, removing duplicates
                      const allFields = [...joinableFields];
                      crossRefFieldsForSecondary.forEach(crField => {
                        if (!allFields.find(f => f.id === crField.id)) {
                          allFields.push(crField);
                        }
                      });
                      
                      // If still empty, show all fields
                      const fieldsToShow = allFields.length > 0 
                        ? allFields 
                        : (primaryForm.fields || []);
                      
                      return fieldsToShow.map((field) => {
                        const fieldType = getFieldType(field);
                        const isCrossRef = crossReferenceFields.some(
                          cr => cr.fieldId === field.id && cr.targetFormId === joinConfig.secondaryFormId
                        );
                        return (
                          <SelectItem key={field.id} value={field.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{field.label}</span>
                              <div className="flex items-center gap-1 ml-2">
                                {isCrossRef && (
                                  <Badge variant="default" className="text-xs">
                                    <Link2 className="h-2.5 w-2.5 mr-1" />
                                    Cross-Ref
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {fieldType}
                                </Badge>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      });
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Secondary Form Field</Label>
                {joinConfig.useCrossReference ? (
                  <div className="p-3 bg-muted rounded-md text-sm">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <span>Submission Reference ID</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-matched via cross-reference field values
                    </p>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
