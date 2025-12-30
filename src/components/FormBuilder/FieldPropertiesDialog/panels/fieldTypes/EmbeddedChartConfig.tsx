import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BarChart3, TrendingUp, GitCompare } from 'lucide-react';
import { EmbeddedChartConfig } from '@/types/reports';

interface EmbeddedChartConfigPanelProps {
  config: EmbeddedChartConfig | undefined;
  onUpdate: (config: EmbeddedChartConfig) => void;
  targetFormFields: Array<{ id: string; label: string; field_type: string }>;
}

const NUMERIC_FIELD_TYPES = ['number', 'currency', 'rating', 'star-rating', 'slider'];

const COLOR_THEMES = [
  { value: 'default', label: 'Default', colors: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'] },
  { value: 'vibrant', label: 'Vibrant', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'] },
  { value: 'pastel', label: 'Pastel', colors: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA'] },
  { value: 'monochrome', label: 'Monochrome', colors: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6'] },
  { value: 'ocean', label: 'Ocean', colors: ['#006A6B', '#1B9AAA', '#40C9A2', '#9FFFCB'] },
  { value: 'sunset', label: 'Sunset', colors: ['#FF6B35', '#F7931E', '#FFD23F', '#F06292'] },
  { value: 'nature', label: 'Nature', colors: ['#8BC34A', '#4CAF50', '#009688', '#607D8B'] },
  { value: 'business', label: 'Business', colors: ['#1976D2', '#1565C0', '#0D47A1', '#42A5F5'] },
];

export function EmbeddedChartConfigPanel({
  config,
  onUpdate,
  targetFormFields
}: EmbeddedChartConfigPanelProps) {
  const defaultConfig: EmbeddedChartConfig = {
    enabled: false,
    chartType: 'bar',
    mode: 'count',
    colorTheme: 'default',
    height: 300
  };

  const currentConfig = config || defaultConfig;

  const updateField = (field: keyof EmbeddedChartConfig, value: any) => {
    onUpdate({ ...currentConfig, [field]: value });
  };

  const numericFields = useMemo(() => 
    targetFormFields.filter(f => NUMERIC_FIELD_TYPES.includes(f.field_type)),
    [targetFormFields]
  );

  const categoricalFields = useMemo(() => 
    targetFormFields.filter(f => 
      ['text', 'select', 'radio', 'checkbox', 'multi-select', 'dropdown', 'status'].includes(f.field_type)
    ),
    [targetFormFields]
  );

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-600" />
          Embedded Chart (View Selected Records)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-white dark:bg-gray-900 rounded border">
          <p className="text-sm text-muted-foreground">
            Display a chart visualizing the selected cross-reference records when viewing the form submission.
          </p>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="enable-chart" className="font-medium">Enable Embedded Chart</Label>
          <Switch
            id="enable-chart"
            checked={currentConfig.enabled}
            onCheckedChange={(checked) => updateField('enabled', checked)}
          />
        </div>

        {currentConfig.enabled && (
          <>
            {/* Chart Title */}
            <div className="space-y-2">
              <Label>Chart Title (Optional)</Label>
              <Input
                placeholder="e.g., Selected Items Overview"
                value={currentConfig.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
              />
            </div>

            {/* Chart Type */}
            <div className="space-y-2">
              <Label>Chart Type</Label>
              <Select
                value={currentConfig.chartType}
                onValueChange={(value) => updateField('chartType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="donut">Donut Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode Selection */}
            <div className="space-y-3">
              <Label className="font-medium">Chart Mode</Label>
              <RadioGroup
                value={currentConfig.mode}
                onValueChange={(value) => updateField('mode', value as EmbeddedChartConfig['mode'])}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="count" id="mode-count" />
                  <Label htmlFor="mode-count" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Count Records</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Count selected records, optionally grouped by a field
                    </p>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="calculate" id="mode-calculate" />
                  <Label htmlFor="mode-calculate" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Calculate Values</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aggregate a numeric field (sum, avg, min, max)
                    </p>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="compare" id="mode-compare" />
                  <Label htmlFor="mode-compare" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <GitCompare className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Compare Two Fields</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Show two fields side by side (text fields show as legend)
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Mode-specific configuration */}
            {currentConfig.mode === 'count' && (
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="space-y-2">
                  <Label>Group By Field (Optional)</Label>
                  <Select
                    value={currentConfig.groupByFieldId || 'none'}
                    onValueChange={(value) => updateField('groupByFieldId', value === 'none' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field to group by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No grouping (total count)</SelectItem>
                      {categoricalFields.map(field => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {currentConfig.groupByFieldId && (
                  <div className="space-y-2">
                    <Label>Stack By Field (Optional)</Label>
                    <Select
                      value={currentConfig.stackByFieldId || 'none'}
                      onValueChange={(value) => updateField('stackByFieldId', value === 'none' ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field to stack by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No stacking</SelectItem>
                        {categoricalFields
                          .filter(f => f.id !== currentConfig.groupByFieldId)
                          .map(field => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {currentConfig.mode === 'calculate' && (
              <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="space-y-2">
                  <Label>Metric Field *</Label>
                  <Select
                    value={currentConfig.metricFieldId || ''}
                    onValueChange={(value) => updateField('metricFieldId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select numeric field" />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.length === 0 ? (
                        <SelectItem value="" disabled>No numeric fields available</SelectItem>
                      ) : (
                        numericFields.map(field => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label} ({field.field_type})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Aggregation Type</Label>
                  <Select
                    value={currentConfig.aggregationType || 'sum'}
                    onValueChange={(value) => updateField('aggregationType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sum">Sum</SelectItem>
                      <SelectItem value="avg">Average</SelectItem>
                      <SelectItem value="min">Minimum</SelectItem>
                      <SelectItem value="max">Maximum</SelectItem>
                      <SelectItem value="median">Median</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Group By Field (Optional)</Label>
                  <Select
                    value={currentConfig.groupByFieldId || 'none'}
                    onValueChange={(value) => updateField('groupByFieldId', value === 'none' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field to group by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No grouping (single value)</SelectItem>
                      {categoricalFields.map(field => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentConfig.mode === 'compare' && (
              <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="space-y-2">
                  <Label>First Field (X-Axis / Category) *</Label>
                  <Select
                    value={currentConfig.compareXFieldId || ''}
                    onValueChange={(value) => updateField('compareXFieldId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select first field" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetFormFields
                        .filter(f => !['header', 'description', 'section-break', 'file', 'image', 'signature'].includes(f.field_type))
                        .map(field => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label} ({field.field_type})
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Second Field (Y-Axis / Legend) *</Label>
                  <Select
                    value={currentConfig.compareYFieldId || ''}
                    onValueChange={(value) => updateField('compareYFieldId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select second field" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetFormFields
                        .filter(f => f.id !== currentConfig.compareXFieldId && !['header', 'description', 'section-break', 'file', 'image', 'signature'].includes(f.field_type))
                        .map(field => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label} ({field.field_type})
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-xs text-muted-foreground">
                  Numeric fields show values directly. Text fields are encoded as legend with color-coded bars.
                </p>
              </div>
            )}

            {/* Color Theme */}
            <div className="space-y-2">
              <Label>Color Theme</Label>
              <Select
                value={currentConfig.colorTheme || 'default'}
                onValueChange={(value) => updateField('colorTheme', value)}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {(COLOR_THEMES.find(t => t.value === (currentConfig.colorTheme || 'default'))?.colors || []).map((color, i) => (
                          <div 
                            key={i} 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span>{COLOR_THEMES.find(t => t.value === (currentConfig.colorTheme || 'default'))?.label || 'Default'}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {COLOR_THEMES.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {theme.colors.map((color, index) => (
                            <div
                              key={index}
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span>{theme.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chart Height */}
            <div className="space-y-2">
              <Label>Chart Height (px)</Label>
              <Input
                type="number"
                min={150}
                max={600}
                value={currentConfig.height || 300}
                onChange={(e) => updateField('height', parseInt(e.target.value) || 300)}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
