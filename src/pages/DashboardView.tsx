import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingScreen } from '@/components/LoadingScreen';
import { CreateReportDialog } from '@/components/reports/CreateReportDialog';

const DashboardView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboards')
        .select(`*, reports:reports(id, name, description, created_at, updated_at)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

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

  return (
    <DashboardLayout title={dashboard.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboards
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{dashboard.name}</h1>
              {dashboard.description && <p className="text-muted-foreground">{dashboard.description}</p>}
            </div>
          </div>
          <CreateReportDialog dashboardId={dashboard.id}>
            <Button><Plus className="h-4 w-4 mr-2" />Add Report</Button>
          </CreateReportDialog>
        </div>

        {dashboard.reports?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold">No reports in this dashboard</h3>
              <p className="text-muted-foreground mb-4">Add reports to start building your dashboard</p>
              <CreateReportDialog dashboardId={dashboard.id}>
                <Button>Add First Report</Button>
              </CreateReportDialog>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.reports?.map((report: any) => (
              <Card key={report.id} className="cursor-pointer hover:shadow-md" onClick={() => navigate(`/report-view/${report.id}`)}>
                <CardHeader>
                  <CardTitle className="text-lg">{report.name}</CardTitle>
                  {report.description && <p className="text-sm text-muted-foreground">{report.description}</p>}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardView;
