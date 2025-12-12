import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useReports } from '@/hooks/useReports';
import { ReportComponent } from '@/types/reports';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ComponentConfigDialog } from './ComponentConfigDialog';
import { ChartPropertiesPane } from './ChartPropertiesPane';
import { DynamicTable } from './DynamicTable';
import { EnhancedDynamicTable } from './EnhancedDynamicTable';
import { FormSubmissionsTable } from './FormSubmissionsTable';
import { ChartPreview } from './ChartPreview';
import { MetricCard } from './MetricCard';
import { Plus, Save, BarChart3, Table as TableIcon, Hash, Type, FileText, Move, MousePointer, Edit2, Check, X } from 'lucide-react';
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
export function ReportEditor({
  reportId,
  reportName,
  onSave
}: ReportEditorProps) {
  const [components, setComponents] = useState<ReportComponent[]>([]);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ReportComponent | null>(null);
  const [newComponentType, setNewComponentType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState<ReportComponent | null>(null);
  const [isPropertiesPaneOpen, setIsPropertiesPaneOpen] = useState(false);
  const [isPropertiesPaneExpanded, setIsPropertiesPaneExpanded] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempReportName, setTempReportName] = useState(reportName);
  const [drilldownStates, setDrilldownStates] = useState<{
    [componentId: string]: {
      path: string[];
      values: string[];
    };
  }>({});
  const navigate = useNavigate();
  const {
    fetchReportComponents,
    saveReportComponent,
    updateReportComponent,
    deleteReportComponent,
    getFormFields,
    updateReport
  } = useReports();
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadComponents();
  }, [reportId]);

  useEffect(() => {
    setTempReportName(reportName);
  }, [reportName]);
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
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditingName = () => {
    setIsEditingName(true);
    setTempReportName(reportName);
  };

  const handleSaveReportName = async () => {
    try {
      // Update the report name in the database
      await updateReport(reportId, { name: tempReportName });
      setIsEditingName(false);
      toast({
        title: "Success",
        description: "Report name updated successfully"
      });
    } catch (error) {
      console.error('Error updating report name:', error);
      toast({
        title: "Error",
        description: "Failed to update report name",
        variant: "destructive"
      });
    }
  };

  const handleCancelEditingName = () => {
    setIsEditingName(false);
    setTempReportName(reportName);
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
          variant: "destructive"
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
        setComponents(prev => prev.map(comp => comp.id === editingComponent.id ? typedUpdatedComponent : comp));
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
        description: editingComponent ? "Component updated successfully" : "Component added successfully"
      });
    } catch (error) {
      console.error('Error saving component:', error);
      toast({
        title: "Error",
        description: "Failed to save component. Please try again.",
        variant: "destructive"
      });
    }
  };
  const handleDeleteComponent = async (componentId: string) => {
    try {
      await deleteReportComponent(componentId);
      setComponents(prev => prev.filter(comp => comp.id !== componentId));
      toast({
        title: "Success",
        description: "Component deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting component:', error);
      toast({
        title: "Error",
        description: "Failed to delete component",
        variant: "destructive"
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
        await updateReportComponent(component.id, {
          layout: component.layout
        });
      } catch (error) {
        console.error('Error updating component layout:', error);
      }
    }
  };
  const handleComponentClick = (component: ReportComponent, event: React.MouseEvent) => {
    // Only allow component selection when dragging is disabled
    if (!isDragEnabled) {
      const target = event.target as HTMLElement;
      
      // Check if the click originated from within a chart that supports drilldown
      const isChartDrilldownClick = target.closest('.recharts-bar, .recharts-pie-sector, .recharts-line, .recharts-area') ||
                                   target.classList.contains('recharts-bar') ||
                                   target.classList.contains('recharts-pie-sector') ||
                                   target.classList.contains('recharts-line') ||
                                   target.classList.contains('recharts-area');
      
      // Check if the click originated from a button (for table drilldown, sorting, filtering)
      const isButtonClick = target.closest('button') || target.tagName === 'BUTTON';
      
      // Check if the click originated from an input (for search)
      const isInputClick = target.closest('input') || target.tagName === 'INPUT';
      
      // Check if the click originated from a badge (drilldown active indicators)
      const isBadgeClick = target.closest('[data-slot="badge"]') || target.classList.contains('badge');
      
      // If it's a chart drilldown click and the component supports drilldown, don't open properties
      if (isChartDrilldownClick && component.config && (component.config as any).drilldownConfig?.enabled) {
        return; // Let the chart handle the drilldown
      }
      
      // If it's a button, input, or badge click within a table component, don't open properties
      if ((isButtonClick || isInputClick || isBadgeClick) && component.type === 'table') {
        return; // Let the table handle the interaction
      }
      
      event.stopPropagation();
      setSelectedComponent(component);
      setIsPropertiesPaneOpen(true);
    }
  };
  const handlePropertiesPaneClose = () => {
    setIsPropertiesPaneOpen(false);
    setSelectedComponent(null);
    setIsPropertiesPaneExpanded(false);
  };
  const toggleDragMode = () => {
    setIsDragEnabled(!isDragEnabled);
    // Close properties pane when switching to drag mode
    if (!isDragEnabled) {
      setIsPropertiesPaneOpen(false);
      setSelectedComponent(null);
    }
  };
  const handleComponentRename = async (componentId: string, newName: string) => {
    try {
      const component = components.find(c => c.id === componentId);
      if (!component) return;
      const updatedConfig = {
        ...component.config,
        name: newName
      };
      await updateReportComponent(componentId, {
        config: updatedConfig
      });
      setComponents(prev => prev.map(comp => comp.id === componentId ? {
        ...comp,
        config: updatedConfig
      } : comp));
      toast({
        title: "Success",
        description: "Component renamed successfully"
      });
    } catch (error) {
      console.error('Error renaming component:', error);
      toast({
        title: "Error",
        description: "Failed to rename component",
        variant: "destructive"
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
      const updatedConfig = {
        ...component.config,
        colorTheme: theme
      };
      await updateReportComponent(componentId, {
        config: updatedConfig
      });
      setComponents(prev => prev.map(comp => comp.id === componentId ? {
        ...comp,
        config: updatedConfig
      } : comp));
      toast({
        title: "Success",
        description: "Theme applied successfully"
      });
    } catch (error) {
      console.error('Error updating theme:', error);
      toast({
        title: "Error",
        description: "Failed to apply theme",
        variant: "destructive"
      });
    }
  };
  const handleDrilldown = (componentId: string, drilldownLevel: string, drilldownValue: string) => {
    // Handle reset case
    if (!drilldownLevel && !drilldownValue) {
      setDrilldownStates(prev => ({
        ...prev,
        [componentId]: {
          path: [],
          values: []
        }
      }));
      return;
    }
    setDrilldownStates(prev => {
      const currentState = prev[componentId] || {
        path: [],
        values: []
      };
      const component = components.find(c => c.id === componentId);
      const config = component?.config as any;
      
      // Support both drilldownLevels and levels for backward compatibility
      const drilldownLevels = config?.drilldownConfig?.drilldownLevels || config?.drilldownConfig?.levels || [];
      if (drilldownLevels.length === 0) return prev;

      // Find the current level
      const currentLevel = currentState.values.length;

      // If we're at the same level, replace the value; if going deeper, add the value
      const newValues = [...currentState.values];
      if (currentLevel < drilldownLevels.length) {
        newValues[currentLevel] = drilldownValue;
        // Remove any values beyond the current level
        newValues.splice(currentLevel + 1);
      }
      return {
        ...prev,
        [componentId]: {
          path: drilldownLevels.slice(0, newValues.length),
          values: newValues
        }
      };
    });
  };
  const renderComponent = (component: ReportComponent) => {
    switch (component.type) {
      case 'chart':
        return <ChartPreview config={component.config as any} hideControls={true} onDrilldown={(level, value) => handleDrilldown(component.id, level, value)} drilldownState={drilldownStates[component.id]} />;
      case 'table':
        return <EnhancedDynamicTable config={component.config as any} onEdit={() => handleEditComponent(component)} onDrilldown={(level, value) => handleDrilldown(component.id, level, value)} drilldownState={drilldownStates[component.id]} />;
      case 'form-submissions':
        return <FormSubmissionsTable config={component.config as any} />;
      case 'metric-card':
        return <MetricCard config={component.config as any} />;
      case 'text':
        return <div className="h-full" style={{
          fontSize: (component.config as any).fontSize || 'medium',
          fontWeight: (component.config as any).fontWeight || 'normal',
          textAlign: (component.config as any).textAlign || 'left',
          color: (component.config as any).color || 'inherit',
          backgroundColor: (component.config as any).backgroundColor || 'transparent',
          padding: (component.config as any).padding || 'medium'
        }} dangerouslySetInnerHTML={{
          __html: (component.config as any).content || 'Text content'
        }} />;
      default:
        return <div className="h-full flex items-center justify-center text-muted-foreground">
            Unknown component type: {component.type}
          </div>;
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
      {/* Report Name Header */}
      <div className="flex items-center gap-3">
        {isEditingName ? (
          <>
            <input
              type="text"
              value={tempReportName}
              onChange={(e) => setTempReportName(e.target.value)}
              className="text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveReportName();
                if (e.key === 'Escape') handleCancelEditingName();
              }}
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleSaveReportName}
              className="h-8 w-8 p-0"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelEditingName}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold flex-1">{reportName}</h1>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleStartEditingName}
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
          {/* Drag Mode Toggle */}
          <Button variant={isDragEnabled ? "default" : "outline"} onClick={toggleDragMode} className="flex items-center gap-2">
            {isDragEnabled ? <>
                <Move className="h-4 w-4" />
                Drag Mode
              </> : <>
                <MousePointer className="h-4 w-4" />
                Select Mode
              </>}
          </Button>
          
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
            Form Submissions
          </Button>
          <Button variant="outline" onClick={() => handleAddComponent('metric-card')}>
            <Hash className="h-4 w-4 mr-2" />
            Add Metric
          </Button>
          <Button variant="outline" onClick={() => handleAddComponent('text')}>
            <Type className="h-4 w-4 mr-2" />
            Add Text
          </Button>
          <Button onClick={onSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Report
          </Button>
        </div>

      {/* Mode Indicator */}
      {!isDragEnabled && <div className="bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <MousePointer className="h-4 w-4" />
            <span><strong>Select Mode:</strong> Click on charts to open properties panel. Switch to Drag Mode to rearrange components.</span>
          </p>
        </div>}

      {/* Grid Layout */}
      <div className={`transition-all duration-300 ${isPropertiesPaneOpen ? (isPropertiesPaneExpanded ? 'mr-[50vw]' : 'mr-80') : 'mr-0'}`}>
        {components.length > 0 ? <ResponsiveGridLayout 
        className="layout" 
        layouts={{
          lg: gridItems
        }} 
        breakpoints={{
          lg: 1200,
          md: 996,
          sm: 768,
          xs: 480,
          xxs: 0
        }} 
        cols={{
          lg: 12,
          md: 10,
          sm: 6,
          xs: 4,
          xxs: 2
        }} 
        rowHeight={60} 
        isDraggable={isDragEnabled} 
        isResizable={isDragEnabled} 
        draggableCancel="button, input, select, textarea, a, [role='button'], .recharts-wrapper, .no-drag"
        onLayoutChange={isDragEnabled ? handleLayoutChange : undefined}>
            {components.map(component => <div key={component.id} className="relative group">
                <Card className={`h-full overflow-hidden transition-all ${!isDragEnabled ? 'cursor-pointer' : 'cursor-move'} ${selectedComponent?.id === component.id ? 'ring-2 ring-primary shadow-lg' : !isDragEnabled ? 'hover:shadow-md hover:ring-1 hover:ring-muted-foreground/20' : ''}`} onClick={e => handleComponentClick(component, e)}>
                  <CardContent className="p-4 h-full relative">
                    {renderComponent(component)}
                  </CardContent>
                </Card>
              </div>)}
          </ResponsiveGridLayout> : <Card className="h-64 flex items-center justify-center">
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
          </Card>}
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
        onExpandedChange={setIsPropertiesPaneExpanded}
        onUpdateComponent={async (componentId, updates) => {
          try {
            const component = components.find(c => c.id === componentId);
            if (!component) return;
            
            const updatedConfig = { ...component.config, ...updates.config };
            await updateReportComponent(componentId, { config: updatedConfig });
            
            setComponents(prev => prev.map(comp => 
              comp.id === componentId 
                ? { ...comp, config: updatedConfig }
                : comp
            ));
            
            // Update selected component to reflect changes immediately
            if (selectedComponent?.id === componentId) {
              setSelectedComponent({ ...component, config: updatedConfig });
            }
          } catch (error) {
            console.error('Error updating component:', error);
          }
        }} 
        formFields={selectedComponent?.config?.formId ? getFormFields(selectedComponent.config.formId) : []} 
      />

      {/* Component Configuration Dialog */}
      <ComponentConfigDialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen} componentType={newComponentType || editingComponent?.type || ''} initialConfig={editingComponent?.config} onSave={handleSaveComponent} />
    </div>
  );
}