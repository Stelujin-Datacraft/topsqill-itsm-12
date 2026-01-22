
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useReports } from '@/hooks/useReports';
import { ReportAccessManager } from '@/components/reports/ReportAccessManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LoadingScreen } from '@/components/LoadingScreen';

const ReportAccessManagement = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reports, loading } = useReports();
  
  const report = reports.find(r => r.id === id);

  if (loading) {
    return (
      <DashboardLayout title="Report Access Management">
        <LoadingScreen message="Loading report access..." />
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout title="Report Access Management">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Report not found</p>
          <Button onClick={() => navigate('/reports')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Report Access Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/reports')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>

        <ReportAccessManager 
          reportId={report.id} 
          reportName={report.name}
        />
      </div>
    </DashboardLayout>
  );
};

export default ReportAccessManagement;
