import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartConfig } from '@/types/reports';
import { FormField } from '@/types/form';
import { ChartTypeSelector } from './ChartTypeSelector';
import { ChartPreview } from './ChartPreview';
import { ChartDataSection } from './ChartDataSection';
import { ChartExamples } from './ChartExamples';
import { Database, Sparkles, Lightbulb } from 'lucide-react';
import { getChartMetricCapabilities } from '@/utils/chartConfig';

interface ChartConfigurationTabsProps {
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  formFields: FormField[];
  forms: Array<{ id: string; name: string; description?: string }>;
}

// Generate realistic sample data based on chart type and selected fields
const generateSampleData = (config: ChartConfig, formFields: FormField[]) => {
  const dimensionField = formFields.find(f => f.id === (config.dimensions?.[0] || config.xAxis));
  const metricField = formFields.find(f => f.id === (config.metrics?.[0] || config.yAxis));
  
  // Base categories - use dimension field options if available, otherwise generic categories
  let categories = ['Category A', 'Category B', 'Category C', 'Category D', 'Category E'];
  
  if (dimensionField?.options && dimensionField.options.length > 0) {
    categories = dimensionField.options.slice(0, 5).map(opt => opt.label || opt.value);
  } else if (dimensionField?.type === 'date') {
    categories = ['Jan 2024', 'Feb 2024', 'Mar 2024', 'Apr 2024', 'May 2024'];
  } else if (dimensionField?.type === 'select') {
    categories = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'];
  }

  // Generate realistic metric values based on field type
  const generateMetricValue = (index: number) => {
    if (metricField?.type === 'currency') {
      return Math.floor(Math.random() * 50000) + 10000; // $10k-$60k
    } else if (metricField?.type === 'rating') {
      return Math.floor(Math.random() * 5) + 1; // 1-5 rating
    } else if (metricField?.type === 'number') {
      return Math.floor(Math.random() * 1000) + 100; // 100-1100
    } else {
      return Math.floor(Math.random() * 200) + 50; // Default range
    }
  };

  return categories.map((name, index) => {
    const baseValue = generateMetricValue(index);
    const secondaryValue = generateMetricValue(index);
    const sizeValue = Math.floor(Math.random() * 100) + 20;
    
    return {
      name,
      [config.metrics?.[0] || config.yAxis || 'value']: baseValue,
      [config.sizeField || 'size']: sizeValue,
      [config.heatmapIntensityField || 'intensity']: baseValue,
      // Add some additional sample fields
      sales: baseValue,
      revenue: baseValue * 100,
      customers: Math.floor(baseValue / 3),
      rating: Math.floor(Math.random() * 5) + 1,
      count: Math.floor(Math.random() * 50) + 10
    };
  });
};

export function ChartConfigurationTabs({ 
  config, 
  onConfigChange, 
  formFields, 
  forms 
}: ChartConfigurationTabsProps) {
  const [useStaticData, setUseStaticData] = useState(true);
  
  const sampleData = useMemo(() => generateSampleData(config, formFields), [config, formFields]);
  
  const handleConfigUpdate = (updates: Partial<ChartConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const renderChartSpecificConfig = () => {
    switch (config.chartType) {
      case 'donut':
        return (
          <div className="space-y-4">
            <div>
              <Label>Inner Radius</Label>
              <Slider
                value={[config.innerRadius || 40]}
                onValueChange={([value]) => handleConfigUpdate({ innerRadius: value })}
                max={80}
                min={20}
                step={5}
                className="mt-2"
              />
              <div className="text-sm text-muted-foreground mt-1">
                Current: {config.innerRadius || 40}px
              </div>
            </div>
          </div>
        );

      case 'bubble':
        return (
          <div className="space-y-4">
            <div>
              <Label>Size Field</Label>
              <Select 
                value={config.sizeField || ''} 
                onValueChange={(value) => handleConfigUpdate({ sizeField: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size field" />
                </SelectTrigger>
                <SelectContent>
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
          </div>
        );

      case 'heatmap':
        return (
          <div className="space-y-4">
            <div>
              <Label>Intensity Field</Label>
              <Select 
                value={config.heatmapIntensityField || ''} 
                onValueChange={(value) => handleConfigUpdate({ heatmapIntensityField: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select intensity field" />
                </SelectTrigger>
                <SelectContent>
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
            <div>
              <Label>Grid Columns</Label>
              <Slider
                value={[config.gridColumns || 5]}
                onValueChange={([value]) => handleConfigUpdate({ gridColumns: value })}
                max={10}
                min={3}
                step={1}
                className="mt-2"
              />
              <div className="text-sm text-muted-foreground mt-1">
                Current: {config.gridColumns || 5} columns
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            No specific configuration available for this chart type.
          </div>
        );
    }
  };

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="basic">Basic</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
        <TabsTrigger value="style">Style</TabsTrigger>
        <TabsTrigger value="examples">Examples</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div>
          <Label htmlFor="title">Chart Title</Label>
          <Input
            id="title"
            value={config.title || ''}
            onChange={(e) => handleConfigUpdate({ title: e.target.value })}
            placeholder="Enter chart title"
          />
        </div>

        <div>
          <Label>Chart Type</Label>
          <ChartTypeSelector
            selectedType={config.chartType || 'bar'}
            onTypeChange={(type) => handleConfigUpdate({ chartType: type as any })}
            className="mt-2"
          />
        </div>

        <div>
          <Label>Data Source (Form)</Label>
          <Select 
            value={config.formId || ''} 
            onValueChange={(value) => handleConfigUpdate({ formId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a form" />
            </SelectTrigger>
            <SelectContent>
              {forms.map(form => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TabsContent>

      <TabsContent value="data" className="space-y-6">
        <ChartDataSection
          config={config}
          formFields={formFields}
          onConfigChange={handleConfigUpdate}
        />
      </TabsContent>

      <TabsContent value="examples" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Chart Examples
            </CardTitle>
          </CardHeader>
          <CardContent>
            {config.formId ? (
              <ChartExamples 
                formId={config.formId}
                onSelectExample={(example) => {
                  // Apply the example configuration
                  handleConfigUpdate({
                    chartType: example.chartType as any,
                    metrics: example.metrics,
                    dimensions: example.dimensions,
                    aggregationEnabled: example.aggregationEnabled,
                    metricAggregations: example.metricAggregations,
                    title: example.title
                  });
                }}
              />
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                Please select a form first to see relevant examples.
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="style" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Color Theme</CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              value={config.colorTheme || 'default'} 
              onValueChange={(value) => handleConfigUpdate({ colorTheme: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="vibrant">Vibrant</SelectItem>
                <SelectItem value="pastel">Pastel</SelectItem>
                <SelectItem value="monochrome">Monochrome</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Chart-Specific Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {renderChartSpecificConfig()}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="preview" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Chart Preview</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="data-toggle" className="text-sm font-normal">Real Data</Label>
                </div>
                <Switch
                  id="data-toggle"
                  checked={useStaticData}
                  onCheckedChange={setUseStaticData}
                />
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="data-toggle" className="text-sm font-normal">Sample Data</Label>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="bg-muted/30 rounded-lg p-6 min-h-[300px] flex items-center justify-center">
              <div className="w-full h-full">
                <ChartPreview 
                  config={{
                    ...config,
                    // Use sample data for preview when toggle is on, otherwise use real data
                    ...(useStaticData ? { data: sampleData } : {})
                  } as any}
                />
              </div>
            </div>
            
            {useStaticData && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">Preview Mode:</span>
                  <span>Using sample data that matches your selected fields and configuration</span>
                </div>
              </div>
            )}
            
            {!useStaticData && !config.formId && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <Database className="h-4 w-4" />
                  <span className="font-medium">Real Data Mode:</span>
                  <span>Please select a form to view real data</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Configuration Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="font-medium text-muted-foreground">Chart Type:</span>
                <div className="font-medium">{config.chartType || 'Not selected'}</div>
              </div>
              <div className="space-y-1">
                <span className="font-medium text-muted-foreground">Color Theme:</span>
                <div className="font-medium">{config.colorTheme || 'Default'}</div>
              </div>
              <div className="space-y-1">
                <span className="font-medium text-muted-foreground">Metrics:</span>
                <div className="font-medium">{config.metrics?.length || 0} selected</div>
              </div>
              <div className="space-y-1">
                <span className="font-medium text-muted-foreground">Dimensions:</span>
                <div className="font-medium">{config.dimensions?.length || 0} selected</div>
              </div>
            </div>
            
            {config.formId && (
              <div className="pt-3 border-t">
                <div className="space-y-1">
                  <span className="font-medium text-muted-foreground">Data Source:</span>
                  <div className="font-medium">{forms.find(f => f.id === config.formId)?.name || 'Unknown Form'}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}