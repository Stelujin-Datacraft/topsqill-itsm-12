import React, { useState } from 'react';
import { useReports } from '@/hooks/useReports';
import { Report } from '@/types/reports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, FileText, Calendar, User, Eye, Edit, Trash2, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { supabase } from '@/integrations/supabase/client';
export interface ReportsListProps {
  reports: Report[];
  onView: (report: Report) => void;
  onEdit: (report: Report) => void;
  onDelete: (reportId: string) => void;
  onCreate: () => void;
  getPermissions?: (report: Report) => {
    canEdit: boolean;
    canDelete: boolean;
    canView: boolean;
  };
}
export function ReportsList({
  reports = [],
  onView,
  onEdit,
  onDelete,
  onCreate,
  getPermissions
}: ReportsListProps) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    getButtonState,
    checkPermissionWithAlert
  } = useUnifiedAccessControl();
  const handleAccessManagement = (report: Report) => {
    navigate(`/report/${report.id}/access`);
  };
  const handleEditClick = (report: Report) => {
    if (!checkPermissionWithAlert('reports', 'update', report.id)) {
      return;
    }
    onEdit(report);
  };
  const handleDeleteClick = async (report: Report) => {
    if (!checkPermissionWithAlert('reports', 'delete', report.id)) {
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${report.name}"?`)) {
      try {
        setLoading(true);

        // Delete report components first
        const {
          error: componentsError
        } = await supabase.from('report_components').delete().eq('report_id', report.id);
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
        const {
          error: reportError
        } = await supabase.from('reports').delete().eq('id', report.id);
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

        // Call the parent's onDelete to refresh the list
        onDelete(report.id);
      } catch (error) {
        console.error('Error deleting report:', error);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }
  };
  const createButtonState = getButtonState('reports', 'create');
  if (loading) {
    return <LoadingScreen message="Loading reports..." />;
  }
  const CreateReportButton = () => {};
  const CreateFirstReportButton = () => <Button onClick={createButtonState.disabled ? () => checkPermissionWithAlert('reports', 'create') : onCreate} disabled={createButtonState.disabled}>
      <Plus className="h-4 w-4 mr-2" />
      Create Your First Report
    </Button>;
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-muted-foreground">
            Create and manage your data visualization reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/data-table-builder')}>
            Data Table Reports
          </Button>
          <Button variant="outline" onClick={() => navigate('/analytics-dashboard')}>
            Form Analysis
          </Button>
          {createButtonState.disabled ? <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <CreateReportButton />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{createButtonState.tooltip}</p>
                </TooltipContent>
                </Tooltip>
              </TooltipProvider> : <CreateReportButton />}
        </div>
      </div>

      {reports.length === 0 ? <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">No reports yet</h3>
                <p className="text-muted-foreground">
                  Get started by creating your first report to visualize your form data.
                </p>
              </div>
              {createButtonState.disabled ? <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <CreateFirstReportButton />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{createButtonState.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider> : <CreateFirstReportButton />}
            </div>
          </CardContent>
        </Card> : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.map(report => {
        const editButtonState = getButtonState('reports', 'update', report.id);
        const deleteButtonState = getButtonState('reports', 'delete', report.id);
        return <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      {report.description && <CardDescription>{report.description}</CardDescription>}
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => onView(report)} title="View Report">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(report)} disabled={editButtonState.disabled}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Report"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button variant="ghost" size="sm" onClick={() => handleAccessManagement(report)} title="Manage Access">
                        <Shield className="h-4 w-4" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(report)} disabled={deleteButtonState.disabled || loading}>
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
              </Card>;
      })}
        </div>}
    </div>;
}