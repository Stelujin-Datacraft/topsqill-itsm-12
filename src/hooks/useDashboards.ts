import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Dashboard, DashboardWithReports, ReportMedia } from '@/types/dashboard';
import { useToast } from '@/hooks/use-toast';
import { useRef, useCallback } from 'react';

export function useDashboards() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const migrationRunRef = useRef(false);

  const { data: dashboards = [], isLoading: loading, refetch: refetchDashboards } = useQuery({
    queryKey: ['dashboards', currentProject?.id],
    queryFn: async () => {
      if (!currentProject) return [];
      
      const { data, error } = await supabase
        .from('dashboards')
        .select(`
          *,
          reports:reports(id, name, description, created_at, updated_at, is_public)
        `)
        .eq('project_id', currentProject.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DashboardWithReports[];
    },
    enabled: !!currentProject,
  });

  const createDashboard = async (dashboardData: { name: string; description?: string }) => {
    if (!userProfile?.organization_id || !currentProject) {
      throw new Error('Organization and project required');
    }

    const { data, error } = await supabase
      .from('dashboards')
      .insert({
        name: dashboardData.name,
        description: dashboardData.description,
        project_id: currentProject.id,
        organization_id: userProfile.organization_id,
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (error) throw error;
    
    await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    
    return data as Dashboard;
  };

  const setDefaultDashboard = async (dashboardId: string, isDefault: boolean) => {
    const { error } = await supabase
      .from('dashboards')
      .update({ is_default: isDefault } as any)
      .eq('id', dashboardId);

    if (error) throw error;
    
    await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    
    toast({
      title: isDefault ? 'Default Dashboard Set' : 'Default Removed',
      description: isDefault 
        ? 'Users will be redirected to this dashboard on login.' 
        : 'Default dashboard has been unset.',
    });
  };

  const updateDashboard = async (dashboardId: string, updates: { name?: string; description?: string }) => {
    const { data, error } = await supabase
      .from('dashboards')
      .update(updates)
      .eq('id', dashboardId)
      .select()
      .single();

    if (error) throw error;
    
    await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    
    return data as Dashboard;
  };

  const deleteDashboard = async (dashboardId: string) => {
    // Reports will be cascade deleted due to FK constraint
    const { error } = await supabase
      .from('dashboards')
      .delete()
      .eq('id', dashboardId);

    if (error) throw error;
    
    await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
  };

  // Create a report within a dashboard
  const createReportInDashboard = async (dashboardId: string, reportData: { name: string; description?: string }) => {
    if (!userProfile?.organization_id || !currentProject) {
      throw new Error('Organization and project required');
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        name: reportData.name,
        description: reportData.description,
        project_id: currentProject.id,
        organization_id: userProfile.organization_id,
        created_by: userProfile.id,
        dashboard_id: dashboardId,
      })
      .select()
      .single();

    if (error) throw error;
    
    await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
    
    return data;
  };

  // Auto-migrate orphan reports to a default dashboard - runs only once per session
  const migrateOrphanReports = useCallback(async () => {
    // Prevent multiple runs
    if (migrationRunRef.current) return;
    if (!userProfile?.organization_id || !currentProject) return;

    // Mark as running immediately to prevent race conditions
    migrationRunRef.current = true;

    try {
      // Check for reports without a dashboard
      const { data: orphanReports, error: fetchError } = await supabase
        .from('reports')
        .select('id')
        .eq('project_id', currentProject.id)
        .is('dashboard_id', null);

      if (fetchError) {
        console.error('Error checking orphan reports:', fetchError);
        return;
      }
      
      // No orphan reports, nothing to do
      if (!orphanReports?.length) return;

      // Create or find default dashboard
      let defaultDashboard: Dashboard | null = null;

      const { data: existingDefault, error: findError } = await supabase
        .from('dashboards')
        .select('*')
        .eq('project_id', currentProject.id)
        .eq('name', 'Default Dashboard')
        .maybeSingle();

      if (findError) {
        console.error('Error finding default dashboard:', findError);
        return;
      }

      if (existingDefault) {
        defaultDashboard = existingDefault as Dashboard;
      } else {
        const { data: newDashboard, error: createError } = await supabase
          .from('dashboards')
          .insert({
            name: 'Default Dashboard',
            description: 'Auto-created dashboard for migrated reports',
            project_id: currentProject.id,
            organization_id: userProfile.organization_id,
            created_by: userProfile.id,
          })
          .select()
          .single();

        if (createError) {
          console.error('Failed to create default dashboard:', createError);
          return;
        }
        defaultDashboard = newDashboard as Dashboard;
      }

      if (!defaultDashboard) return;

      // Migrate orphan reports - be explicit about the IDs to update
      const orphanIds = orphanReports.map(r => r.id);
      
      const { error: updateError } = await supabase
        .from('reports')
        .update({ dashboard_id: defaultDashboard.id })
        .in('id', orphanIds);

      if (updateError) {
        console.error('Failed to migrate reports:', updateError);
        return;
      }

      toast({
        title: 'Reports Migrated',
        description: `${orphanReports.length} existing report(s) have been moved to the Default Dashboard.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
    } catch (error) {
      console.error('Migration error:', error);
    }
  }, [userProfile?.organization_id, currentProject?.id, queryClient, toast]);

  // Report media management
  const addReportMedia = async (mediaData: Omit<ReportMedia, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('report_media')
      .insert(mediaData)
      .select()
      .single();

    if (error) throw error;
    
    await queryClient.invalidateQueries({ queryKey: ['report-media'] });
    
    return data as ReportMedia;
  };

  const updateReportMedia = async (mediaId: string, updates: Partial<ReportMedia>) => {
    const { data, error } = await supabase
      .from('report_media')
      .update(updates)
      .eq('id', mediaId)
      .select()
      .single();

    if (error) throw error;
    
    await queryClient.invalidateQueries({ queryKey: ['report-media'] });
    
    return data as ReportMedia;
  };

  const deleteReportMedia = async (mediaId: string) => {
    const { error } = await supabase
      .from('report_media')
      .delete()
      .eq('id', mediaId);

    if (error) throw error;
    
    await queryClient.invalidateQueries({ queryKey: ['report-media'] });
  };

  const fetchReportMedia = async (reportId: string) => {
    const { data, error } = await supabase
      .from('report_media')
      .select('*')
      .eq('report_id', reportId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return (data || []) as ReportMedia[];
  };

  return {
    dashboards,
    loading,
    refetchDashboards,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    createReportInDashboard,
    migrateOrphanReports,
    addReportMedia,
    updateReportMedia,
    deleteReportMedia,
    fetchReportMedia,
  };
}
