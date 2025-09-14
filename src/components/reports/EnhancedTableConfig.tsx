import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, ArrowDown, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';

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
  levels: Array<{
    field: string;
    label: string;
    sortOrder?: 'asc' | 'desc';
  }>;
}

interface EnhancedTableConfigProps {
  config: any;
  forms: Array<{ id: string; name: string; fields?: FormField[] }>;
  onConfigChange: (config: any) => void;
}

const JOIN_TYPES = [
  { value: 'inner', label: 'Inner Join', description: 'Only matching records' },
  { value: 'left', label: 'Left Join', description: 'All from first form' },
  { value: 'right', label: 'Right Join', description: 'All from second form' },
  { value: 'full', label: 'Full Join', description: 'All records from both forms' }
];

export function EnhancedTableConfig({ config, forms, onConfigChange }: EnhancedTableConfigProps) {
  const [primaryFormFields, setPrimaryFormFields] = useState<FormField[]>([]);
  const [joinFormFields, setJoinFormFields] = useState<Record<string, FormField[]>>({});
  const [joinConfig, setJoinConfig] = useState<JoinConfiguration>(
    config.joinConfig || { enabled: false, joins: [] }
  );
  const [drilldownConfig, setDrilldownConfig] = useState<DrilldownConfiguration>(
    config.drilldownConfig || { enabled: false, levels: [] }
  );

  // Fetch form fields
  const fetchFormFields = async (formId: string): Promise<FormField[]> => {
    if (!formId) return [];
    
    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
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
    let allFields = [...primaryFormFields];
    
    joinConfig.joins.forEach(join => {
      const secondaryFields = joinFormFields[join.secondaryFormId] || [];
      const formName = forms.find(f => f.id === join.secondaryFormId)?.name || 'Unknown';
      
      allFields = [
        ...allFields,
        ...secondaryFields.map(field => ({
          ...field,
          id: `${join.secondaryFormId}.${field.id}`,
          label: `${formName}.${field.label}`,
          sourceForm: join.secondaryFormId
        } as FormField & { sourceForm: string }))
      ];
    });
    
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
      joinType: 'inner' as const,
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

  // Add drilldown level
  const addDrilldownLevel = () => {
    updateDrilldownConfig({
      ...drilldownConfig,
      levels: [
        ...drilldownConfig.levels,
        { field: '', label: '', sortOrder: 'asc' }
      ]
    });
  };

  // Remove drilldown level
  const removeDrilldownLevel = (index: number) => {
    updateDrilldownConfig({
      ...drilldownConfig,
      levels: drilldownConfig.levels.filter((_, i) => i !== index)
    });
  };

  // Update drilldown level
  const updateDrilldownLevel = (index: number, updates: Partial<typeof drilldownConfig.levels[0]>) => {
    updateDrilldownConfig({
      ...drilldownConfig,
      levels: drilldownConfig.levels.map((level, i) => i === index ? { ...level, ...updates } : level)
    });
  };

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="basic">Basic</TabsTrigger>
        <TabsTrigger value="joins">Table Joins</TabsTrigger>
        <TabsTrigger value="drilldown">Drilldown</TabsTrigger>
        <TabsTrigger value="columns">Columns</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div>
          <Label htmlFor="title">Table Title</Label>
          <Input
            id="title"
            value={config.title || ''}
            onChange={(e) => onConfigChange({ ...config, title: e.target.value })}
            placeholder="Enter table title"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.showMetadata || false}
              onCheckedChange={(checked) => onConfigChange({ ...config, showMetadata: checked })}
            />
            <Label>Show Metadata</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={config.enableFiltering !== false}
              onCheckedChange={(checked) => onConfigChange({ ...config, enableFiltering: checked })}
            />
            <Label>Enable Filtering</Label>
          </div>

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
      </TabsContent>

      <TabsContent value="joins" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Table Join Configuration</CardTitle>
              <Switch
                checked={joinConfig.enabled}
                onCheckedChange={(enabled) => updateJoinConfig({ ...joinConfig, enabled })}
              />
            </div>
          </CardHeader>

          {joinConfig.enabled && (
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Join multiple forms to create comprehensive data views
                </p>
                <Button onClick={addJoin} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Join
                </Button>
              </div>

              {joinConfig.joins.map((join, index) => (
                <Card key={join.id} className="p-4">
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
                          onValueChange={(value) => updateJoin(join.id, { secondaryFormId: value })}
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
                        <Label>Primary Form Field</Label>
                        <Select
                          value={join.primaryFieldId}
                          onValueChange={(value) => updateJoin(join.id, { primaryFieldId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
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
                        <Label>Secondary Form Field</Label>
                        <Select
                          value={join.secondaryFieldId}
                          onValueChange={(value) => updateJoin(join.id, { secondaryFieldId: value })}
                          disabled={!join.secondaryFormId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
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
                      <Label>Table Alias (Optional)</Label>
                      <Input
                        value={join.alias || ''}
                        onChange={(e) => updateJoin(join.id, { alias: e.target.value })}
                        placeholder="Optional alias for this join"
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {joinConfig.joins.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No joins configured yet</p>
                  <p className="text-sm">Click "Add Join" to start joining tables</p>
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
              <CardTitle>Drilldown Configuration</CardTitle>
              <Switch
                checked={drilldownConfig.enabled}
                onCheckedChange={(enabled) => updateDrilldownConfig({ ...drilldownConfig, enabled })}
              />
            </div>
          </CardHeader>

          {drilldownConfig.enabled && (
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Configure hierarchical data exploration like PowerBI
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Users can click on data points to drill down into more detail
                  </p>
                </div>
                <Button onClick={addDrilldownLevel} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Level
                </Button>
              </div>

              {drilldownConfig.levels.map((level, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Level {index + 1}</Badge>
                        {index > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDrilldownLevel(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Field</Label>
                        <Select
                          value={level.field}
                          onValueChange={(value) => updateDrilldownLevel(index, { field: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAllAvailableFields().map(field => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Display Label</Label>
                        <Input
                          value={level.label}
                          onChange={(e) => updateDrilldownLevel(index, { label: e.target.value })}
                          placeholder="Enter display label"
                        />
                      </div>

                      <div>
                        <Label>Sort Order</Label>
                        <Select
                          value={level.sortOrder || 'asc'}
                          onValueChange={(value: 'asc' | 'desc') => updateDrilldownLevel(index, { sortOrder: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {drilldownConfig.levels.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No drilldown levels configured yet</p>
                  <p className="text-sm">Click "Add Level" to start building your drilldown hierarchy</p>
                </div>
              )}

              {drilldownConfig.levels.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Drilldown Path:</h4>
                  <div className="flex items-center gap-2 text-sm">
                    {drilldownConfig.levels.map((level, index) => (
                      <React.Fragment key={index}>
                        <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                          {level.label || level.field || `Level ${index + 1}`}
                        </span>
                        {index < drilldownConfig.levels.length - 1 && (
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="columns" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Column Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select which columns to display in your table. Columns from joined forms will be available after configuring joins.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {getAllAvailableFields().map(field => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={field.id}
                      checked={(config.selectedColumns || []).includes(field.id)}
                      onChange={(e) => {
                        const selectedColumns = config.selectedColumns || [];
                        const newColumns = e.target.checked
                          ? [...selectedColumns, field.id]
                          : selectedColumns.filter((col: string) => col !== field.id);
                        onConfigChange({ ...config, selectedColumns: newColumns });
                      }}
                    />
                    <Label htmlFor={field.id} className="text-sm">
                      {field.label}
                      {(field as any).sourceForm && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Joined
                        </Badge>
                      )}
                    </Label>
                  </div>
                ))}
              </div>

              {getAllAvailableFields().length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No fields available</p>
                  <p className="text-sm">Please select a form first</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}