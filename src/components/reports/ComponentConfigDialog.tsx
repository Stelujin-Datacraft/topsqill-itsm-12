import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReports } from '@/hooks/useReports';
import { GenericFieldSelector } from './GenericFieldSelector';
import { FormJoinConfig } from './FormJoinConfig';
import { getFieldDisplayName, UNSUPPORTED_TABLE_FIELDS, UNSUPPORTED_FILTER_FIELDS } from '@/utils/chartConfig';
import { FilterConfig } from './FilterConfig';
import { DrilldownConfig } from './DrilldownConfig';
import { 
  BarChart, 
  LineChart, 
  PieChart, 
  Table, 
  TrendingUp,
  Settings,
  Database,
  Link,
  Loader2
} from 'lucide-react';
import { ChartConfigurationTabs } from './ChartConfigurationTabs';
import { ChartPreview } from './ChartPreview';
import { ChartDataSection } from './ChartDataSection';
import { CrossReferenceDataSection } from './CrossReferenceDataSection';
import { DraggableFieldSelector } from './DraggableFieldSelector';
import {
  PieDonutDataSection,
  LineAreaDataSection,
  ScatterDataSection,
  BubbleDataSection,
  HeatmapDataSection
} from './chart-data-sections';
import { MetricsSelector } from './MetricsSelector';
import { DimensionsSelector } from './DimensionsSelector';
import { FormField } from '@/types/form';
import { supabase } from '@/integrations/supabase/client';

interface ComponentConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentType: string;
  initialConfig?: any;
  onSave: (config: any) => void;
}

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart, description: 'Compare values across categories' },
  { value: 'heatmap', label: 'Heatmap', icon: Table, description: 'Show intensity across dimensions' },
  { value: 'line', label: 'Line Chart', icon: LineChart, description: 'Show trends over time' },
  { value: 'area', label: 'Area Chart', icon: TrendingUp, description: 'Filled line chart' },
  { value: 'pie', label: 'Pie Chart', icon: PieChart, description: 'Show parts of a whole' },
  { value: 'donut', label: 'Donut Chart', icon: PieChart, description: 'Pie chart with hollow center' },
  { value: 'scatter', label: 'Scatter Plot', icon: TrendingUp, description: 'Show correlation between variables' },
  { value: 'bubble', label: 'Bubble Chart', icon: TrendingUp, description: 'Scatter plot with size dimension' },
];

const AGGREGATION_FUNCTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'median', label: 'Median' },
  { value: 'stddev', label: 'Standard Deviation' }
];

const JOIN_TYPES = [
  { value: 'inner', label: 'Inner Join', description: 'Only matching records' },
  { value: 'left', label: 'Left Join', description: 'All from first form' },
  { value: 'right', label: 'Right Join', description: 'All from second form' },
  { value: 'full', label: 'Full Join', description: 'All records from both forms' }
];

export function ComponentConfigDialog({
  open,
  onOpenChange,
  componentType,
  initialConfig,
  onSave
}: ComponentConfigDialogProps) {
  const [config, setConfig] = useState<any>({});
  const [joinEnabled, setJoinEnabled] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [secondaryFormFields, setSecondaryFormFields] = useState<FormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingSecondaryFields, setLoadingSecondaryFields] = useState(false);
  const [useSampleData, setUseSampleData] = useState(false);
  const { forms } = useReports();

  // Fetch form fields from backend
  const fetchFormFields = async (formId: string) => {
    if (!formId) return [];
    
    try {
      setLoadingFields(true);
      console.log('Fetching fields for form:', formId);
      
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('field_order', { ascending: true });

      if (error) {
        console.error('Error fetching form fields:', error);
        return [];
      }

      console.log('Fetched form fields:', fields);
      
      // Helper to parse options from various formats (JSON string, array, or null)
      const parseOptions = (options: any): Array<{ id: string; value: string; label: string }> => {
        if (!options) return [];
        if (Array.isArray(options)) return options;
        if (typeof options === 'string') {
          try {
            const parsed = JSON.parse(options);
            if (Array.isArray(parsed)) return parsed;
          } catch (e) {
            // Not valid JSON
          }
        }
        return [];
      };

      // Helper to parse custom_config from various formats (JSON string, object, or null)
      const parseCustomConfig = (config: any): Record<string, any> => {
        if (!config) return {};
        if (typeof config === 'object' && config !== null) return config;
        if (typeof config === 'string') {
          try {
            const parsed = JSON.parse(config);
            if (typeof parsed === 'object' && parsed !== null) return parsed;
          } catch (e) {
            // Not valid JSON
          }
        }
        return {};
      };

      // Transform fields to match FormField interface with proper type casting
      const transformedFields: FormField[] = (fields || []).map(field => {
        const customConfig = parseCustomConfig(field.custom_config);
        return {
          id: field.id,
          type: field.field_type as FormField['type'],
          label: field.label,
          placeholder: field.placeholder || '',
          required: field.required || false,
          options: parseOptions(field.options),
          validation: typeof field.validation === 'object' && field.validation !== null ? field.validation as Record<string, any> : {},
          customConfig,
          tooltip: field.tooltip || '',
          isVisible: field.is_visible !== false,
          isEnabled: field.is_enabled !== false
        };
      });

      setFormFields(transformedFields);
      return transformedFields;
    } catch (error) {
      console.error('Error fetching form fields:', error);
      return [];
    } finally {
      setLoadingFields(false);
    }
  };

  // Fetch secondary form fields for joins - prefix field IDs with form name for proper data lookup
  const fetchSecondaryFormFields = async (formId: string) => {
    if (!formId) return [];
    
    try {
      setLoadingSecondaryFields(true);
      console.log('Fetching secondary form fields for:', formId);
      
      // First get the form name
      const form = forms.find(f => f.id === formId);
      const formName = form?.name || 'Secondary Form';
      const prefix = `[${formName}].`;
      
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('field_order', { ascending: true });

      if (error) {
        console.error('Error fetching secondary form fields:', error);
        return [];
      }

      console.log('Fetched secondary form fields:', fields);
      
      // Helper to parse options from various formats (JSON string, array, or null)
      const parseOptions = (options: any): Array<{ id: string; value: string; label: string }> => {
        if (!options) return [];
        if (Array.isArray(options)) return options;
        if (typeof options === 'string') {
          try {
            const parsed = JSON.parse(options);
            if (Array.isArray(parsed)) return parsed;
          } catch (e) {
            // Not valid JSON
          }
        }
        return [];
      };

      // Transform fields to match FormField interface with proper type casting
      // IMPORTANT: Prefix field IDs with form name to match merged submission data structure
      const transformedFields: FormField[] = (fields || []).map(field => ({
        id: `${prefix}${field.id}`,  // Prefix field ID to match joined data structure
        type: field.field_type as FormField['type'],
        label: `${formName}: ${field.label}`,  // Prefix label for clarity
        placeholder: field.placeholder || '',
        required: field.required || false,
        options: parseOptions(field.options),
        validation: typeof field.validation === 'object' && field.validation !== null ? field.validation as Record<string, any> : {},
        customConfig: typeof field.custom_config === 'object' && field.custom_config !== null ? field.custom_config as Record<string, any> : {},
        tooltip: field.tooltip || '',
        isVisible: field.is_visible !== false,
        isEnabled: field.is_enabled !== false
      }));

      setSecondaryFormFields(transformedFields);
      return transformedFields;
    } catch (error) {
      console.error('Error fetching secondary form fields:', error);
      return [];
    } finally {
      setLoadingSecondaryFields(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (initialConfig) {
        // Normalize join config for tables so join toggle stays enabled
        const normalizedConfig = {
          ...initialConfig,
          ...(initialConfig.joinConfig
            ? {
                joinConfig: {
                  enabled: initialConfig.joinConfig.enabled ?? true,
                  ...initialConfig.joinConfig,
                },
              }
            : {}),
        };

        setConfig(normalizedConfig);
        setJoinEnabled(
          !!normalizedConfig.joinConfig && normalizedConfig.joinConfig.enabled !== false
        );
        
        // Fetch fields for initially selected form
        if (normalizedConfig.formId) {
          fetchFormFields(normalizedConfig.formId);
        }
        
        // Fetch fields for initially selected secondary form
        if (normalizedConfig.joinConfig?.secondaryFormId) {
          fetchSecondaryFormFields(normalizedConfig.joinConfig.secondaryFormId);
        }
      } else {
        // Set default config based on component type
        const defaultConfigs = {
          'chart': {
            title: 'New Chart',
            chartType: 'bar',
            formId: '',
            metrics: [],
            dimensions: [],
            showLegend: true,
            enableDrilldown: false,
            colorTheme: 'default',
            aggregation: 'count',
            filters: [],
            drilldownConfig: {
              enabled: false,
              levels: []
            },
            joinConfig: {
              enabled: false,
              secondaryFormId: '',
              joinType: 'inner',
              primaryFieldId: '',
              secondaryFieldId: ''
            }
          },
          'table': {
            title: 'New Table',
            formId: '',
            selectedColumns: [],
            showMetadata: false,
            tableTheme: 'default',
            enableFiltering: false,
            enableSorting: false,
            enableSearch: false,
            enableExport: false,
            filters: []
          },
          'form-submissions': {
            title: 'Form Submissions',
            formId: '',
            selectedColumns: [],
            showApprovalStatus: true,
            pageSize: 50,
            filters: []
          },
          'metric-card': {
            title: 'New Metric',
            formId: '',
            field: '',
            aggregation: 'count',
            filters: []
          },
          'text': {
            content: 'Your text content here...',
            fontSize: 'medium',
            fontWeight: 'normal',
            textAlign: 'left'
          }
        };
        setConfig(defaultConfigs[componentType as keyof typeof defaultConfigs] || {});
        setJoinEnabled(false);
        setFormFields([]);
        setSecondaryFormFields([]);
      }
    }
  }, [open, componentType, initialConfig]);

  // Handle form selection change
  const handleFormChange = async (formId: string) => {
    setConfig(prev => ({ 
      ...prev, 
      formId,
      metrics: [],
      dimensions: [],
      selectedColumns: [],
      field: ''
    }));
    
    if (formId) {
      await fetchFormFields(formId);
    } else {
      setFormFields([]);
    }
  };

  // Handle secondary form selection change for joins
  const handleSecondaryFormChange = async (formId: string) => {
    setConfig(prev => ({ 
      ...prev, 
      joinConfig: { 
        ...prev.joinConfig, 
        secondaryFormId: formId,
        primaryFieldId: '',
        secondaryFieldId: ''
      }
    }));
    
    if (formId) {
      await fetchSecondaryFormFields(formId);
    } else {
      setSecondaryFormFields([]);
    }
  };

  const handleSave = () => {
    const finalConfig = {
      ...config,
      joinConfig: joinEnabled ? config.joinConfig : undefined
    };

    onSave({
      config: finalConfig,
      layout: {
        x: 0,
        y: 0,
        w: componentType === 'text' ? 6 : componentType === 'metric-card' ? 3 : 6,
        h: componentType === 'text' ? 2 : componentType === 'metric-card' ? 3 : 4
      }
    });
  };

  const renderChartTypeSelector = () => (
    <div className="grid grid-cols-2 gap-3">
      {CHART_TYPES.map((chartType) => {
        const Icon = chartType.icon;
        return (
          <div
            key={chartType.value}
            className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
              config.chartType === chartType.value ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => setConfig({ ...config, chartType: chartType.value })}
          >
            <div className="flex items-center space-x-2">
              <Icon className="h-4 w-4" />
              <div>
                <div className="font-medium text-sm">{chartType.label}</div>
                <div className="text-xs text-muted-foreground">{chartType.description}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderFormSelection = () => (
    <div className="space-y-2">
      <Label>Data Source (Form)</Label>
      <Select 
        value={config.formId || ''} 
        onValueChange={handleFormChange}
      >
        <SelectTrigger className="bg-background">
          <SelectValue placeholder="Select a form" />
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {forms.map(form => (
            <SelectItem key={form.id} value={form.id}>
              <div className="flex items-center justify-between w-full">
                <span>{form.name}</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {config.formId === form.id ? formFields.length : (form.fields?.length || 0)} fields
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loadingFields && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading form fields...
        </div>
      )}
    </div>
  );

  const renderChartConfig = () => {
    return (
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
          <TabsTrigger value="drilldown">Drilldown</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div>
            <Label htmlFor="title">{componentType === 'table' ? 'Table Title' : 'Chart Title'}</Label>
            <Input
              id="title"
              value={config.title || ''}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder={componentType === 'table' ? 'Enter table title' : 'Enter chart title'}
            />
          </div>

          {componentType === 'chart' && (
            <div>
              <Label>Chart Type</Label>
              {renderChartTypeSelector()}
            </div>
          )}

          {renderFormSelection()}

          {/* Display Fields for Chart - shown when clicking on chart bars */}
          {componentType === 'chart' && config.formId && (
            formFields.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Fields to Display on Click</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allFields = joinEnabled ? [...formFields, ...secondaryFormFields] : formFields;
                        const allFieldIds = allFields.map(f => f.id);
                        const currentDisplayFields = config.displayFields || [];
                        const allSelected = allFieldIds.length > 0 && currentDisplayFields.length === allFieldIds.length;
                        setConfig({ ...config, displayFields: allSelected ? [] : allFieldIds });
                      }}
                      className="h-8"
                    >
                      {(config.displayFields?.length === (joinEnabled ? [...formFields, ...secondaryFormFields] : formFields).length) ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {config.displayFields?.length || 0} fields selected. Drag to reorder display sequence.
                  </p>
                </CardHeader>
                <CardContent>
                  <DraggableFieldSelector
                    availableFields={(joinEnabled ? [...formFields, ...secondaryFormFields] : formFields).map(f => ({ 
                      id: f.id, 
                      label: f.label,
                      type: (f as any).field_type || (f as any).type 
                    }))}
                    selectedFieldIds={config.displayFields || []}
                    onFieldToggle={(fieldId, checked) => {
                      const currentFields = config.displayFields || [];
                      const newFields = checked
                        ? [...currentFields, fieldId]
                        : currentFields.filter(id => id !== fieldId);
                      setConfig({ ...config, displayFields: newFields });
                    }}
                    onReorder={(newOrder) => setConfig({ ...config, displayFields: newOrder })}
                    showFieldType={true}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="p-4 text-center text-muted-foreground border rounded-md">
                {loadingFields ? 'Loading form fields...' : 'No fields available'}
              </div>
            )
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          {/* Cross-Reference Data Section - shown for all chart types when form has cross-reference fields */}
          <CrossReferenceDataSection
            config={config}
            formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
            onConfigChange={(updates) => setConfig({ ...config, ...updates })}
          />

          {/* Only show chart-specific data options when cross-reference mode is NOT enabled */}
          {!config.crossRefConfig?.enabled && (
            <>
              {/* Bar and Column charts use the original flexible data section */}
              {(config.chartType === 'bar' || config.chartType === 'column') && (
                <ChartDataSection
                  config={config}
                  formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
                  onConfigChange={(updates) => setConfig({ ...config, ...updates })}
                />
              )}

              {/* Pie and Donut charts */}
              {(config.chartType === 'pie' || config.chartType === 'donut') && (
                <PieDonutDataSection
                  config={config}
                  formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
                  onConfigChange={(updates) => setConfig({ ...config, ...updates })}
                  chartType={config.chartType}
                />
              )}

              {/* Line and Area charts */}
              {(config.chartType === 'line' || config.chartType === 'area') && (
                <LineAreaDataSection
                  config={config}
                  formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
                  onConfigChange={(updates) => setConfig({ ...config, ...updates })}
                  chartType={config.chartType}
                />
              )}

              {/* Scatter chart */}
              {config.chartType === 'scatter' && (
                <ScatterDataSection
                  config={config}
                  formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
                  onConfigChange={(updates) => setConfig({ ...config, ...updates })}
                />
              )}

              {/* Bubble chart */}
              {config.chartType === 'bubble' && (
                <BubbleDataSection
                  config={config}
                  formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
                  onConfigChange={(updates) => setConfig({ ...config, ...updates })}
                />
              )}

              {/* Heatmap chart */}
              {config.chartType === 'heatmap' && (
                <HeatmapDataSection
                  config={config}
                  formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
                  onConfigChange={(updates) => setConfig({ ...config, ...updates })}
                />
              )}

              {/* Table type */}
              {config.chartType === 'table' && (
                config.formId && formFields.length > 0 ? (
                  <GenericFieldSelector
                    formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
                    selectedFields={config.selectedColumns || []}
                    onFieldsChange={(fields) => setConfig({ ...config, selectedColumns: fields })}
                    label="Table Columns"
                    description="Select columns to display in the table (from joined forms)"
                    selectionType="checkbox"
                    maxHeight="300px"
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {config.formId ? 
                      (loadingFields ? 'Loading form fields...' : 'The selected form has no fields configured yet.') :
                      'Please select a form to configure data fields.'
                    }
                  </div>
                )
              )}
            </>
          )}
        </TabsContent>


        <TabsContent value="joins" className="space-y-4">
          {config.formId && formFields.length > 0 ? (
            <FormJoinConfig
              enabled={joinEnabled}
              onEnabledChange={(enabled) => {
                setJoinEnabled(enabled);
                if (!enabled) {
                  // Clear join config when disabled
                  setConfig(prev => ({ ...prev, joinConfig: undefined }));
                  setSecondaryFormFields([]);
                }
              }}
              primaryForm={{
                id: config.formId,
                name: forms.find(f => f.id === config.formId)?.name || 'Selected Form',
                fields: formFields
              }}
              availableForms={forms.map(form => ({
                id: form.id,
                name: form.name,
                fields: form.id === config.joinConfig?.secondaryFormId ? secondaryFormFields : (form.fields || [])
              }))}
              joinConfig={config.joinConfig || {
                secondaryFormId: '',
                joinType: 'inner',
                primaryFieldId: '',
                secondaryFieldId: ''
              }}
              onJoinConfigChange={(joinConfig) => {
                setConfig({ ...config, joinConfig });
                // Fetch secondary form fields when secondary form is selected
                if (joinConfig.secondaryFormId && joinConfig.secondaryFormId !== config.joinConfig?.secondaryFormId) {
                  handleSecondaryFormChange(joinConfig.secondaryFormId);
                }
              }}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Please select a form first to configure joins.
            </div>
          )}
        </TabsContent>

        <TabsContent value="filters" className="space-y-4">
          {config.formId && formFields.length > 0 ? (
            <FilterConfig
              formFields={(joinEnabled ? [...formFields, ...secondaryFormFields] : formFields).filter(
                field => !UNSUPPORTED_FILTER_FIELDS.includes((field as any).field_type || field.type || '')
              )}
              filters={config.filters || []}
              onFiltersChange={(filters) => setConfig(prev => ({ ...prev, filters }))}
              logicExpression={config.filterLogicExpression || ''}
              onLogicExpressionChange={(expr) => setConfig(prev => ({ ...prev, filterLogicExpression: expr }))}
              useManualLogic={config.useManualFilterLogic || false}
              onUseManualLogicChange={(useManual) => setConfig(prev => ({ ...prev, useManualFilterLogic: useManual }))}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Please select a form first to configure filters.
            </div>
          )}
        </TabsContent>

        <TabsContent value="drilldown" className="space-y-4">
          {/* When cross-reference is enabled, disable outer drilldown and show message */}
          {config.crossRefConfig?.enabled ? (
            <div className="p-4 text-center border border-dashed rounded-lg bg-muted/50">
              <div className="text-muted-foreground mb-2">
                Cross-Reference mode is enabled.
              </div>
              <div className="text-sm text-muted-foreground">
                Please configure drilldown in the <span className="font-medium">Data → Cross-Reference</span> section instead.
              </div>
            </div>
          ) : config.formId && formFields.length > 0 ? (
            <DrilldownConfig
              formFields={joinEnabled ? [...formFields, ...secondaryFormFields] : formFields}
              enabled={config.drilldownConfig?.enabled || false}
              onEnabledChange={(enabled) => setConfig({ 
                ...config, 
                drilldownConfig: { 
                  ...config.drilldownConfig, 
                  enabled 
                } 
              })}
              drilldownLevels={config.drilldownConfig?.drilldownLevels || []}
              onDrilldownLevelsChange={(drilldownLevels) => setConfig({ 
                ...config, 
                drilldownConfig: { 
                  ...config.drilldownConfig, 
                  drilldownLevels
                } 
              })}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Please select a form first to configure drilldown.
            </div>
          )}
        </TabsContent>

        <TabsContent value="style" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Display Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="showLegend"
                  checked={config.showLegend !== false}
                  onCheckedChange={(checked) => setConfig({ ...config, showLegend: checked })}
                />
                <Label htmlFor="showLegend">Show legend</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enableDrilldown"
                  checked={config.enableDrilldown || false}
                  onCheckedChange={(checked) => setConfig({ ...config, enableDrilldown: checked })}
                />
                <Label htmlFor="enableDrilldown">Enable drilldown (click to view records)</Label>
              </div>

              <div>
                <Label>Color Theme</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { 
                      value: 'default', 
                      label: 'Default', 
                      colors: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'] 
                    },
                    { 
                      value: 'vibrant', 
                      label: 'Vibrant', 
                      colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'] 
                    },
                    { 
                      value: 'pastel', 
                      label: 'Pastel', 
                      colors: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA'] 
                    },
                    { 
                      value: 'monochrome', 
                      label: 'Monochrome', 
                      colors: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6'] 
                    },
                    { 
                      value: 'ocean', 
                      label: 'Ocean', 
                      colors: ['#006A6B', '#1B9AAA', '#40C9A2', '#9FFFCB'] 
                    },
                    { 
                      value: 'sunset', 
                      label: 'Sunset', 
                      colors: ['#FF6B35', '#F7931E', '#FFD23F', '#F06292'] 
                    },
                    { 
                      value: 'nature', 
                      label: 'Nature', 
                      colors: ['#8BC34A', '#4CAF50', '#009688', '#607D8B'] 
                    },
                    { 
                      value: 'business', 
                      label: 'Business', 
                      colors: ['#1976D2', '#1565C0', '#0D47A1', '#42A5F5'] 
                    }
                  ].map((theme) => (
                    <div
                      key={theme.value}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                        config.colorTheme === theme.value ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                      onClick={() => setConfig({ ...config, colorTheme: theme.value })}
                    >
                      <div className="space-y-2">
                        <div className="font-medium text-sm">{theme.label}</div>
                        <div className="flex gap-1">
                          {theme.colors.map((color, index) => (
                            <div
                              key={index}
                              className="w-4 h-4 rounded-full border border-border/50"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart-specific configurations */}
              {config.chartType === 'donut' && (
                <div>
                  <Label>Inner Radius</Label>
                  <Input
                    type="number"
                    value={config.innerRadius || 40}
                    onChange={(e) => setConfig({ ...config, innerRadius: parseInt(e.target.value) })}
                    min={20}
                    max={80}
                    placeholder="Inner radius (20-80)"
                  />
                </div>
              )}

              {config.chartType === 'bubble' && formFields.length > 0 && (
                <div>
                  <Label>Size Field</Label>
                  <Select 
                    value={config.sizeField || ''} 
                    onValueChange={(value) => setConfig({ ...config, sizeField: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select size field" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {formFields
                        .filter(field => ['number', 'currency', 'rating', 'slider'].includes(field.type))
                        .map(field => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.chartType === 'heatmap' && (
                <>
                  {formFields.length > 0 && (
                    <div>
                      <Label>Intensity Field</Label>
                      <Select 
                        value={config.heatmapIntensityField || ''} 
                        onValueChange={(value) => setConfig({ ...config, heatmapIntensityField: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select intensity field" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {formFields
                            .filter(field => ['number', 'currency', 'rating', 'slider'].includes(field.type))
                            .map(field => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Grid Columns</Label>
                    <Input
                      type="number"
                      value={config.gridColumns || 5}
                      onChange={(e) => setConfig({ ...config, gridColumns: parseInt(e.target.value) })}
                      min={3}
                      max={10}
                      placeholder="Number of columns (3-10)"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Chart Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="use-sample-data" className="text-xs text-muted-foreground">Use sample data</Label>
                  <Switch
                    id="use-sample-data"
                    checked={useSampleData}
                    onCheckedChange={setUseSampleData}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {useSampleData ? (
                  <ChartPreview 
                    config={{
                      ...config,
                      data: [
                        { name: 'Sample A', value: 120, revenue: 15000, customers: 45 },
                        { name: 'Sample B', value: 98, revenue: 12500, customers: 32 },
                        { name: 'Sample C', value: 86, revenue: 9800, customers: 28 },
                        { name: 'Sample D', value: 145, revenue: 18200, customers: 56 },
                        { name: 'Sample E', value: 73, revenue: 8900, customers: 21 }
                      ]
                    }}
                  />
                ) : (
                  <ChartPreview 
                    key={`chart-preview-${JSON.stringify(config.metrics)}-${JSON.stringify(config.dimensions)}-${config.formId}-${config.aggregation}-${config.groupByField}-${JSON.stringify(config.filters)}-${JSON.stringify(config.metricAggregations)}-${config.chartType}-${JSON.stringify(config.columns)}`}
                    config={config}
                  />
                )}
              </div>
              {!useSampleData && !config.formId && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Select a data source in the Basic tab to see real data preview
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Configuration Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Chart Type:</span> {config.chartType || 'Not selected'}
                </div>
                <div>
                  <span className="font-medium">Color Theme:</span> {config.colorTheme || 'Default'}
                </div>
                <div>
                  <span className="font-medium">Metrics:</span> {config.metrics?.length || 0} selected
                </div>
                <div>
                  <span className="font-medium">Dimensions:</span> {config.dimensions?.length || 0} selected
                </div>
                <div>
                  <span className="font-medium">Group By:</span> {config.groupByField ? 'Enabled' : 'None'}
                </div>
                <div>
                  <span className="font-medium">Aggregation:</span> {config.aggregationEnabled !== false ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  const renderTableConfig = () => {
    // Filter out unsupported field types from table columns
    const getFieldType = (field: any): string => field.field_type || field.type || '';
    const filterSupportedFields = (fields: any[]) => 
      fields.filter(f => !UNSUPPORTED_TABLE_FIELDS.includes(getFieldType(f)));
    
    const allFields = joinEnabled 
      ? filterSupportedFields([...formFields, ...secondaryFormFields]) 
      : filterSupportedFields(formFields);
    const selectedColumns = config.selectedColumns || [];
    const allSelected = allFields.length > 0 && selectedColumns.length === allFields.length;

    const handleSelectAllColumns = () => {
      if (allSelected) {
        setConfig({ ...config, selectedColumns: [] });
      } else {
        setConfig({ ...config, selectedColumns: allFields.map(f => f.id) });
      }
    };

    const handleColumnToggle = (fieldId: string, checked: boolean) => {
      const newColumns = checked
        ? [...selectedColumns, fieldId]
        : selectedColumns.filter((col: string) => col !== fieldId);
      setConfig({ ...config, selectedColumns: newColumns });
    };

    const handleColumnReorder = (newOrder: string[]) => {
      setConfig({ ...config, selectedColumns: newOrder });
    };

    const handleDrilldownFieldToggle = (fieldId: string, checked: boolean) => {
      const currentFields = config.drilldownConfig?.fields || [];
      const newFields = checked
        ? [...currentFields, fieldId]
        : currentFields.filter((f: string) => f !== fieldId);
      setConfig({ 
        ...config, 
        drilldownConfig: { 
          ...config.drilldownConfig, 
          fields: newFields 
        } 
      });
    };

    return (
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic & Columns</TabsTrigger>
          <TabsTrigger value="joins">Joins</TabsTrigger>
          <TabsTrigger value="drilldown">Drilldown</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div>
            <Label htmlFor="title">Table Title</Label>
            <Input
              id="title"
              value={config.title || ''}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder="Enter table title"
            />
          </div>

          {renderFormSelection()}

          <div className="grid grid-cols-2 gap-4">

            <div className="flex items-center space-x-2">
              <Switch
                id="enableSorting"
                checked={config.enableSorting !== false}
                onCheckedChange={(checked) => setConfig({ ...config, enableSorting: checked })}
              />
              <Label htmlFor="enableSorting">Enable sorting</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enableSearch"
                checked={config.enableSearch !== false}
                onCheckedChange={(checked) => setConfig({ ...config, enableSearch: checked })}
              />
              <Label htmlFor="enableSearch">Enable search</Label>
            </div>
          </div>

          {/* Column Selection */}
          {config.formId && allFields.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Column Selection & Order</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllColumns}
                    className="h-8"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedColumns.length} of {allFields.length} columns selected. Drag to reorder.
                </p>
              </CardHeader>
              <CardContent>
                <DraggableFieldSelector
                  availableFields={allFields.map(f => ({ 
                    id: f.id, 
                    label: f.label,
                    type: (f as any).field_type || (f as any).type 
                  }))}
                  selectedFieldIds={selectedColumns}
                  onFieldToggle={handleColumnToggle}
                  onReorder={handleColumnReorder}
                  showFieldType={true}
                />
              </CardContent>
            </Card>
          )}

          {config.formId && allFields.length === 0 && !loadingFields && (
            <div className="p-4 text-center text-muted-foreground">
              The selected form has no fields configured yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="joins" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Table Joins</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Combine data from multiple forms into a single table
                  </p>
                </div>
                <Switch
                  checked={joinEnabled}
                  onCheckedChange={(enabled) => {
                    setJoinEnabled(enabled);
                    setConfig({
                      ...config,
                      joinConfig: {
                        ...config.joinConfig,
                        enabled,
                        secondaryFormId: enabled ? config.joinConfig?.secondaryFormId || '' : '',
                        joinType: config.joinConfig?.joinType || 'left',
                        primaryFieldId: config.joinConfig?.primaryFieldId || '',
                        secondaryFieldId: config.joinConfig?.secondaryFieldId || ''
                      }
                    });
                  }}
                />
              </div>
            </CardHeader>

            {joinEnabled && (
              <CardContent className="space-y-4">
                <FormJoinConfig
                  enabled={joinEnabled}
                  primaryForm={{
                    id: config.formId || '',
                    name: forms.find(f => f.id === config.formId)?.name || '',
                    fields: formFields
                  }}
                  availableForms={forms.filter(f => f.id !== config.formId).map(f => ({
                    id: f.id,
                    name: f.name,
                    fields: f.id === config.joinConfig?.secondaryFormId ? secondaryFormFields : []
                  }))}
                  joinConfig={config.joinConfig || {
                    secondaryFormId: '',
                    joinType: 'left',
                    primaryFieldId: '',
                    secondaryFieldId: ''
                  }}
                  onJoinConfigChange={(joinConfig) => {
                    setConfig({ ...config, joinConfig: { ...joinConfig, enabled: true } });
                    if (joinConfig.secondaryFormId) {
                      fetchSecondaryFormFields(joinConfig.secondaryFormId);
                    }
                  }}
                  onEnabledChange={(enabled) => {
                    setJoinEnabled(enabled);
                    setConfig({
                      ...config,
                      joinConfig: { ...config.joinConfig, enabled }
                    });
                  }}
                />
              </CardContent>
            )}

            {!joinEnabled && (
              <CardContent>
                <div className="p-4 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                  <p>Enable joins to combine data from multiple forms</p>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="drilldown" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Drilldown</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click on cell values to filter the table
                  </p>
                </div>
                <Switch
                  checked={config.drilldownConfig?.enabled || false}
                  onCheckedChange={(enabled) => setConfig({ 
                    ...config, 
                    drilldownConfig: { 
                      ...config.drilldownConfig, 
                      enabled 
                    } 
                  })}
                />
              </div>
            </CardHeader>

            {config.drilldownConfig?.enabled && config.formId && allFields.length > 0 && (
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Select which fields can be clicked to filter. When you click a cell value in the table, 
                    it will filter to show only rows with that value.
                  </p>
                </div>

                <div className="max-h-48 overflow-y-auto border rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {allFields.map(field => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`drill-${field.id}`}
                          checked={(config.drilldownConfig?.fields || []).includes(field.id)}
                          onChange={(e) => handleDrilldownFieldToggle(field.id, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`drill-${field.id}`} className="text-sm cursor-pointer">
                          {field.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {(config.drilldownConfig?.fields || []).length > 0 && (
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <p className="text-sm font-medium">
                      {config.drilldownConfig.fields.length} field(s) enabled for drilldown
                    </p>
                  </div>
                )}
              </CardContent>
            )}

            {config.drilldownConfig?.enabled && (!config.formId || allFields.length === 0) && (
              <CardContent>
                <div className="p-4 text-center text-muted-foreground">
                  Please select a form first to configure drilldown.
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="filters" className="space-y-4">
          {config.formId && formFields.length > 0 ? (
            <FilterConfig
              formFields={(joinEnabled ? [...formFields, ...secondaryFormFields] : formFields).filter(
                field => !UNSUPPORTED_FILTER_FIELDS.includes((field as any).field_type || field.type || '')
              )}
              filters={config.filters || []}
              onFiltersChange={(filters) => setConfig(prev => ({ ...prev, filters }))}
              logicExpression={config.filterLogicExpression || ''}
              onLogicExpressionChange={(expr) => setConfig(prev => ({ ...prev, filterLogicExpression: expr }))}
              useManualLogic={config.useManualFilterLogic || false}
              onUseManualLogicChange={(useManual) => setConfig(prev => ({ ...prev, useManualFilterLogic: useManual }))}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Please select a form first to configure filters.
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Table Preview</CardTitle>
              <p className="text-xs text-muted-foreground">
                {selectedColumns.length} column(s) selected
              </p>
            </CardHeader>
            <CardContent>
              {config.formId && selectedColumns.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 p-2 border-b">
                    <div className="flex gap-2 overflow-x-auto">
                      {selectedColumns.slice(0, 6).map((colId: string) => {
                        const field = allFields.find(f => f.id === colId);
                        return (
                          <Badge key={colId} variant="secondary" className="text-xs whitespace-nowrap">
                            {field?.label || colId}
                          </Badge>
                        );
                      })}
                      {selectedColumns.length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{selectedColumns.length - 6} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Preview will be available after saving. Click "Save Component" to see the table with real data.
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  {!config.formId ? (
                    <p>Select a data source in the Basic tab to see preview</p>
                  ) : (
                    <p>Select at least one column to see preview</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Configuration Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Columns:</span> {selectedColumns.length} selected
                </div>
                <div>
                  <span className="font-medium">Filters:</span> {config.filters?.length || 0} active
                </div>
                <div>
                  <span className="font-medium">Sorting:</span> {config.enableSorting !== false ? 'Enabled' : 'Disabled'}
                </div>
                <div>
                  <span className="font-medium">Search:</span> {config.enableSearch !== false ? 'Enabled' : 'Disabled'}
                </div>
                <div>
                  <span className="font-medium">Drilldown:</span> {config.drilldownConfig?.enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  const renderFormSubmissionsConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Table Title</Label>
          <Input
            id="title"
            value={config.title || ''}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            placeholder="Enter table title"
          />
        </div>

        {renderFormSelection()}

        <div className="flex items-center space-x-2">
          <Switch
            id="showApprovalStatus"
            checked={config.showApprovalStatus || false}
            onCheckedChange={(checked) => setConfig({ ...config, showApprovalStatus: checked })}
          />
          <Label htmlFor="showApprovalStatus">Show approval status columns</Label>
        </div>

        <div>
          <Label htmlFor="pageSize">Page Size</Label>
          <Select 
            value={String(config.pageSize || 50)} 
            onValueChange={(value) => setConfig({ ...config, pageSize: parseInt(value) })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
              <SelectItem value="200">200 rows</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {config.formId && formFields.length > 0 && (
          <GenericFieldSelector
            formFields={formFields}
            selectedFields={config.selectedColumns || []}
            onFieldsChange={(fields) => setConfig({ ...config, selectedColumns: fields })}
            label="Columns to Display (Optional)"
            description="Leave empty to show all columns"
            selectionType="checkbox"
            maxHeight="250px"
          />
        )}
      </div>
    );
  };

  const renderMetricConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Metric Title</Label>
          <Input
            id="title"
            value={config.title || ''}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            placeholder="Enter metric title"
          />
        </div>

        {renderFormSelection()}

        {config.formId && formFields.length > 0 && (
          <>
            <GenericFieldSelector
              formFields={formFields}
              selectedFields={config.field ? [config.field] : []}
              onFieldsChange={(fields) => setConfig({ ...config, field: fields[0] || '' })}
              label="Metric Field"
              description="Field to calculate metric from"
              selectionType="dropdown"
              maxSelections={1}
              placeholder="Select field..."
            />

            <div>
              <Label>Aggregation Function</Label>
              <Select 
                value={config.aggregation || 'count'} 
                onValueChange={(value) => setConfig({ ...config, aggregation: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {AGGREGATION_FUNCTIONS.map(agg => (
                    <SelectItem key={agg.value} value={agg.value}>
                      {agg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </>
        )}
      </div>
    );
  };

  const renderTextConfig = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="content">Text Content</Label>
        <Textarea
          id="content"
          value={config.content || ''}
          onChange={(e) => setConfig({ ...config, content: e.target.value })}
          placeholder="Enter your text content..."
          rows={4}
        />
      </div>

      <div>
        <Label>Font Size</Label>
        <Select 
          value={config.fontSize || 'medium'} 
          onValueChange={(value) => setConfig({ ...config, fontSize: value })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
            <SelectItem value="xl">Extra Large</SelectItem>
            <SelectItem value="2xl">2X Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Font Weight</Label>
        <Select 
          value={config.fontWeight || 'normal'} 
          onValueChange={(value) => setConfig({ ...config, fontWeight: value })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="semibold">Semi Bold</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Text Alignment</Label>
        <Select 
          value={config.textAlign || 'left'} 
          onValueChange={(value) => setConfig({ ...config, textAlign: value })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="color">Text Color</Label>
        <Input
          id="color"
          type="color"
          value={config.color || '#000000'}
          onChange={(e) => setConfig({ ...config, color: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="backgroundColor">Background Color</Label>
        <Input
          id="backgroundColor"
          type="color"
          value={config.backgroundColor || '#ffffff'}
          onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
        />
      </div>
    </div>
  );

  const renderConfig = () => {
    switch (componentType) {
      case 'chart':
        return renderChartConfig();
      case 'table':
        return renderTableConfig();
      case 'form-submissions':
        return renderFormSubmissionsConfig();
      case 'metric-card':
        return renderMetricConfig();
      case 'text':
        return renderTextConfig();
      default:
        return <div>Unknown component type</div>;
    }
  };

  const getDialogTitle = () => {
    const titles = {
      'chart': 'Chart Configuration',
      'table': 'Table Configuration', 
      'form-submissions': 'Form Submissions Table Configuration',
      'metric-card': 'Metric Card Configuration',
      'text': 'Text Component Configuration'
    };
    return titles[componentType as keyof typeof titles] || 'Component Configuration';
  };

  const getDialogIcon = () => {
    switch (componentType) {
      case 'chart': return BarChart;
      case 'table': return Table;
      case 'form-submissions': return Database;
      case 'metric-card': return TrendingUp;
      case 'text': return Settings;
      default: return Settings;
    }
  };

  const DialogIcon = getDialogIcon();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DialogIcon className="h-5 w-5" />
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription>
            Configure your {componentType.replace('-', ' ')} component settings.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {renderConfig()}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Component
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
