import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useReports } from '@/hooks/useReports';
import { ReportComponent } from '@/types/reports';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ComponentConfigDialog } from './ComponentConfigDialog';
import { ChartPropertiesPane } from './ChartPropertiesPane';
import { DynamicTable } from './DynamicTable';
import { FormSubmissionsTable } from './FormSubmissionsTable';
import { ChartPreview } from './ChartPreview';
import { MetricCard } from './MetricCard';
import { 
  Plus, 
  Save, 
  BarChart3, 
  Table as TableIcon, 
  Hash, 
  Type,
  FileText,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useNavigate } from 'react-router-dom';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface ReportEditorProps {
  reportId: string;
  reportName: string;
  onSave: () => void;
}

export function ReportEditor({ reportId, reportName, onSave }: ReportEditorProps) {
  const [components, setComponents] = useState<ReportComponent[]>([]);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ReportComponent | null>(null);
  const [newComponentType, setNewComponentType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState<ReportComponent | null>(null);
  const [isPropertiesPaneOpen, setIsPropertiesPaneOpen] = useState(false);
  const navigate = useNavigate();

  const { 
    fetchReportComponents, 
    saveReportComponent, 
    updateReportComponent, 
    deleteReportComponent 
  } = useReports();
  const { toast } = useToast();

  useEffect(() => {
    loadComponents();
  }, [reportId]);

  const loadComponents = async () => {
    try {
      // Skip loading components for new reports
      if (reportId === 'new') {
        setComponents([]);
        setLoading(false);
        return;
      }

      const reportComponents = await fetchReportComponents(reportId);
      // Type the components properly
      const typedComponents: ReportComponent[] = reportComponents.map(comp => ({
        ...comp,
        type: comp.type as ReportComponent['type'],
        config: comp.config as any,
        layout: comp.layout as any
      }));
      setComponents(typedComponents);
    } catch (error) {
      console.error('Error loading components:', error);
      toast({
        title: "Error",
        description: "Failed to load report components",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccessManagement = () => {
    navigate(`/report-access/${reportId}`);
  };

  const handleAddComponent = (type: string) => {
    setNewComponentType(type);
    setEditingComponent(null);
    setIsConfigDialogOpen(true);
  };

  const handleEditComponent = (component: ReportComponent) => {
    setEditingComponent(component);
    setNewComponentType('');
    setIsConfigDialogOpen(true);
  };

  const handleSaveComponent = async (componentData: any) => {
    try {
      console.log('Saving component:', componentData);
      
      // If this is a new report, we need to create it first
      if (reportId === 'new') {
        toast({
          title: "Error",
          description: "Please save the report first before adding components",
          variant: "destructive",
        });
        return;
      }

      if (editingComponent) {
        const updatedComponent = await updateReportComponent(editingComponent.id, {
          config: componentData.config,
          layout: componentData.layout
        });
        const typedUpdatedComponent: ReportComponent = {
          ...updatedComponent,
          type: updatedComponent.type as ReportComponent['type'],
          config: updatedComponent.config as any,
          layout: updatedComponent.layout as any
        };
        setComponents(prev => prev.map(comp => 
          comp.id === editingComponent.id ? typedUpdatedComponent : comp
        ));
        console.log('Component updated successfully');
      } else {
        const defaultLayout = {
          x: 0,
          y: Math.max(...components.map(c => c.layout.y + c.layout.h), 0),
          w: 6,
          h: 4
        };

        const newComponent = await saveReportComponent({
          report_id: reportId,
          type: newComponentType as ReportComponent['type'],
          config: componentData.config || {},
          layout: componentData.layout || defaultLayout
        });
        
        const typedNewComponent: ReportComponent = {
          ...newComponent,
          type: newComponent.type as ReportComponent['type'],
          config: newComponent.config as any,
          layout: newComponent.layout as any
        };
        setComponents(prev => [...prev, typedNewComponent]);
        console.log('Component created successfully');
      }
      
      setIsConfigDialogOpen(false);
      setEditingComponent(null);
      setNewComponentType('');
      
      toast({
        title: "Success",
        description: editingComponent ? "Component updated successfully" : "Component added successfully",
      });
    } catch (error) {
      console.error('Error saving component:', error);
      toast({
        title: "Error",
        description: "Failed to save component. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteComponent = async (componentId: string) => {
    try {
      await deleteReportComponent(componentId);
      setComponents(prev => prev.filter(comp => comp.id !== componentId));
      toast({
        title: "Success",
        description: "Component deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting component:', error);
      toast({
        title: "Error",
        description: "Failed to delete component",
        variant: "destructive",
      });
    }
  };

  const handleLayoutChange = async (layout: any[], allLayouts: any) => {
    const updatedComponents = components.map(component => {
      const layoutItem = layout.find(item => item.i === component.id);
      if (layoutItem) {
        return {
          ...component,
          layout: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h
          }
        };
      }
      return component;
    });

    setComponents(updatedComponents);

    // Save layout changes to database
    for (const component of updatedComponents) {
      try {
        await updateReportComponent(component.id, { layout: component.layout });
      } catch (error) {
        console.error('Error updating component layout:', error);
      }
    }
  };

  const handleComponentClick = (component: ReportComponent) => {
    setSelectedComponent(component);
    setIsPropertiesPaneOpen(true);
  };

  const handlePropertiesPaneClose = () => {
    setIsPropertiesPaneOpen(false);
    setSelectedComponent(null);
  };

  const handleComponentRename = async (componentId: string, newName: string) => {
    try {
      const component = components.find(c => c.id === componentId);
      if (!component) return;

      const updatedConfig = { ...component.config, name: newName };
      await updateReportComponent(componentId, { config: updatedConfig });
      
      setComponents(prev => prev.map(comp => 
        comp.id === componentId 
          ? { ...comp, config: updatedConfig }
          : comp
      ));

      toast({
        title: "Success",
        description: "Component renamed successfully",
      });
    } catch (error) {
      console.error('Error renaming component:', error);
      toast({
        title: "Error",
        description: "Failed to rename component",
        variant: "destructive",
      });
    }
  };

  const handleApplyFilter = (componentId: string) => {
    const component = components.find(c => c.id === componentId);
    if (component) {
      handleEditComponent(component);
      setIsPropertiesPaneOpen(false);
    }
  };

  const handleApplyDrilldown = (componentId: string) => {
    const component = components.find(c => c.id === componentId);
    if (component) {
      handleEditComponent(component);
      setIsPropertiesPaneOpen(false);
    }
  };

  const handleChangeTheme = async (componentId: string, theme: any) => {
    try {
      const component = components.find(c => c.id === componentId);
      if (!component) return;

      const updatedConfig = { ...component.config, colorTheme: theme };
      await updateReportComponent(componentId, { config: updatedConfig });
      
      setComponents(prev => prev.map(comp => 
        comp.id === componentId 
          ? { ...comp, config: updatedConfig }
          : comp
      ));

      toast({
        title: "Success",
        description: "Theme applied successfully",
      });
    } catch (error) {
      console.error('Error updating theme:', error);
      toast({
        title: "Error",
        description: "Failed to apply theme",
        variant: "destructive",
      });
    }
  };

  const renderComponent = (component: ReportComponent) => {
    switch (component.type) {
      case 'chart':
        return (
          <ChartPreview 
            config={component.config as any}
            hideControls={true}
          />
        );
      case 'table':
        return (
          <DynamicTable 
            config={component.config as any}
          />
        );
      case 'form-submissions':
        return (
          <FormSubmissionsTable 
            config={component.config as any}
          />
        );
      case 'metric-card':
        return (
          <MetricCard 
            config={component.config as any}
          />
        );
      case 'text':
        return (
          <div 
            className="h-full"
            style={{
              fontSize: (component.config as any).fontSize || 'medium',
              fontWeight: (component.config as any).fontWeight || 'normal',
              textAlign: (component.config as any).textAlign || 'left',
              color: (component.config as any).color || 'inherit',
              backgroundColor: (component.config as any).backgroundColor || 'transparent',
              padding: (component.config as any).padding || 'medium'
            }}
            dangerouslySetInnerHTML={{ __html: (component.config as any).content || 'Text content' }}
          />
        );
      default:
        return (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Unknown component type: {component.type}
          </div>
        );
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading report editor..." />;
  }

  const gridItems = components.map(component => ({
    i: component.id,
    x: component.layout.x,
    y: component.layout.y,
    w: component.layout.w,
    h: component.layout.h,
    minW: 2,
    minH: 2
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{reportName}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleAddComponent('chart')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Add Chart
          </Button>
          <Button variant="outline" onClick={() => handleAddComponent('table')}>
            <TableIcon className="h-4 w-4 mr-2" />
            Add Table
          </Button>
          <Button variant="outline" onClick={() => handleAddComponent('form-submissions')}>
            <FileText className="h-4 w-4 mr-2" />
            Add Form Submissions
          </Button>
          <Button variant="outline" onClick={() => handleAddComponent('metric-card')}>
            <Hash className="h-4 w-4 mr-2" />
            Add Metric
          </Button>
          <Button variant="outline" onClick={() => handleAddComponent('text')}>
            <Type className="h-4 w-4 mr-2" />
            Add Text
          </Button>
          <Button variant="outline" onClick={handleAccessManagement}>
            <Shield className="h-4 w-4 mr-2" />
            Access Control
          </Button>
          <Button onClick={onSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Report
          </Button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className={`transition-all duration-300 ${isPropertiesPaneOpen ? 'mr-80' : 'mr-0'}`}>
        {components.length > 0 ? (
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: gridItems }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            isDraggable={true}
            isResizable={true}
            onLayoutChange={handleLayoutChange}
          >
            {components.map(component => (
              <div key={component.id} className="relative group">
                <Card 
                  className={`h-full overflow-hidden cursor-pointer transition-all ${
                    selectedComponent?.id === component.id 
                      ? 'ring-2 ring-primary shadow-lg' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleComponentClick(component)}
                >
                  <CardContent className="p-4 h-full relative">
                    {renderComponent(component)}
                  </CardContent>
                </Card>
              </div>
            ))}
          </ResponsiveGridLayout>
        ) : (
          <Card className="h-64 flex items-center justify-center">
            <div className="text-center">
              <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Start building your report</p>
              <p className="text-muted-foreground mb-4">Add charts, tables, metrics, or text components</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => handleAddComponent('chart')}>
                  Add Chart
                </Button>
                <Button variant="outline" onClick={() => handleAddComponent('form-submissions')}>
                  Add Form Submissions
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Properties Pane */}
      <ChartPropertiesPane
        component={selectedComponent}
        isOpen={isPropertiesPaneOpen}
        onClose={handlePropertiesPaneClose}
        onEdit={handleEditComponent}
        onDelete={handleDeleteComponent}
        onRename={handleComponentRename}
        onApplyFilter={handleApplyFilter}
        onApplyDrilldown={handleApplyDrilldown}
        onChangeTheme={handleChangeTheme}
      />

      {/* Component Configuration Dialog */}
      <ComponentConfigDialog
        open={isConfigDialogOpen}
        onOpenChange={setIsConfigDialogOpen}
        componentType={newComponentType || editingComponent?.type || ''}
        initialConfig={editingComponent?.config}
        onSave={handleSaveComponent}
      />
    </div>
  );
}
