import { useState, useEffect } from 'react';
import { NestedCrossRefConfig, NestedFieldMapping } from '@/types/dataFeed';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowRight, ChevronDown, ChevronRight, Link2, Database, LinkIcon, Unlink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
interface FieldOption {
  id: string;
  label: string;
  field_type: string;
  custom_config?: any;
}

interface TargetCrossRefField {
  id: string;
  label: string;
  linkedFormId: string;
  linkedFormName: string;
}

interface NestedCrossRefMappingsProps {
  targetFormId: string;
  sourceFields: FieldOption[];
  nestedMappings: NestedCrossRefConfig[];
  onChange: (mappings: NestedCrossRefConfig[]) => void;
}

export function NestedCrossRefMappings({
  targetFormId,
  sourceFields,
  nestedMappings,
  onChange,
}: NestedCrossRefMappingsProps) {
  const [targetCrossRefFields, setTargetCrossRefFields] = useState<TargetCrossRefField[]>([]);
  const [linkedFormFields, setLinkedFormFields] = useState<Record<string, FieldOption[]>>({});
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Load cross-reference fields from target form
  useEffect(() => {
    if (!targetFormId) {
      setTargetCrossRefFields([]);
      setLinkedFormFields({});
      return;
    }

    const fetchTargetCrossRefFields = async () => {
      setLoading(true);
      try {
        // Get all fields from target form
        const { data: fields, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type, custom_config')
          .eq('form_id', targetFormId)
          .order('field_order');

        console.log('📋 Target form fields:', fields?.length, 'Error:', error);

        // Filter to only cross-reference fields
        const crossRefFields = (fields || []).filter(f => f.field_type === 'cross-reference');
        console.log('🔗 Cross-reference fields found:', crossRefFields.length);
        
        // For each cross-ref field, get the linked form info
        const crossRefData: TargetCrossRefField[] = [];
        const linkedFields: Record<string, FieldOption[]> = {};

        for (const field of crossRefFields) {
          const config = field.custom_config as any;
          console.log(`📝 Field "${field.label}" config:`, config);
          
          // Check both possible property names for the linked form ID
          const linkedFormId = config?.targetFormId || config?.referencedFormId;
          console.log(`  → Linked form ID: ${linkedFormId || 'NOT CONFIGURED'}`);
          
          if (linkedFormId) {
            // Get linked form name
            const { data: formData } = await supabase
              .from('forms')
              .select('name')
              .eq('id', linkedFormId)
              .single();

            // Get fields from linked form
            const { data: formFields } = await supabase
              .from('form_fields')
              .select('id, label, field_type')
              .eq('form_id', linkedFormId)
              .order('field_order');

            crossRefData.push({
              id: field.id,
              label: field.label,
              linkedFormId,
              linkedFormName: formData?.name || 'Unknown Form',
            });

            linkedFields[field.id] = formFields || [];
            console.log(`  ✅ Added: "${field.label}" → "${formData?.name}" (${formFields?.length} fields)`);
          } else {
            console.log(`  ⚠️ Skipped: "${field.label}" - No linked form configured`);
          }
        }

        console.log('📊 Final cross-ref data:', crossRefData.length, 'fields with valid links');
        setTargetCrossRefFields(crossRefData);
        setLinkedFormFields(linkedFields);
      } finally {
        setLoading(false);
      }
    };

    fetchTargetCrossRefFields();
  }, [targetFormId]);

  // Initialize expanded state for fields that have mappings
  useEffect(() => {
    const fieldsWithMappings = new Set(nestedMappings.map(m => m.targetCrossRefFieldId));
    setExpandedFields(fieldsWithMappings);
  }, []);

  const toggleExpanded = (fieldId: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedFields(newExpanded);
  };

  const getOrCreateConfig = (field: TargetCrossRefField): NestedCrossRefConfig => {
    const existing = nestedMappings.find(m => m.targetCrossRefFieldId === field.id);
    if (existing) return existing;
    
    return {
      targetCrossRefFieldId: field.id,
      targetCrossRefFieldName: field.label,
      linkedFormId: field.linkedFormId,
      linkedFormName: field.linkedFormName,
      behavior: 'create',
      fieldMappings: [],
      linkToTarget: true, // Default to linking
    };
  };

  const updateConfig = (fieldId: string, updates: Partial<NestedCrossRefConfig>) => {
    const existingIndex = nestedMappings.findIndex(m => m.targetCrossRefFieldId === fieldId);
    
    if (existingIndex >= 0) {
      const updated = [...nestedMappings];
      updated[existingIndex] = { ...updated[existingIndex], ...updates };
      onChange(updated);
    } else {
      // Find the field info
      const field = targetCrossRefFields.find(f => f.id === fieldId);
      if (field) {
        const newConfig: NestedCrossRefConfig = {
          targetCrossRefFieldId: field.id,
          targetCrossRefFieldName: field.label,
          linkedFormId: field.linkedFormId,
          linkedFormName: field.linkedFormName,
          behavior: 'create',
          fieldMappings: [],
          ...updates,
        };
        onChange([...nestedMappings, newConfig]);
      }
    }
  };

  const addFieldMapping = (fieldId: string) => {
    const config = nestedMappings.find(m => m.targetCrossRefFieldId === fieldId);
    const newMapping: NestedFieldMapping = {
      sourceFieldId: '',
      linkedFieldId: '',
    };
    
    if (config) {
      updateConfig(fieldId, {
        fieldMappings: [...config.fieldMappings, newMapping],
      });
    } else {
      const field = targetCrossRefFields.find(f => f.id === fieldId);
      if (field) {
        updateConfig(fieldId, {
          fieldMappings: [newMapping],
        });
      }
    }
  };

  const updateFieldMapping = (
    configFieldId: string, 
    mappingIndex: number, 
    field: keyof NestedFieldMapping, 
    value: string
  ) => {
    const config = nestedMappings.find(m => m.targetCrossRefFieldId === configFieldId);
    if (!config) return;

    const updatedMappings = [...config.fieldMappings];
    const mapping = { ...updatedMappings[mappingIndex] };
    
    if (field === 'sourceFieldId') {
      const sourceField = sourceFields.find(f => f.id === value);
      mapping.sourceFieldId = value;
      mapping.sourceFieldName = sourceField?.label;
    } else if (field === 'linkedFieldId') {
      const linkedField = linkedFormFields[configFieldId]?.find(f => f.id === value);
      mapping.linkedFieldId = value;
      mapping.linkedFieldName = linkedField?.label;
    }
    
    updatedMappings[mappingIndex] = mapping;
    updateConfig(configFieldId, { fieldMappings: updatedMappings });
  };

  const removeFieldMapping = (configFieldId: string, mappingIndex: number) => {
    const config = nestedMappings.find(m => m.targetCrossRefFieldId === configFieldId);
    if (!config) return;

    const updatedMappings = config.fieldMappings.filter((_, i) => i !== mappingIndex);
    
    if (updatedMappings.length === 0) {
      // Remove the entire config if no mappings left
      onChange(nestedMappings.filter(m => m.targetCrossRefFieldId !== configFieldId));
    } else {
      updateConfig(configFieldId, { fieldMappings: updatedMappings });
    }
  };

  const getMappingCount = (fieldId: string): number => {
    const config = nestedMappings.find(m => m.targetCrossRefFieldId === fieldId);
    return config?.fieldMappings.length || 0;
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        Loading cross-reference fields...
      </div>
    );
  }

  if (targetCrossRefFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg text-muted-foreground bg-muted/20">
        <Database className="h-8 w-8 mb-3 text-primary/60" />
        <p className="text-sm font-medium mb-2">No configured cross-reference fields found</p>
        <div className="text-xs text-center space-y-1 max-w-md">
          <p className="font-medium text-foreground">To use nested mappings:</p>
          <ol className="list-decimal list-inside text-left space-y-1 mt-2">
            <li>Your <strong>Target Form</strong> must have a cross-reference field</li>
            <li>That cross-reference field must be <strong>linked to another form</strong></li>
            <li>When the data feed runs, it will create/update records in that linked form</li>
          </ol>
          <p className="mt-3 text-muted-foreground">
            Example: Target Form "Orders" has a cross-reference to "Customers" → 
            Data feed can auto-create Customer records
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-base font-medium">Nested Record Mappings</Label>
        <p className="text-sm text-muted-foreground">
          Create or update records in forms linked by cross-reference fields. Expand a field to configure its mappings.
        </p>
      </div>

      {targetCrossRefFields.map((field) => {
        const isExpanded = expandedFields.has(field.id);
        const config = nestedMappings.find(m => m.targetCrossRefFieldId === field.id);
        const mappingCount = getMappingCount(field.id);
        const linkedFields = linkedFormFields[field.id] || [];

        return (
          <Collapsible
            key={field.id}
            open={isExpanded}
            onOpenChange={() => toggleExpanded(field.id)}
          >
            <div className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{field.label}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{field.linkedFormName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {config?.linkToTarget === false && (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Unlink className="h-3 w-3 mr-1" />
                        No Link
                      </Badge>
                    )}
                    {mappingCount > 0 && (
                      <Badge variant="secondary">
                        {mappingCount} mapping{mappingCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="p-4 space-y-4 border-t">
                  {/* Link to Target Toggle */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      {(config?.linkToTarget !== false) ? (
                        <LinkIcon className="h-4 w-4 text-primary" />
                      ) : (
                        <Unlink className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <Label className="text-sm font-medium">Link to Target Record</Label>
                        <p className="text-xs text-muted-foreground">
                          {(config?.linkToTarget !== false) 
                            ? "Created/updated record will be linked to the target form's cross-reference field"
                            : "Only create/update in linked form without linking to target record"
                          }
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={config?.linkToTarget !== false}
                      onCheckedChange={(checked) => updateConfig(field.id, { linkToTarget: checked })}
                    />
                  </div>

                  {/* Behavior Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Record Behavior</Label>
                    <RadioGroup
                      value={config?.behavior || 'create'}
                      onValueChange={(value) => updateConfig(field.id, { behavior: value as 'create' | 'update_or_create' })}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="create" id={`${field.id}-create`} />
                        <Label htmlFor={`${field.id}-create`} className="text-sm font-normal cursor-pointer">
                          Always create new record
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="update_or_create" id={`${field.id}-update`} />
                        <Label htmlFor={`${field.id}-update`} className="text-sm font-normal cursor-pointer">
                          Update if exists, otherwise create
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Matching Fields for update_or_create */}
                  {config?.behavior === 'update_or_create' && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="space-y-2">
                        <Label className="text-sm">Match Source Field</Label>
                        <Select
                          value={config.matchingSourceFieldId || ''}
                          onValueChange={(value) => {
                            const sourceField = sourceFields.find(f => f.id === value);
                            updateConfig(field.id, { 
                              matchingSourceFieldId: value,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select source field..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sourceFields.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">With Linked Field</Label>
                        <Select
                          value={config.matchingFieldId || ''}
                          onValueChange={(value) => updateConfig(field.id, { matchingFieldId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select linked field..." />
                          </SelectTrigger>
                          <SelectContent>
                            {linkedFields.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Field Mappings */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Field Mappings</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldMapping(field.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Mapping
                      </Button>
                    </div>

                    {(!config || config.fieldMappings.length === 0) && (
                      <div className="text-sm text-muted-foreground p-3 border border-dashed rounded text-center">
                        No field mappings configured. Add mappings to populate the linked record.
                      </div>
                    )}

                    {config?.fieldMappings.map((mapping, index) => (
                      <div key={index} className="grid grid-cols-[1fr,auto,1fr,auto] gap-2 items-end">
                        <div className="space-y-1">
                          {index === 0 && <Label className="text-xs text-muted-foreground">Source Field</Label>}
                          <Select
                            value={mapping.sourceFieldId}
                            onValueChange={(value) => updateFieldMapping(field.id, index, 'sourceFieldId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceFields.map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground mb-2" />

                        <div className="space-y-1">
                          {index === 0 && <Label className="text-xs text-muted-foreground">Linked Form Field</Label>}
                          <Select
                            value={mapping.linkedFieldId}
                            onValueChange={(value) => updateFieldMapping(field.id, index, 'linkedFieldId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {linkedFields.map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFieldMapping(field.id, index)}
                          className="text-destructive hover:text-destructive mb-0.5"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
