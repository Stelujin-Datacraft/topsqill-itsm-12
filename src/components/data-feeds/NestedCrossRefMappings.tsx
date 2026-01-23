import { useState, useEffect, useCallback } from 'react';
import { NestedCrossRefMapping, NestedCrossRefFieldMapping } from '@/types/dataFeed';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowRight, Link2, Unlink, Settings2, Layers, GitBranch } from 'lucide-react';
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
  depth?: number; // Track chain depth
  maxDepth?: number; // Maximum allowed chain depth
}

export function NestedCrossRefMappings({
  targetFormId,
  sourceFields,
  mappings,
  onMappingsChange,
  depth = 0,
  maxDepth = 10,
}: NestedCrossRefMappingsProps) {
  const [targetCrossRefFields, setTargetCrossRefFields] = useState<FieldOption[]>([]);
  const [linkedFormFields, setLinkedFormFields] = useState<Record<string, FieldOption[]>>({});
  const [linkedFormCrossRefFields, setLinkedFormCrossRefFields] = useState<Record<string, FieldOption[]>>({});
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
        .in('field_type', ['cross-reference', 'child-cross-reference'])
        .order('field_order');

      const parsedFields = (data || []).map(field => ({
        ...field,
        custom_config: typeof field.custom_config === 'string' 
          ? JSON.parse(field.custom_config || '{}')
          : field.custom_config || {}
      }));

      setTargetCrossRefFields(parsedFields);
      setLoading(false);
    };

    fetchCrossRefFields();
  }, [targetFormId]);

  // Load linked form fields for existing mappings on mount
  useEffect(() => {
    const loadExistingMappingFields = async () => {
      for (const mapping of mappings) {
        if (mapping.linkedFormId && !linkedFormFields[mapping.linkedFormId]) {
          const { data: fields } = await supabase
            .from('form_fields')
            .select('id, label, field_type, custom_config')
            .eq('form_id', mapping.linkedFormId)
            .order('field_order');

          if (fields) {
            const allFields = fields.map(f => ({
              ...f,
              custom_config: typeof f.custom_config === 'string' ? JSON.parse(f.custom_config || '{}') : f.custom_config || {}
            }));
            
            setLinkedFormFields(prev => ({
              ...prev,
              [mapping.linkedFormId]: allFields
            }));
            
            // Also extract cross-reference fields for chain support
            const crossRefFields = allFields.filter(f => 
              f.field_type === 'cross-reference' || f.field_type === 'child-cross-reference'
            );
            setLinkedFormCrossRefFields(prev => ({
              ...prev,
              [mapping.linkedFormId]: crossRefFields
            }));
          }
        }
      }
    };

    if (mappings.length > 0) {
      loadExistingMappingFields();
    }
  }, [mappings]);

  const fetchLinkedFormFields = async (crossRefFieldId: string, customConfig: any) => {
    const linkedFormId = customConfig?.targetFormId || customConfig?.referencedFormId || customConfig?.parentFormId;
    
    if (!linkedFormId) return null;
    if (linkedFormFields[linkedFormId]) {
      return { formName: undefined, formId: linkedFormId };
    }

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

    const allFields = (fields || []).map(f => ({
      ...f,
      custom_config: typeof f.custom_config === 'string' ? JSON.parse(f.custom_config || '{}') : f.custom_config || {}
    }));

    setLinkedFormFields(prev => ({
      ...prev,
      [linkedFormId]: allFields
    }));

    // Also extract cross-reference fields for chain support
    const crossRefFields = allFields.filter(f => 
      f.field_type === 'cross-reference' || f.field_type === 'child-cross-reference'
    );
    setLinkedFormCrossRefFields(prev => ({
      ...prev,
      [linkedFormId]: crossRefFields
    }));

    return { formName: formData?.name, formId: linkedFormId };
  };

  const addNestedMapping = () => {
    const newMapping: NestedCrossRefMapping = {
      id: uuidv4(),
      targetCrossRefFieldId: '',
      linkedFormId: '',
      fieldMappings: [],
      linkToTarget: true,
      operation: 'create',
      chainMappings: [],
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

    const config = field.custom_config || {};
    const linkedFormId = config.targetFormId || config.referencedFormId || config.parentFormId;
    
    if (!linkedFormId) return;

    const linkedFormInfo = await fetchLinkedFormFields(crossRefFieldId, config);

    updateNestedMapping(mappingId, {
      targetCrossRefFieldId: crossRefFieldId,
      targetCrossRefFieldName: field.label,
      linkedFormId: linkedFormId,
      linkedFormName: linkedFormInfo?.formName,
      fieldMappings: [],
      chainMappings: [],
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
      ...(field === 'sourceFieldId' && {
        sourceFieldName: sourceFields.find(f => f.id === value)?.label,
      }),
      ...(field === 'linkedFieldId' && {
        linkedFieldName: linkedFormFields[mapping.linkedFormId]?.find(f => f.id === value)?.label,
      }),
    };

    updateNestedMapping(mappingId, { fieldMappings: newFieldMappings });
  };

  // Chain mapping handlers
  const updateChainMappings = useCallback((mappingId: string, chainMappings: NestedCrossRefMapping[]) => {
    updateNestedMapping(mappingId, { chainMappings });
  }, []);

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
          {depth === 0 
            ? "The target form doesn't have any cross-reference fields. Add a cross-reference field to the target form to enable nested mappings."
            : "This linked form doesn't have any cross-reference fields to chain further."
          }
        </p>
      </div>
    );
  }

  const depthColors = [
    'border-l-primary',
    'border-l-blue-500',
    'border-l-green-500',
    'border-l-purple-500',
    'border-l-orange-500',
    'border-l-pink-500',
  ];

  return (
    <div className={`space-y-4 ${depth > 0 ? `pl-4 border-l-4 ${depthColors[depth % depthColors.length]}` : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {depth > 0 && <GitBranch className="h-4 w-4 text-muted-foreground" />}
            <Label className="text-base font-medium">
              {depth === 0 ? 'Nested Cross-Reference Mappings' : `Chain Level ${depth + 1}`}
            </Label>
            {depth > 0 && (
              <Badge variant="outline" className="text-xs">
                <Layers className="h-3 w-3 mr-1" />
                Depth {depth + 1}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {depth === 0 
              ? 'Create or update records in forms linked through cross-reference fields'
              : 'Continue the chain to create/update records in deeper linked forms'
            }
          </p>
        </div>
        {depth < maxDepth && (
          <Button type="button" variant="outline" size="sm" onClick={addNestedMapping}>
            <Plus className="h-4 w-4 mr-1" />
            {depth === 0 ? 'Add Nested Mapping' : 'Add Chain Level'}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {mappings.length === 0 && (
        <div className="p-6 border-2 border-dashed rounded-lg text-center">
          <Settings2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">
            {depth === 0 ? 'No Nested Mappings Configured' : 'No Chain Mappings at This Level'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {depth === 0 
              ? 'Click "Add Nested Mapping" to configure how data feeds to forms linked via cross-references'
              : 'Click "Add Chain Level" to continue mapping through deeper cross-reference links'
            }
          </p>
          {depth === 0 && (
            <div className="mt-4 text-left max-w-md mx-auto space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select a cross-reference field from the target form</li>
                <li>Map source fields to the linked form's fields</li>
                <li>Optionally add chain levels to map through deeper links (Form A → B → C → ...)</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Mapping cards */}
      {mappings.map((mapping) => {
        // Get cross-ref fields specific to THIS mapping's linked form
        const thisLinkedCrossRefFields = linkedFormCrossRefFields[mapping.linkedFormId] || [];
        const hasChainSupport = thisLinkedCrossRefFields.length > 0 && depth < maxDepth;
        
        return (
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
                        {(mapping.chainMappings?.length || 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <GitBranch className="h-3 w-3 mr-1" />
                            {mapping.chainMappings?.length} chain level(s)
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={mapping.linkToTarget ? 'default' : 'outline'} className="text-xs">
                          {mapping.linkToTarget ? (
                            <>
                              <Link2 className="h-3 w-3 mr-1" />
                              Linked
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
                          {mapping.fieldMappings.length} field(s)
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
                        The cross-reference field in the {depth === 0 ? 'target' : 'linked'} form
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Operation</Label>
                      <Select
                        value={mapping.operation}
                        onValueChange={(value: 'create' | 'update' | 'create_or_update' | 'skip') =>
                          updateNestedMapping(mapping.id, { operation: value as any })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="create">Create New Record</SelectItem>
                          <SelectItem value="update">Update Existing Record</SelectItem>
                          <SelectItem value="create_or_update">Create or Update</SelectItem>
                          <SelectItem value="skip">Skip (Pass Through to Chain)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {mapping.operation === 'create' && 'Always creates a new record at this level'}
                        {mapping.operation === 'update' && 'Updates existing linked record at this level'}
                        {mapping.operation === 'create_or_update' && 'Updates if found, creates if not'}
                        {mapping.operation === 'skip' && 'Skip this level - only process chain mappings in deeper levels'}
                      </p>
                    </div>
                  </div>

                  {/* Link to target toggle */}
                  <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {mapping.linkToTarget ? (
                          <Link2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Unlink className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <Label className="font-medium">Link to {depth === 0 ? 'Target' : 'Parent'} Record</Label>
                          <p className="text-xs text-muted-foreground">
                            {mapping.linkToTarget
                              ? 'The nested record will be linked back'
                              : 'The nested record will be created independently'}
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

                      {mapping.fieldMappings.map((fm, index) => {
                        const linkedFields = linkedFormFields[mapping.linkedFormId] || [];
                        const hasLinkedFields = linkedFields.length > 0;
                        
                        return (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded bg-background">
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
                                {sourceFields.length === 0 ? (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    No source fields available
                                  </div>
                                ) : (
                                  sourceFields.map((field) => (
                                    <SelectItem key={field.id} value={field.id}>
                                      {field.label}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>

                            <ArrowRight className="h-4 w-4 text-primary shrink-0" />

                            <Select
                              value={fm.linkedFieldId}
                              onValueChange={(value) =>
                                updateFieldMapping(mapping.id, index, 'linkedFieldId', value)
                              }
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder={hasLinkedFields ? "Target field" : "Loading..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {!hasLinkedFields ? (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    {mapping.linkedFormId ? 'Loading fields...' : 'Select cross-ref field first'}
                                  </div>
                                ) : (
                                  linkedFields.map((field) => (
                                    <SelectItem key={field.id} value={field.id}>
                                      {field.label}
                                    </SelectItem>
                                  ))
                                )}
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
                        );
                      })}
                    </div>
                  )}

                  {/* Chain Mappings - Recursive component for deeper levels */}
                  {/* Only show when linked form actually has cross-ref fields */}
                  {mapping.linkedFormId && thisLinkedCrossRefFields.length > 0 && depth < maxDepth && (
                    <div className="mt-4 p-3 border rounded-lg bg-muted/10">
                      <div className="flex items-center gap-2 mb-3">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Chain to Deeper Levels</Label>
                        <Badge variant="outline" className="text-xs">
                          {thisLinkedCrossRefFields.length} cross-ref field(s) available
                        </Badge>
                      </div>
                      <NestedCrossRefMappings
                        targetFormId={mapping.linkedFormId}
                        sourceFields={sourceFields}
                        mappings={mapping.chainMappings || []}
                        onMappingsChange={(chainMappings) => updateChainMappings(mapping.id, chainMappings)}
                        depth={depth + 1}
                        maxDepth={maxDepth}
                      />
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
