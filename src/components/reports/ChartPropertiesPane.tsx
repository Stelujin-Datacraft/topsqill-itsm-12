import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChartColorThemes } from './ChartColorThemes';
import { ReportComponent } from '@/types/reports';
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
  onChangeTheme
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
                      value={componentName}
                      onChange={(e) => setComponentName(e.target.value)}
                      placeholder="Enter component name"
                    />
                    <Button
                      size="sm"
                      onClick={handleRename}
                      disabled={componentName.trim() === component.config?.name}
                    >
                      Save
                    </Button>
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
                
                {component.type === 'chart' && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => onApplyFilter(component.id)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Apply Filters
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => onApplyDrilldown(component.id)}
                    >
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Configure Drilldown
                    </Button>
                  </>
                )}
                
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

            {/* Color Themes (for charts) */}
            {component.type === 'chart' && (
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