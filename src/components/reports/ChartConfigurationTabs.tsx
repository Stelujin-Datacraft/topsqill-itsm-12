import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartConfig } from '@/types/reports';
import { FormField } from '@/types/form';
import { ChartTypeSelector } from './ChartTypeSelector';
import { ChartPreview } from './ChartPreview';
import { GenericFieldSelector } from './GenericFieldSelector';

interface ChartConfigurationTabsProps {
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  formFields: FormField[];
  forms: Array<{ id: string; name: string; description?: string }>;
}

// Sample data for chart preview
const SAMPLE_DATA = [
  { name: 'Product A', sales: 120, revenue: 15000, customers: 45 },
  { name: 'Product B', sales: 98, revenue: 12500, customers: 32 },
  { name: 'Product C', sales: 86, revenue: 9800, customers: 28 },
  { name: 'Product D', sales: 145, revenue: 18200, customers: 56 },
  { name: 'Product E', sales: 73, revenue: 8900, customers: 21 }
];

export function ChartConfigurationTabs({ 
  config, 
  onConfigChange, 
  formFields, 
  forms 
}: ChartConfigurationTabsProps) {
  
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
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="basic">Basic</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
        <TabsTrigger value="style">Style</TabsTrigger>
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

      <TabsContent value="data" className="space-y-4">
        {formFields.length > 0 ? (
          <>
            <GenericFieldSelector
              formFields={formFields}
              selectedFields={config.metrics || []}
              onFieldsChange={(fields) => handleConfigUpdate({ metrics: fields })}
              label="Metrics"
              description="Fields to measure and aggregate"
              selectionType="dropdown"
              maxSelections={1}
              placeholder="Select metric field..."
            />

            <GenericFieldSelector
              formFields={formFields}
              selectedFields={config.dimensions || []}
              onFieldsChange={(fields) => handleConfigUpdate({ dimensions: fields })}
              label="Dimensions"
              description="Fields to group by or categorize data"
              selectionType="dropdown"
              maxSelections={1}
              placeholder="Select dimension field..."
            />

            <div>
              <Label>Aggregation Function</Label>
              <Select 
                value={config.aggregationType || 'count'} 
                onValueChange={(value) => handleConfigUpdate({ aggregationType: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="average">Average</SelectItem>
                  <SelectItem value="min">Minimum</SelectItem>
                  <SelectItem value="max">Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            Please select a form to configure data fields.
          </div>
        )}
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
            <CardTitle className="text-sm">Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ChartPreview 
                config={{
                  ...config,
                  // Use sample data for preview
                  formId: 'sample',
                  data: SAMPLE_DATA
                } as any}
              />
            </div>
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}