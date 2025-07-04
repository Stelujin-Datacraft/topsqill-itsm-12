
import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ReportsList } from '@/components/reports/ReportsList';
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
    navigate(`/report-editor/${report.id}`);
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
    if (checkPermissionWithAlert('reports', 'create')) {
      navigate('/report-editor/new');
    }
  };

  const getReportPermissions = (report: Report) => ({
    canEdit: hasPermission('reports', 'update', report.id),
    canDelete: hasPermission('reports', 'delete', report.id),
    canView: hasPermission('reports', 'read', report.id)
  });

  // Filter reports based on user's permissions
  const visibleReports = getVisibleResources('reports', reports);

  return (
    <DashboardLayout title="Reports">
      <ReportsList
        reports={visibleReports}
        onView={handleViewReport}
        onEdit={handleEditReport}
        onDelete={handleDeleteReport}
        onCreate={handleCreateReport}
        getPermissions={getReportPermissions}
      />
    </DashboardLayout>
  );
};

export default Reports;
