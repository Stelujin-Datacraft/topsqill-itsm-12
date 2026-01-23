import React, { useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DashboardsList } from '@/components/dashboards/DashboardsList';
import { useDashboards } from '@/hooks/useDashboards';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { DashboardWithReports } from '@/types/dashboard';
import NoProjectSelected from '@/components/NoProjectSelected';

const Reports = () => {
  const navigate = useNavigate();
  const { dashboards, loading, migrateOrphanReports, refetchDashboards } = useDashboards();
  const { hasPermission, checkPermissionWithAlert, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();

  // Auto-migrate orphan reports on mount
  useEffect(() => {
    if (currentProject) {
      migrateOrphanReports();
    }
  }, [currentProject]);

  if (!currentProject) {
    return (
      <DashboardLayout title="Dashboards">
        <NoProjectSelected />
      </DashboardLayout>
    );
  }

  const canReadReports = hasPermission('reports', 'read');
  
  if (!permissionLoading && !canReadReports) {
    return (
      <DashboardLayout title="Dashboards">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view dashboards in this project.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleViewDashboard = (dashboard: DashboardWithReports) => {
    navigate(`/dashboard-view/${dashboard.id}`);
  };


  const handleDeleteDashboard = async () => {
    await refetchDashboards();
  };

  const handleCreateDashboard = () => {
    return checkPermissionWithAlert('reports', 'create');
  };

  return (
    <DashboardLayout title="Dashboards">
      <div className="space-y-6">
        <DashboardsList
          dashboards={dashboards}
          onView={handleViewDashboard}
          onDelete={handleDeleteDashboard}
          onCreate={handleCreateDashboard}
        />
      </div>
    </DashboardLayout>
  );
};

export default Reports;
