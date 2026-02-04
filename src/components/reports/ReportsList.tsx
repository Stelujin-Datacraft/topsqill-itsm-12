import React, { useState, useCallback } from 'react';
import { Report } from '@/types/reports';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { supabase } from '@/integrations/supabase/client';
import { ReportCard } from './ReportCard';

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
  const { toast } = useToast();
  const { getButtonState, checkPermissionWithAlert } = useUnifiedAccessControl();

  const handleCopyId = (id: string, name: string) => {
    navigator.clipboard.writeText(id);
    toast({
      title: "Copied",
      description: `Report ID copied to clipboard`,
    });
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
        const { error: componentsError } = await supabase
          .from('report_components')
          .delete()
          .eq('report_id', report.id);

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
          .eq('id', report.id);

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

  if (loading) {
    return <LoadingScreen message="Loading reports..." />;
  }

  return (
    <div className="space-y-6">
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
        </div>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">No reports yet</h3>
                <p className="text-muted-foreground">
                  Reports are now created inside dashboards. Go back to dashboards to create reports.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/reports')}>
                Go to Dashboards
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.map(report => {
            const editButtonState = getButtonState('reports', 'update', report.id);
            const deleteButtonState = getButtonState('reports', 'delete', report.id);
            
            return (
              <ReportCard
                key={report.id}
                report={report}
                editButtonState={editButtonState}
                deleteButtonState={deleteButtonState}
                loading={loading}
                onView={onView}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onCopyId={handleCopyId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
