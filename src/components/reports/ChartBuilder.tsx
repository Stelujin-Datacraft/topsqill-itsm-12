
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useReports } from '@/hooks/useReports';
import { ChartConfig } from '@/types/reports';
import { ChartPreview } from './ChartPreview';
import { Settings } from 'lucide-react';

interface ChartBuilderProps {
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  hideControls?: boolean;
}

export function ChartBuilder({ config, onConfigChange, hideControls = false }: ChartBuilderProps) {
  const [localConfig, setLocalConfig] = useState<ChartConfig>(config);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const { getAvailableForms, getFormFields } = useReports();

  useEffect(() => {
    loadForms();
  }, []);

  useEffect(() => {
    if (localConfig.formId) {
      loadFormFields(localConfig.formId);
    }
  }, [localConfig.formId]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const loadForms = async () => {
    try {
      const forms = await getAvailableForms();
      setAvailableForms(forms);
    } catch (error) {
      console.error('Error loading forms:', error);
    }
  };

  const loadFormFields = async (formId: string) => {
    try {
      const fields = await getFormFields(formId);
      setAvailableFields(fields);
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  };

  const handleConfigUpdate = (updates: Partial<ChartConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  // If hideControls is true, only show the chart preview
  if (hideControls) {
    return (
      <div className="h-full w-full">
        <ChartPreview config={localConfig} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Chart Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chart-title">Chart Title</Label>
              <Input
                id="chart-title"
                value={localConfig.title || ''}
                onChange={(e) => handleConfigUpdate({ title: e.target.value })}
                placeholder="Enter chart title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chart-type">Chart Type</Label>
              <Select
                value={localConfig.chartType || 'bar'}
                onValueChange={(value) => handleConfigUpdate({ chartType: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select chart type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                  <SelectItem value="scatter">Scatter Plot</SelectItem>
                  <SelectItem value="radar">Radar Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-select">Data Source (Form)</Label>
              <Select
                value={localConfig.formId || ''}
                onValueChange={(value) => handleConfigUpdate({ formId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a form" />
                </SelectTrigger>
                <SelectContent>
                  {availableForms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aggregation-type">Aggregation</Label>
              <Select
                value={localConfig.aggregationType || 'count'}
                onValueChange={(value) => handleConfigUpdate({ aggregationType: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select aggregation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="avg">Average</SelectItem>
                  <SelectItem value="min">Minimum</SelectItem>
                  <SelectItem value="max">Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {availableFields.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="x-axis">X-Axis Field</Label>
                  <Select
                    value={localConfig.xAxis || ''}
                    onValueChange={(value) => handleConfigUpdate({ xAxis: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select X-axis field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="y-axis">Y-Axis Field</Label>
                  <Select
                    value={localConfig.yAxis || ''}
                    onValueChange={(value) => handleConfigUpdate({ yAxis: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Y-axis field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="color-theme">Color Theme</Label>
              <Select
                value={localConfig.colorTheme || 'default'}
                onValueChange={(value) => handleConfigUpdate({ colorTheme: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select color theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="vibrant">Vibrant</SelectItem>
                  <SelectItem value="pastel">Pastel</SelectItem>
                  <SelectItem value="monochrome">Monochrome</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chart-description">Description</Label>
            <Textarea
              id="chart-description"
              value={localConfig.description || ''}
              onChange={(e) => handleConfigUpdate({ description: e.target.value })}
              placeholder="Enter chart description"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Chart Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Chart Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartPreview config={localConfig} />
        </CardContent>
      </Card>
    </div>
  );
}
