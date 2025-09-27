import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartColorThemes } from './ChartColorThemes';
import { DrilldownTab } from './DrilldownTab';
import { ReportComponent } from '@/types/reports';
import { FormField } from '@/types/form';
import { 
  Edit3, 
  Trash2, 
  Filter, 
  TrendingDown, 
  Palette, 
  Type,
  BarChart3,
  X,
  Settings
} from 'lucide-react';

interface ChartPropertiesPaneProps {
  component: ReportComponent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (component: ReportComponent) => void;
  onDelete: (componentId: string) => void;
  onRename: (componentId: string, newName: string) => void;
  onApplyFilter: (componentId: string) => void;
  onApplyDrilldown: (componentId: string) => void;
  onChangeTheme: (componentId: string, theme: any) => void;
  onUpdateComponent: (componentId: string, updates: Partial<ReportComponent>) => void;
  formFields: FormField[];
}

export function ChartPropertiesPane({
  component,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onRename,
  onApplyFilter,
  onApplyDrilldown,
  onChangeTheme,
  onUpdateComponent,
  formFields
}: ChartPropertiesPaneProps) {
  const [componentName, setComponentName] = React.useState('');

  React.useEffect(() => {
    if (component) {
      setComponentName(component.config?.name || `${component.type} Component`);
    }
  }, [component]);

  if (!isOpen || !component) {
    return null;
  }

  const handleRename = () => {
    if (componentName.trim() && componentName !== component.config?.name) {
      onRename(component.id, componentName.trim());
    }
  };

  const getComponentIcon = (type: string) => {
    switch (type) {
      case 'chart':
        return <BarChart3 className="h-4 w-4" />;
      case 'table':
        return <Settings className="h-4 w-4" />;
      case 'text':
        return <Type className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  return (
    <div className={`fixed top-0 right-0 h-full w-80 bg-background border-l shadow-lg z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getComponentIcon(component.type)}
            <h3 className="text-lg font-semibold">Properties</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="component-name">Component Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="component-name"
                        key={component.id} // Force re-render when component changes
                        defaultValue={component.config?.name || `${component.type} Component`}
                        onBlur={(e) => {
                          const newName = e.target.value.trim();
                          if (newName && newName !== component.config?.name) {
                            onRename(component.id, newName);
                          }
                        }}
                        placeholder="Enter component name"
                      />
                    </div>
                  </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Type:</Label>
                  <Badge variant="secondary" className="capitalize">
                    {component.type}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onEdit(component)}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Configuration
                </Button>
                
                <Separator />
                
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => onDelete(component.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Component
                </Button>
              </CardContent>
            </Card>

            {/* Chart-specific configurations */}
            {component.type === 'chart' && (
              <Tabs defaultValue="display" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="display">Display</TabsTrigger>
                  <TabsTrigger value="filters">Filters</TabsTrigger>
                  <TabsTrigger value="drilldown">Drilldown</TabsTrigger>
                  <TabsTrigger value="themes">Themes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="display">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Display Options
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Axis Labels */}
                      <div className="space-y-2">
                        <Label htmlFor="x-axis-label" className="text-sm font-medium">X-Axis Label</Label>
                        <Input
                          id="x-axis-label"
                          defaultValue={(component.config as any).xAxisLabel || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (component.config as any).xAxisLabel) {
                              onUpdateComponent(component.id, {
                                config: { ...component.config, xAxisLabel: e.target.value }
                              });
                            }
                          }}
                          placeholder="Enter X-axis label"
                          className="text-sm"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="y-axis-label" className="text-sm font-medium">Y-Axis Label</Label>
                        <Input
                          id="y-axis-label"
                          defaultValue={(component.config as any).yAxisLabel || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (component.config as any).yAxisLabel) {
                              onUpdateComponent(component.id, {
                                config: { ...component.config, yAxisLabel: e.target.value }
                              });
                            }
                          }}
                          placeholder="Enter Y-axis label"
                          className="text-sm"
                        />
                      </div>
                      
                      {/* Show as Table Toggle */}
                      <div className="flex items-center justify-between py-2">
                        <Label htmlFor="show-as-table" className="text-sm font-medium">View Mode</Label>
                        <div className="flex items-center bg-muted rounded-lg p-1">
                          <Button
                            variant={(component.config as any).showAsTable ? "outline" : "default"}
                            size="sm"
                            onClick={() => {
                              onUpdateComponent(component.id, {
                                config: { ...component.config, showAsTable: false }
                              });
                            }}
                            className="h-8 px-3 text-xs"
                          >
                            Chart
                          </Button>
                          <Button
                            variant={(component.config as any).showAsTable ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              onUpdateComponent(component.id, {
                                config: { ...component.config, showAsTable: true }
                              });
                            }}
                            className="h-8 px-3 text-xs"
                          >
                            Table
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="filters">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters & Aggregation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => onApplyFilter(component.id)}
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Configure Filters
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="drilldown">
                  <DrilldownTab
                    component={component}
                    formFields={formFields}
                    onUpdateComponent={onUpdateComponent}
                  />
                </TabsContent>
                
                <TabsContent value="themes">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Color Themes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartColorThemes
                        selectedTheme={component.config?.colorTheme || 'theme1'}
                        onThemeChange={(theme) => onChangeTheme(component.id, theme)}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {/* Component Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Component Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Position:</span>
                    <span>({component.layout.x}, {component.layout.y})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span>{component.layout.w} × {component.layout.h}</span>
                  </div>
                  {component.config?.formId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Form:</span>
                      <span className="text-xs truncate">{component.config.formId}</span>
                    </div>
                  )}
                  {component.config?.chartType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chart Type:</span>
                      <span className="capitalize">{component.config.chartType}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}