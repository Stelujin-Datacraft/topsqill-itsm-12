import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Plus, FileText, Eye, Edit, Trash2, Calendar } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingScreen } from '@/components/LoadingScreen';
import { CreateReportDialog } from '@/components/reports/CreateReportDialog';
import { ShareLinkButton } from '@/components/shared/ShareLinkButton';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const DashboardView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);
  const { getButtonState, checkPermissionWithAlert } = useUnifiedAccessControl();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboards')
        .select(`*, reports:reports(id, name, description, created_at, updated_at, is_public)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleViewReport = (reportId: string) => {
    navigate(`/report-view/${reportId}`);
  };

  const handleEditReport = (reportId: string) => {
    if (!checkPermissionWithAlert('reports', 'update', reportId)) {
      return;
    }
    navigate(`/report-editor/${reportId}`);
  };

  const handleDeleteReport = async (reportId: string, reportName: string) => {
    if (!checkPermissionWithAlert('reports', 'delete', reportId)) {
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete "${reportName}"?`)) {
      try {
        setDeleting(reportId);

        // Delete report components first
        const { error: componentsError } = await supabase
          .from('report_components')
          .delete()
          .eq('report_id', reportId);

        if (componentsError) {
          console.error('Error deleting report components:', componentsError);
          toast({
            title: "Error",
            description: "Failed to delete report components",
            variant: "destructive"
          });
          return;
        }

        // Delete the report
        const { error: reportError } = await supabase
          .from('reports')
          .delete()
          .eq('id', reportId);

        if (reportError) {
          console.error('Error deleting report:', reportError);
          toast({
            title: "Error",
            description: "Failed to delete report",
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Success",
          description: "Report deleted successfully"
        });

        // Refresh the dashboard data
        queryClient.invalidateQueries({ queryKey: ['dashboard', id] });
      } catch (error) {
        console.error('Error deleting report:', error);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        });
      } finally {
        setDeleting(null);
      }
    }
  };

  const createButtonState = getButtonState('reports', 'create');

  if (isLoading) {
    return <DashboardLayout title="Loading..."><LoadingScreen /></DashboardLayout>;
  }

  if (!dashboard) {
    return (
      <DashboardLayout title="Dashboard Not Found">
        <div className="text-center py-12">
          <p>Dashboard not found</p>
          <Button onClick={() => navigate('/reports')} className="mt-4">Go Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const CreateReportButton = () => (
    <CreateReportDialog dashboardId={dashboard.id}>
      <Button disabled={createButtonState.disabled}>
        <Plus className="h-4 w-4 mr-2" />
        Add Report
      </Button>
    </CreateReportDialog>
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      {createButtonState.disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><CreateReportButton /></div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{createButtonState.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <CreateReportButton />
      )}
      <Button variant="outline" onClick={() => navigate('/reports')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboards
      </Button>
    </div>
  );

  return (
    <DashboardLayout title={dashboard.name} actions={headerActions}>
      <div className="space-y-6">
        {dashboard.description && (
          <p className="text-muted-foreground">{dashboard.description}</p>
        )}

        {dashboard.reports?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold">No reports in this dashboard</h3>
              <p className="text-muted-foreground mb-4">Add reports to start building your dashboard</p>
              {createButtonState.disabled ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <CreateReportDialog dashboardId={dashboard.id}>
                          <Button disabled={createButtonState.disabled}>Add First Report</Button>
                        </CreateReportDialog>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{createButtonState.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <CreateReportDialog dashboardId={dashboard.id}>
                  <Button>Add First Report</Button>
                </CreateReportDialog>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.reports?.map((report: any) => {
              const editButtonState = getButtonState('reports', 'update', report.id);
              const deleteButtonState = getButtonState('reports', 'delete', report.id);
              const isDeleting = deleting === report.id;

              return (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{report.name}</CardTitle>
                        {report.description && <CardDescription>{report.description}</CardDescription>}
                      </div>
                      <div className="flex space-x-1">
                        <ShareLinkButton 
                          assetType="report" 
                          assetId={report.id} 
                          assetName={report.name} 
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleViewReport(report.id)} 
                          title="View Report"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditReport(report.id)} 
                                disabled={editButtonState.disabled}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Report"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteReport(report.id, report.name)} 
                                disabled={deleteButtonState.disabled || isDeleting}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{deleteButtonState.disabled ? deleteButtonState.tooltip : "Delete Report"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(report.created_at), 'MMM d, yyyy')}</span>
                      </div>
                      {report.is_public && <Badge variant="secondary">Public</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardView;
