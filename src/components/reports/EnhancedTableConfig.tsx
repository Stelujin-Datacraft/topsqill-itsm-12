import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, ArrowDown, ArrowRight, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';
import { ScrollArea } from '@/components/ui/scroll-area';

interface JoinConfiguration {
  enabled: boolean;
  joins: Array<{
    id: string;
    secondaryFormId: string;
    joinType: 'inner' | 'left' | 'right' | 'full';
    primaryFieldId: string;
    secondaryFieldId: string;
    alias?: string;
  }>;
}

interface DrilldownConfiguration {
  enabled: boolean;
  fields: string[]; // Fields that can be used for drilling down
}

interface EnhancedTableConfigProps {
  config: any;
  forms: Array<{ id: string; name: string; fields?: FormField[] }>;
  onConfigChange: (config: any) => void;
}

const JOIN_TYPES = [
  { value: 'inner', label: 'Inner Join', description: 'Only matching records' },
  { value: 'left', label: 'Left Join', description: 'All from primary + matched secondary' },
  { value: 'right', label: 'Right Join', description: 'All from secondary + matched primary' },
  { value: 'full', label: 'Full Join', description: 'All records from both forms' }
];

export function EnhancedTableConfig({ config, forms, onConfigChange }: EnhancedTableConfigProps) {
  const [primaryFormFields, setPrimaryFormFields] = useState<FormField[]>([]);
  const [joinFormFields, setJoinFormFields] = useState<Record<string, FormField[]>>({});
  const [joinConfig, setJoinConfig] = useState<JoinConfiguration>(
    config.joinConfig || { enabled: false, joins: [] }
  );
  const [drilldownConfig, setDrilldownConfig] = useState<DrilldownConfiguration>(
    config.drilldownConfig || { enabled: false, fields: [] }
  );

  // Fetch form fields
  const fetchFormFields = async (formId: string): Promise<FormField[]> => {
    if (!formId) return [];
    
    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
        .neq('field_type', 'signature-pad') // Exclude signature fields
        .order('field_order', { ascending: true });

      if (error) {
        console.error('Error fetching form fields:', error);
        return [];
      }

      return (fields || []).map(field => ({
        id: field.id,
        type: field.field_type as FormField['type'],
        label: field.label,
        placeholder: field.placeholder || '',
        required: field.required || false,
        options: Array.isArray(field.options) ? field.options as Array<{ id: string; value: string; label: string }> : [],
        validation: typeof field.validation === 'object' && field.validation !== null ? field.validation as Record<string, any> : {},
        customConfig: typeof field.custom_config === 'object' && field.custom_config !== null ? field.custom_config as Record<string, any> : {},
        tooltip: field.tooltip || '',
        isVisible: field.is_visible !== false,
        isEnabled: field.is_enabled !== false
      }));
    } catch (error) {
      console.error('Error fetching form fields:', error);
      return [];
    }
  };

  // Load primary form fields
  useEffect(() => {
    if (config.formId) {
      fetchFormFields(config.formId).then(setPrimaryFormFields);
    }
  }, [config.formId]);

  // Load join form fields when secondary forms are selected
  useEffect(() => {
    const loadJoinFields = async () => {
      const fieldsMap: Record<string, FormField[]> = {};
      
      for (const join of joinConfig.joins) {
        if (join.secondaryFormId && !joinFormFields[join.secondaryFormId]) {
          const fields = await fetchFormFields(join.secondaryFormId);
          fieldsMap[join.secondaryFormId] = fields;
        }
      }
      
      if (Object.keys(fieldsMap).length > 0) {
        setJoinFormFields(prev => ({ ...prev, ...fieldsMap }));
      }
    };

    loadJoinFields();
  }, [joinConfig.joins]);

  // Get all available fields (primary + joined)
  const getAllAvailableFields = () => {
    let allFields: (FormField & { sourceForm?: string })[] = [...primaryFormFields];
    
    if (joinConfig.enabled) {
      joinConfig.joins.forEach(join => {
        const secondaryFields = joinFormFields[join.secondaryFormId] || [];
        const formName = join.alias || forms.find(f => f.id === join.secondaryFormId)?.name || 'Joined';
        
        allFields = [
          ...allFields,
          ...secondaryFields.map(field => ({
            ...field,
            id: `${join.secondaryFormId}.${field.id}`,
            label: `[${formName}] ${field.label}`,
            sourceForm: join.secondaryFormId
          }))
        ];
      });
    }
    
    return allFields;
  };

  // Handle join configuration changes
  const updateJoinConfig = (newJoinConfig: JoinConfiguration) => {
    setJoinConfig(newJoinConfig);
    onConfigChange({
      ...config,
      joinConfig: newJoinConfig
    });
  };

  // Handle drilldown configuration changes
  const updateDrilldownConfig = (newDrilldownConfig: DrilldownConfiguration) => {
    setDrilldownConfig(newDrilldownConfig);
    onConfigChange({
      ...config,
      drilldownConfig: newDrilldownConfig
    });
  };

  // Add new join
  const addJoin = () => {
    const newJoin = {
      id: Math.random().toString(36).substr(2, 9),
      secondaryFormId: '',
      joinType: 'left' as const,
      primaryFieldId: '',
      secondaryFieldId: '',
      alias: ''
    };

    updateJoinConfig({
      ...joinConfig,
      joins: [...joinConfig.joins, newJoin]
    });
  };

  // Remove join
  const removeJoin = (joinId: string) => {
    updateJoinConfig({
      ...joinConfig,
      joins: joinConfig.joins.filter(j => j.id !== joinId)
    });
  };

  // Update specific join
  const updateJoin = (joinId: string, updates: Partial<typeof joinConfig.joins[0]>) => {
    updateJoinConfig({
      ...joinConfig,
      joins: joinConfig.joins.map(j => j.id === joinId ? { ...j, ...updates } : j)
    });
  };

  // Column selection handlers
  const allFields = getAllAvailableFields();
  const selectedColumns = config.selectedColumns || [];
  const allSelected = allFields.length > 0 && selectedColumns.length === allFields.length;
  const someSelected = selectedColumns.length > 0 && selectedColumns.length < allFields.length;

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all
      onConfigChange({ ...config, selectedColumns: [] });
    } else {
      // Select all
      onConfigChange({ ...config, selectedColumns: allFields.map(f => f.id) });
    }
  };

  const handleColumnToggle = (fieldId: string, checked: boolean) => {
    const newColumns = checked
      ? [...selectedColumns, fieldId]
      : selectedColumns.filter((col: string) => col !== fieldId);
    onConfigChange({ ...config, selectedColumns: newColumns });
  };

  // Drilldown field toggle
  const handleDrilldownFieldToggle = (fieldId: string, checked: boolean) => {
    const newFields = checked
      ? [...(drilldownConfig.fields || []), fieldId]
      : (drilldownConfig.fields || []).filter(f => f !== fieldId);
    updateDrilldownConfig({ ...drilldownConfig, fields: newFields });
  };

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">Basic & Columns</TabsTrigger>
        <TabsTrigger value="joins">Table Joins</TabsTrigger>
        <TabsTrigger value="drilldown">Drilldown</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Table Title</Label>
          <Input
            id="title"
            value={config.title || ''}
            onChange={(e) => onConfigChange({ ...config, title: e.target.value })}
            placeholder="Enter table title"
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4">

          <div className="flex items-center space-x-2">
            <Switch
              checked={config.enableSorting !== false}
              onCheckedChange={(checked) => onConfigChange({ ...config, enableSorting: checked })}
            />
            <Label>Enable Sorting</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={config.enableSearch !== false}
              onCheckedChange={(checked) => onConfigChange({ ...config, enableSearch: checked })}
            />
            <Label>Enable Search</Label>
          </div>
        </div>

        {/* Column Selection */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Column Selection</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-8"
              >
                {allSelected ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select All
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedColumns.length} of {allFields.length} columns selected
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="grid grid-cols-2 gap-2">
                {allFields.map(field => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`col-${field.id}`}
                      checked={selectedColumns.includes(field.id)}
                      onCheckedChange={(checked) => handleColumnToggle(field.id, checked === true)}
                    />
                    <Label htmlFor={`col-${field.id}`} className="text-sm cursor-pointer flex items-center gap-1">
                      {field.label}
                      {field.sourceForm && (
                        <Badge variant="secondary" className="text-xs">Joined</Badge>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
              {allFields.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No fields available. Please select a form first.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="joins" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Table Joins</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Combine data from multiple forms into a single table
                </p>
              </div>
              <Switch
                checked={joinConfig.enabled}
                onCheckedChange={(enabled) => updateJoinConfig({ ...joinConfig, enabled })}
              />
            </div>
          </CardHeader>

          {joinConfig.enabled && (
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={addJoin} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Join
                </Button>
              </div>

              {joinConfig.joins.map((join, index) => (
                <Card key={join.id} className="p-4 border-dashed">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Join #{index + 1}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeJoin(join.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Secondary Form</Label>
                        <Select
                          value={join.secondaryFormId}
                          onValueChange={(value) => updateJoin(join.id, { secondaryFormId: value, secondaryFieldId: '' })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select form to join" />
                          </SelectTrigger>
                          <SelectContent>
                            {forms
                              .filter(form => form.id !== config.formId)
                              .map(form => (
                                <SelectItem key={form.id} value={form.id}>
                                  {form.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Join Type</Label>
                        <Select
                          value={join.joinType}
                          onValueChange={(value: any) => updateJoin(join.id, { joinType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select join type" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOIN_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                <div>
                                  <div className="font-medium">{type.label}</div>
                                  <div className="text-xs text-muted-foreground">{type.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Primary Field (Match On)</Label>
                        <Select
                          value={join.primaryFieldId}
                          onValueChange={(value) => updateJoin(join.id, { primaryFieldId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select primary field" />
                          </SelectTrigger>
                          <SelectContent>
                            {primaryFormFields.map(field => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Secondary Field (Match On)</Label>
                        <Select
                          value={join.secondaryFieldId}
                          onValueChange={(value) => updateJoin(join.id, { secondaryFieldId: value })}
                          disabled={!join.secondaryFormId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select secondary field" />
                          </SelectTrigger>
                          <SelectContent>
                            {(joinFormFields[join.secondaryFormId] || []).map(field => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Column Prefix (Optional)</Label>
                      <Input
                        value={join.alias || ''}
                        onChange={(e) => updateJoin(join.id, { alias: e.target.value })}
                        placeholder="Prefix for joined columns (e.g., 'Order')"
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {joinConfig.joins.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p>No joins configured</p>
                  <p className="text-sm">Click "Add Join" to combine data from another form</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="drilldown" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Drilldown</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on cell values to filter the table by that value
                </p>
              </div>
              <Switch
                checked={drilldownConfig.enabled}
                onCheckedChange={(enabled) => updateDrilldownConfig({ ...drilldownConfig, enabled })}
              />
            </div>
          </CardHeader>

          {drilldownConfig.enabled && (
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">How Drilldown Works:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Select fields below that can be used for drilling down</li>
                  <li>In the table, click on any cell value in those columns</li>
                  <li>The table will filter to show only rows with that value</li>
                  <li>Click "Reset Filters" to clear all drilldown filters</li>
                </ol>
              </div>

              <div>
                <Label className="mb-2 block">Drilldown-Enabled Fields</Label>
                <ScrollArea className="h-48 border rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {allFields.map(field => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`drill-${field.id}`}
                          checked={(drilldownConfig.fields || []).includes(field.id)}
                          onCheckedChange={(checked) => handleDrilldownFieldToggle(field.id, checked === true)}
                        />
                        <Label htmlFor={`drill-${field.id}`} className="text-sm cursor-pointer">
                          {field.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {allFields.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No fields available. Please select a form first.
                    </div>
                  )}
                </ScrollArea>
              </div>

              {(drilldownConfig.fields || []).length > 0 && (
                <div className="bg-primary/10 p-3 rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    {drilldownConfig.fields.length} field(s) enabled for drilldown:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {drilldownConfig.fields.map(fieldId => {
                      const field = allFields.find(f => f.id === fieldId);
                      return (
                        <Badge key={fieldId} variant="secondary">
                          {field?.label || fieldId}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  );
}
