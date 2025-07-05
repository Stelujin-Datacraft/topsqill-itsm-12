import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Responsive, WidthProvider } from 'react-grid-layout';
import DashboardLayout from '@/components/DashboardLayout';
import { useReports } from '@/hooks/useReports';
import { Report, ReportComponent } from '@/types/reports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Share2, 
  Download, 
  Calendar, 
  User, 
  Eye,
  ExternalLink,
  Copy,
  Link
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ChartPreview } from '@/components/reports/ChartPreview';
import { MetricCard } from '@/components/reports/MetricCard';
import { DynamicTable } from '@/components/reports/DynamicTable';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const ReportViewerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reports, fetchReportComponents } = useReports();
  const { toast } = useToast();
  
  const [report, setReport] = useState<Report | null>(null);
  const [components, setComponents] = useState<ReportComponent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadReportData();
    }
  }, [id, reports]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      const foundReport = reports.find(r => r.id === id);
      if (foundReport) {
        setReport(foundReport);
        
        // Load report components
        const componentsData = await fetchReportComponents(foundReport.id);
        const typedComponents: ReportComponent[] = componentsData.map(component => ({
          ...component,
          type: component.type as ReportComponent['type'],
          config: typeof component.config === 'string' 
            ? JSON.parse(component.config)
            : component.config as any,
          layout: typeof component.layout === 'string' 
            ? JSON.parse(component.layout)
            : typeof component.layout === 'object' && component.layout !== null
            ? component.layout as { x: number; y: number; w: number; h: number }
            : { x: 0, y: 0, w: 6, h: 4 }
        }));
        setComponents(typedComponents);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShareReport = () => {
    const reportUrl = `${window.location.origin}/report-view/${id}`;
    navigator.clipboard.writeText(reportUrl);
    toast({
      title: "Link copied",
      description: "Report sharing link copied to clipboard",
    });
  };

  const handleCopyLink = () => {
    const reportUrl = `${window.location.origin}/report-view/${id}`;
    navigator.clipboard.writeText(reportUrl);
    toast({
      title: "Link copied",
      description: "Report link copied to clipboard",
    });
  };

  const handleDownload = () => {
    // Placeholder for download functionality
    toast({
      title: "Download",
      description: "Download functionality coming soon",
    });
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
          <DynamicTable 
            key={component.id}
            config={component.config as any}
          />
        );
      
      case 'form-submissions':
        return (
          <div key={component.id} className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Form submissions table coming soon</p>
          </div>
        );
      
      case 'text':
        const textConfig = component.config as any;
        return (
          <div 
            key={component.id}
            className="h-full"
            style={{
              backgroundColor: textConfig.backgroundColor,
              color: textConfig.color,
              fontSize: getFontSize(textConfig.fontSize),
              fontWeight: textConfig.fontWeight,
              textAlign: textConfig.textAlign as any,
              padding: '1rem'
            }}
          >
            <div 
              className="prose"
              dangerouslySetInnerHTML={{ 
                __html: textConfig.content || 'Text content' 
              }}
            />
          </div>
        );
      
      default:
        return (
          <div key={component.id} className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Component type: {component.type}
            </p>
          </div>
        );
    }
  };

  const getFontSize = (size: string) => {
    const sizes = {
      small: '14px',
      medium: '16px',
      large: '20px',
      xl: '24px',
      '2xl': '32px'
    };
    return sizes[size as keyof typeof sizes] || '16px';
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading Report...">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading report...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout title="Report Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Report not found</p>
          <Button onClick={() => navigate('/reports')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/reports')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareReport}>
                  <Link className="h-4 w-4 mr-2" />
                  Share Report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(`/report-view/${id}`, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button onClick={() => navigate(`/report-editor/${id}`)}>
              Edit Report
            </Button>
          </div>
        </div>

        {/* Report Metadata */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl">{report.name}</CardTitle>
                {report.description && (
                  <p className="text-muted-foreground">{report.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {report.is_public && (
                  <Badge variant="secondary">
                    <Eye className="h-3 w-3 mr-1" />
                    Public
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Created {format(new Date(report.created_at), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Updated {format(new Date(report.updated_at), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>By {report.created_by}</span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Report Components */}
        <div className="space-y-6">
          {components.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="text-muted-foreground">
                    This report doesn't have any components yet.
                  </div>
                  <Button onClick={() => navigate(`/report-editor/${id}`)}>
                    Add Components
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ResponsiveGridLayout
              className="layout"
              layouts={{ lg: components.map(component => ({
                i: component.id,
                x: component.layout.x,
                y: component.layout.y,
                w: component.layout.w,
                h: component.layout.h,
                static: true // Make components non-draggable and non-resizable
              })) }}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
              rowHeight={60}
              isDraggable={false}
              isResizable={false}
            >
              {components.map((component) => (
                <div key={component.id}>
                  <Card className="h-full overflow-hidden">
                    <CardContent className="p-4 h-full">
                      {renderComponent(component)}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportViewerPage;