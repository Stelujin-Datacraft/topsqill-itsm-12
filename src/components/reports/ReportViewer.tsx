
import React, { useState, useEffect } from 'react';
import { useReports } from '@/hooks/useReports';
import { ReportComponent, ReportConfig } from '@/types/reports';
import { ChartPreview } from './ChartPreview';
import { MetricCard } from './MetricCard';
import { Card, CardContent } from '@/components/ui/card';

interface ReportViewerProps {
  reportId: string;
}

export function ReportViewer({ reportId }: ReportViewerProps) {
  const { fetchReportComponents } = useReports();
  const [components, setComponents] = useState<ReportComponent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComponents();
  }, [reportId]);

  const loadComponents = async () => {
    try {
      setLoading(true);
      const data = await fetchReportComponents(reportId);
      // Type-safe conversion with layout parsing
      const typedComponents: ReportComponent[] = data.map(component => ({
        ...component,
        type: component.type as ReportComponent['type'],
        config: component.config as ReportConfig,
        layout: typeof component.layout === 'string' 
          ? JSON.parse(component.layout)
          : typeof component.layout === 'object' && component.layout !== null
          ? component.layout as { x: number; y: number; w: number; h: number }
          : { x: 0, y: 0, w: 6, h: 4 }
      }));
      setComponents(typedComponents);
    } catch (error) {
      console.error('Error loading report components:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderComponent = (component: ReportComponent) => {
    switch (component.type) {
      case 'chart':
        return (
          <ChartPreview 
            key={component.id}
            config={component.config as any}
          />
        );
      
      case 'metric-card':
        return (
          <MetricCard 
            key={component.id}
            config={component.config as any}
          />
        );
      
      case 'table':
        return (
          <Card key={component.id}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Table component rendering coming soon</p>
            </CardContent>
          </Card>
        );
      
      case 'text':
        return (
          <Card key={component.id}>
            <CardContent className="p-4">
              <div 
                className="prose"
                dangerouslySetInnerHTML={{ 
                  __html: (component.config as any).content || 'Text content' 
                }}
              />
            </CardContent>
          </Card>
        );
      
      default:
        return (
          <Card key={component.id}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Component type: {component.type}
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading report...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {components.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No components in this report yet.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {components.map((component) => renderComponent(component))}
        </div>
      )}
    </div>
  );
}
