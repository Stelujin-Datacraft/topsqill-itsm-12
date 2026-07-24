import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/DashboardLayout';
import { DashboardsList } from '@/components/dashboards/DashboardsList';
import { useDashboards } from '@/hooks/useDashboards';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';
import { DashboardWithReports } from '@/types/dashboard';
import NoProjectSelected from '@/components/NoProjectSelected';
import { CreateDashboardDialog } from '@/components/dashboards/CreateDashboardDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Reports = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dashboards, loading, migrateOrphanReports, refetchDashboards } = useDashboards();
  const { hasPermission, checkPermissionWithAlert, getButtonState, getVisibleResources, loading: permissionLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();

  // Auto-migrate orphan reports on mount
  useEffect(() => {
    if (currentProject) {
      migrateOrphanReports();
    }
  }, [currentProject]);

  if (!currentProject) {
    return (
      <DashboardLayout title={t('reports.title')}>
        <NoProjectSelected />
      </DashboardLayout>
    );
  }

  const canReadReports = hasPermission('reports', 'read');
  const canCreateReports = hasPermission('reports', 'create') || hasPermission('dashboards', 'create');

  if (!permissionLoading && !canReadReports && !canCreateReports) {
    return (
      <DashboardLayout title={t('reports.title')}>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">{t('common.accessDenied')}</h3>
          <p className="text-muted-foreground">
            {t('reports.accessDeniedDesc')}
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

  const visibleDashboards = getVisibleResources('dashboards', dashboards);

  return (
    <DashboardLayout 
      title={t('reports.title')}
      description={t('reports.description')}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate('/data-table-builder')} className="whitespace-nowrap">
            {t('reports.dataTableReports')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/analytics-dashboard')} className="whitespace-nowrap">
            {t('reports.formAnalysis')}
          </Button>
          {(() => {
            const s = getButtonState('dashboards', 'create');
            return (
              <CreateDashboardDialog>
                <Button size="sm" disabled={s.disabled} title={s.tooltip || undefined} className="whitespace-nowrap">
                  <Plus className="h-4 w-4 me-2" />
                  {t('reports.createDashboard')}
                </Button>
              </CreateDashboardDialog>
            );
          })()}
        </>
      }
    >
      <DashboardsList
         dashboards={visibleDashboards}
        onView={handleViewDashboard}
        onDelete={handleDeleteDashboard}
        onCreate={handleCreateDashboard}
      />
    </DashboardLayout>
  );
};

export default Reports;
