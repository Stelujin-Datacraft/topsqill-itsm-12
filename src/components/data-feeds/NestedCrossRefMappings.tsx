import { useState, useEffect } from 'react';
import { NestedCrossRefMapping, NestedCrossRefFieldMapping } from '@/types/dataFeed';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowRight, Link2, Unlink, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface FieldOption {
  id: string;
  label: string;
  field_type: string;
  custom_config?: any;
}

interface NestedCrossRefMappingsProps {
  targetFormId: string;
  sourceFields: FieldOption[];
  mappings: NestedCrossRefMapping[];
  onMappingsChange: (mappings: NestedCrossRefMapping[]) => void;
}

export function NestedCrossRefMappings({
  targetFormId,
  sourceFields,
  mappings,
  onMappingsChange,
}: NestedCrossRefMappingsProps) {
  const [targetCrossRefFields, setTargetCrossRefFields] = useState<FieldOption[]>([]);
  const [linkedFormFields, setLinkedFormFields] = useState<Record<string, FieldOption[]>>({});
  const [expandedMappings, setExpandedMappings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Fetch cross-reference fields from the target form
  useEffect(() => {
    if (!targetFormId) {
      setTargetCrossRefFields([]);
      return;
    }

    const fetchCrossRefFields = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('form_fields')
        .select('id, label, field_type, custom_config')
        .eq('form_id', targetFormId)
        .eq('field_type', 'cross-reference')
        .order('field_order');

      setTargetCrossRefFields(data || []);
      setLoading(false);
    };

    fetchCrossRefFields();
  }, [targetFormId]);

  // Fetch fields from linked forms when cross-ref fields change
  const fetchLinkedFormFields = async (crossRefFieldId: string, customConfig: any) => {
    const linkedFormId = customConfig?.targetFormId || customConfig?.referencedFormId;
    if (!linkedFormId) return;

    // Check if we already have the fields
    if (linkedFormFields[linkedFormId]) return;

    const { data: formData } = await supabase
      .from('forms')
      .select('name')
      .eq('id', linkedFormId)
      .single();

    const { data: fields } = await supabase
      .from('form_fields')
      .select('id, label, field_type, custom_config')
      .eq('form_id', linkedFormId)
      .order('field_order');

    setLinkedFormFields(prev => ({
      ...prev,
      [linkedFormId]: fields || []
    }));

    return { formName: formData?.name, formId: linkedFormId };
  };

  const addNestedMapping = () => {
    const newMapping: NestedCrossRefMapping = {
      id: uuidv4(),
      targetCrossRefFieldId: '',
      linkedFormId: '',
      fieldMappings: [],
      linkToTarget: true, // Default to linking
      operation: 'create',
    };
    onMappingsChange([...mappings, newMapping]);
    setExpandedMappings(prev => ({ ...prev, [newMapping.id]: true }));
  };

  const removeNestedMapping = (id: string) => {
    onMappingsChange(mappings.filter(m => m.id !== id));
  };

  const updateNestedMapping = (id: string, updates: Partial<NestedCrossRefMapping>) => {
    onMappingsChange(
      mappings.map(m => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const handleCrossRefFieldSelect = async (mappingId: string, crossRefFieldId: string) => {
    const field = targetCrossRefFields.find(f => f.id === crossRefFieldId);
    if (!field) return;

    const linkedFormInfo = await fetchLinkedFormFields(crossRefFieldId, field.custom_config);
    const linkedFormId = field.custom_config?.targetFormId || field.custom_config?.referencedFormId;

    updateNestedMapping(mappingId, {
      targetCrossRefFieldId: crossRefFieldId,
      targetCrossRefFieldName: field.label,
      linkedFormId: linkedFormId,
      linkedFormName: linkedFormInfo?.formName,
      fieldMappings: [],
    });
  };

  const addFieldMapping = (mappingId: string) => {
    const mapping = mappings.find(m => m.id === mappingId);
    if (!mapping) return;

    const newFieldMapping: NestedCrossRefFieldMapping = {
      sourceFieldId: '',
      linkedFieldId: '',
    };

    updateNestedMapping(mappingId, {
      fieldMappings: [...mapping.fieldMappings, newFieldMapping],
    });
  };

  const removeFieldMapping = (mappingId: string, index: number) => {
    const mapping = mappings.find(m => m.id === mappingId);
    if (!mapping) return;

    updateNestedMapping(mappingId, {
      fieldMappings: mapping.fieldMappings.filter((_, i) => i !== index),
    });
  };

  const updateFieldMapping = (
    mappingId: string,
    index: number,
    field: 'sourceFieldId' | 'linkedFieldId',
    value: string
  ) => {
    const mapping = mappings.find(m => m.id === mappingId);
    if (!mapping) return;

    const newFieldMappings = [...mapping.fieldMappings];
    newFieldMappings[index] = {
      ...newFieldMappings[index],
      [field]: value,
      // Add field names for display
      ...(field === 'sourceFieldId' && {
        sourceFieldName: sourceFields.find(f => f.id === value)?.label,
      }),
      ...(field === 'linkedFieldId' && {
        linkedFieldName: linkedFormFields[mapping.linkedFormId]?.find(f => f.id === value)?.label,
      }),
    };

    updateNestedMapping(mappingId, { fieldMappings: newFieldMappings });
  };

  const toggleExpanded = (id: string) => {
    setExpandedMappings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading cross-reference fields...</div>;
  }

  if (targetCrossRefFields.length === 0) {
    return (
      <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
        <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">No Cross-Reference Fields Found</p>
        <p className="text-xs mt-1">
          The target form doesn't have any cross-reference fields. Add a cross-reference field to the target form to enable nested mappings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Nested Cross-Reference Mappings</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Create or update records in forms linked through cross-reference fields
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addNestedMapping}>
          <Plus className="h-4 w-4 mr-1" />
          Add Nested Mapping
        </Button>
      </div>

      {/* Empty state */}
      {mappings.length === 0 && (
        <div className="p-6 border-2 border-dashed rounded-lg text-center">
          <Settings2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">No Nested Mappings Configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Click "Add Nested Mapping" to configure how data feeds to forms linked via cross-references
          </p>
          <div className="mt-4 text-left max-w-md mx-auto space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How it works:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Select a cross-reference field from the target form</li>
              <li>Map source fields to the linked form's fields</li>
              <li>Choose whether to link the created record back to the target</li>
            </ol>
          </div>
        </div>
      )}

      {/* Mapping cards */}
      {mappings.map((mapping) => (
        <Collapsible
          key={mapping.id}
          open={expandedMappings[mapping.id]}
          onOpenChange={() => toggleExpanded(mapping.id)}
        >
          <div className="border rounded-lg overflow-hidden">
            {/* Header */}
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  {expandedMappings[mapping.id] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {mapping.targetCrossRefFieldName || 'Select Cross-Reference Field'}
                      </span>
                      {mapping.linkedFormName && (
                        <>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="secondary">{mapping.linkedFormName}</Badge>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={mapping.linkToTarget ? 'default' : 'outline'} className="text-xs">
                        {mapping.linkToTarget ? (
                          <>
                            <Link2 className="h-3 w-3 mr-1" />
                            Link to Target
                          </>
                        ) : (
                          <>
                            <Unlink className="h-3 w-3 mr-1" />
                            Independent
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {mapping.operation.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {mapping.fieldMappings.length} field mapping(s)
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNestedMapping(mapping.id);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="p-4 space-y-4 border-t">
                {/* Cross-reference field selector */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cross-Reference Field *</Label>
                    <Select
                      value={mapping.targetCrossRefFieldId}
                      onValueChange={(value) => handleCrossRefFieldSelect(mapping.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {targetCrossRefFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The cross-reference field in the target form
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Operation</Label>
                    <Select
                      value={mapping.operation}
                      onValueChange={(value: 'create' | 'update' | 'create_or_update') =>
                        updateNestedMapping(mapping.id, { operation: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create">Create New Record</SelectItem>
                        <SelectItem value="update">Update Existing Record</SelectItem>
                        <SelectItem value="create_or_update">Create or Update</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Link to target toggle */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="flex items-center gap-3">
                    {mapping.linkToTarget ? (
                      <Link2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Unlink className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <Label className="font-medium">Link to Target Record</Label>
                      <p className="text-xs text-muted-foreground">
                        {mapping.linkToTarget
                          ? 'The created/updated record will be automatically linked to the target record'
                          : 'The record will be created/updated independently without linking'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={mapping.linkToTarget}
                    onCheckedChange={(checked) =>
                      updateNestedMapping(mapping.id, { linkToTarget: checked })
                    }
                  />
                </div>

                {/* Field mappings */}
                {mapping.linkedFormId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Field Mappings</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldMapping(mapping.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Field
                      </Button>
                    </div>

                    {mapping.fieldMappings.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded">
                        Add field mappings to define which source values populate the linked form
                      </p>
                    )}

                    {mapping.fieldMappings.map((fm, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select
                          value={fm.sourceFieldId}
                          onValueChange={(value) =>
                            updateFieldMapping(mapping.id, index, 'sourceFieldId', value)
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Source field" />
                          </SelectTrigger>
                          <SelectContent>
                            {sourceFields.map((field) => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                        <Select
                          value={fm.linkedFieldId}
                          onValueChange={(value) =>
                            updateFieldMapping(mapping.id, index, 'linkedFieldId', value)
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Linked form field" />
                          </SelectTrigger>
                          <SelectContent>
                            {(linkedFormFields[mapping.linkedFormId] || []).map((field) => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFieldMapping(mapping.id, index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
