
import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ReportsList } from '@/components/reports/ReportsList';
import { CreateReportDialog } from '@/components/reports/CreateReportDialog';
import { useReports } from '@/hooks/useReports';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { Report } from '@/types/reports';
import NoProjectSelected from '@/components/NoProjectSelected';

const Reports = () => {
  const navigate = useNavigate();
  const { reports, loading, refetchReports } = useReports();
  const { hasPermission, checkPermissionWithAlert, getVisibleResources, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();

  if (!currentProject) {
    return (
      <DashboardLayout title="Reports">
        <NoProjectSelected />
      </DashboardLayout>
    );
  }

  // Check if user can even see the reports page
  const canReadReports = hasPermission('reports', 'read');
  
  if (!permissionLoading && !canReadReports) {
    return (
      <DashboardLayout title="Reports">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view reports in this project.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleViewReport = (report: Report) => {
    navigate(`/report-view/${report.id}`);
  };

  const handleEditReport = (report: Report) => {
    if (checkPermissionWithAlert('reports', 'update', report.id)) {
      navigate(`/report-editor/${report.id}`);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (checkPermissionWithAlert('reports', 'delete', reportId)) {
      await refetchReports();
    }
  };

  const handleCreateReport = () => {
    // Permission check is handled inside CreateReportDialog
    return checkPermissionWithAlert('reports', 'create');
  };

  const getReportPermissions = (report: Report) => ({
    canEdit: hasPermission('reports', 'update', report.id),
    canDelete: hasPermission('reports', 'delete', report.id),
    canView: hasPermission('reports', 'read', report.id)
  });

  // Filter reports based on user's permissions
  const visibleReports = getVisibleResources('reports', reports);

  const canCreateReport = hasPermission('reports', 'create');

  return (
    <DashboardLayout title="Reports">
      <div className="space-y-6">
        {canCreateReport && (
          <div className="flex justify-end">
            <CreateReportDialog />
          </div>
        )}
        <ReportsList
          reports={visibleReports}
          onView={handleViewReport}
          onEdit={handleEditReport}
          onDelete={handleDeleteReport}
          onCreate={handleCreateReport}
          getPermissions={getReportPermissions}
        />
      </div>
    </DashboardLayout>
  );
};

export default Reports;
