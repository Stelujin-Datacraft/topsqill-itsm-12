
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useReports } from '@/hooks/useReports';
import { Report } from '@/types/reports';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReportEditor } from '@/components/reports/ReportEditor';
import { useToast } from '@/hooks/use-toast';

const ReportEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reports } = useReports();
  const { toast } = useToast();
  
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadReportData();
    }
  }, [id, reports]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Handle "new" report creation
      if (id === 'new') {
        setReport({
          id: 'new',
          name: 'New Report',
          description: '',
          project_id: '',
          organization_id: '',
          created_by: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_public: false
        });
      } else {
        const foundReport = reports.find(r => r.id === id);
        if (foundReport) {
          setReport(foundReport);
        }
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    toast({
      title: "Success",
      description: "Report saved successfully",
    });
  };

  if (loading) {
    return (
      <DashboardLayout title="Report Editor">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading report...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!report && id !== 'new') {
    return (
      <DashboardLayout title="Report Editor">
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
    <DashboardLayout title="">
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/reports')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>

        <div className="flex-1">
          <ReportEditor
            reportId={report.id}
            reportName={report.name}
            onSave={handleSave}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportEditorPage;
